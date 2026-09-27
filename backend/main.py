from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Question, QuizAttempt, StudentAnswerLog

app = FastAPI(title="CogniTree API")

class AnswerSubmission(BaseModel):
    question_id: int
    selected_option: str

class QuizSubmission(BaseModel):
    student_id: int
    answers: List[AnswerSubmission]

@app.get("/")
def home():
    return {"message": "Welcome to CogniTree Backend!"}

@app.get("/quiz")
def get_quiz(db: Session = Depends(get_db)):
    # Retrieve the first 3 baseline diagnostic questions from PostgreSQL
    db_questions = db.query(Question).limit(3).all()
    
    client_questions = []
    for q in db_questions:
        client_questions.append({
            "id": q.id,
            "question": q.question_text,
            "options": [q.option_a, q.option_b, q.option_c, q.option_d],
            "topic": q.topic,
            "concept": q.concept,
            "skill_type": q.skill_type
        })
    return {"total": len(client_questions), "questions": client_questions}

def compute_diagnostic_matrix(results: List[Dict]):
    concept_stats = {}
    skill_stats = {}

    for r in results:
        concept = r["concept"]
        skill = r["skill_type"]
        correct = 1 if r["is_correct"] else 0

        if concept not in concept_stats:
            concept_stats[concept] = {"total": 0, "correct": 0}
        concept_stats[concept]["total"] += 1
        concept_stats[concept]["correct"] += correct

        if skill not in skill_stats:
            skill_stats[skill] = {"total": 0, "correct": 0}
        skill_stats[skill]["total"] += 1
        skill_stats[skill]["correct"] += correct

    GAP_THRESHOLD = 70.0
    concept_matrix = []
    weak_areas = []

    for name, stats in concept_stats.items():
        percentage = round((stats["correct"] / stats["total"]) * 100, 2)
        is_gap = percentage < GAP_THRESHOLD
        if is_gap:
            weak_areas.append(name)
        concept_matrix.append({
            "concept": name,
            "total_questions": stats["total"],
            "correct": stats["correct"],
            "mastery_percentage": percentage,
            "knowledge_gap": is_gap
        })

    skill_matrix = []
    for name, stats in skill_stats.items():
        percentage = round((stats["correct"] / stats["total"]) * 100, 2)
        skill_matrix.append({
            "skill_type": name,
            "total_questions": stats["total"],
            "correct": stats["correct"],
            "mastery_percentage": percentage,
            "needs_focus": percentage < GAP_THRESHOLD
        })

    return {
        "concept_breakdown": concept_matrix,
        "skill_breakdown": skill_matrix,
        "flagged_weak_concepts": weak_areas
    }

@app.post("/quiz/submit")
def submit_quiz(submission: QuizSubmission, db: Session = Depends(get_db)):
    total_questions = len(submission.answers)
    correct_count = 0
    detailed_results = []
    
    # Query database for submitted question records
    submitted_ids = [a.question_id for a in submission.answers]
    db_questions = db.query(Question).filter(Question.id.in_(submitted_ids)).all()
    question_map = {q.id: q for q in db_questions}

    # Evaluate responses
    evaluation_records = []
    for item in submission.answers:
        target = question_map.get(item.question_id)
        if not target:
            continue

        is_correct = (item.selected_option.strip().lower() == target.correct_answer.strip().lower())
        if is_correct:
            correct_count += 1

        evaluation_records.append({
            "question_id": target.id,
            "topic": target.topic,
            "concept": target.concept,
            "skill_type": target.skill_type,
            "selected_option": item.selected_option,
            "correct_answer": target.correct_answer,
            "is_correct": is_correct
        })

    score_percentage = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0
    diagnostics = compute_diagnostic_matrix(evaluation_records)

    # Persist the attempt in quiz_attempts table
    attempt = QuizAttempt(
        student_id=submission.student_id,
        total_questions=total_questions,
        correct_count=correct_count,
        score_percentage=score_percentage
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    # Persist individual answer logs in student_answer_logs table
    for rec in evaluation_records:
        log = StudentAnswerLog(
            attempt_id=attempt.id,
            student_id=submission.student_id,
            question_id=rec["question_id"],
            selected_option=rec["selected_option"],
            is_correct=rec["is_correct"]
        )
        db.add(log)
    db.commit()

    return {
        "attempt_id": attempt.id,
        "student_id": submission.student_id,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "overall_score": score_percentage,
        "diagnostics": diagnostics,
        "detailed_results": evaluation_records
    }

@app.get("/remediation/{student_id}")
def get_remediation_quiz(student_id: int, db: Session = Depends(get_db)):
    # 5.1 & 5.2: Query student's past attempt logs to identify weak concepts and attempted IDs
    past_logs = (
        db.query(StudentAnswerLog, Question)
        .join(Question, StudentAnswerLog.question_id == Question.id)
        .filter(StudentAnswerLog.student_id == student_id)
        .all()
    )

    if not past_logs:
        raise HTTPException(
            status_code=404,
            detail="No quiz history found for this student. Please take the diagnostic quiz first."
        )

    attempted_question_ids = {log.question_id for log, _ in past_logs}

    # Recalculate concept scores from historical logs
    concept_stats = {}
    for log, q in past_logs:
        if q.concept not in concept_stats:
            concept_stats[q.concept] = {"total": 0, "correct": 0}
        concept_stats[q.concept]["total"] += 1
        if log.is_correct:
            concept_stats[q.concept]["correct"] += 1

    weak_concepts = [
        concept for concept, stats in concept_stats.items()
        if (stats["correct"] / stats["total"]) * 100 < 70.0
    ]

    if not weak_concepts:
        return {
            "student_id": student_id,
            "message": "Excellent mastery! No knowledge gaps detected below 70%.",
            "remediation_questions": []
        }

    # 5.3: Query database for unattempted questions matching weak concepts
    remediation_pool = (
        db.query(Question)
        .filter(Question.concept.in_(weak_concepts))
        .filter(Question.id.not_in(attempted_question_ids))
        .all()
    )

    remediation_questions = [
        {
            "id": q.id,
            "question": q.question_text,
            "options": [q.option_a, q.option_b, q.option_c, q.option_d],
            "topic": q.topic,
            "concept": q.concept,
            "skill_type": q.skill_type
        }
        for q in remediation_pool
    ]

    return {
        "student_id": student_id,
        "targeted_weak_concepts": weak_concepts,
        "total_remediation_questions": len(remediation_questions),
        "remediation_questions": remediation_questions
    }