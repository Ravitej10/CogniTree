from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI(title="CogniTree API")
QUESTIONS_DB = [
   
    {
        "id": 1,
        "question": "Which data structure follows the First-In, First-Out (FIFO) principle?",
        "options": ["Stack", "Queue", "Tree", "Graph"],
        "answer": "Queue",
        "topic": "Queues",
        "concept": "FIFO Principle",
        "skill_type": "Recall"
    },
    {
        "id": 2,
        "question": "In a Binary Search Tree (BST), where are keys smaller than the root node placed?",
        "options": ["Right Subtree", "Left Subtree", "At the same level", "Randomly"],
        "answer": "Left Subtree",
        "topic": "Trees",
        "concept": "BST Ordering",
        "skill_type": "Conceptual"
    },
    {
        "id": 3,
        "question": "What is the worst-case time complexity to search an element in an unbalanced Binary Search Tree?",
        "options": ["O(1)", "O(log N)", "O(N)", "O(N log N)"],
        "answer": "O(N)",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Application"
    },

    {
        "id": 4,
        "question": "In an inorder traversal of a Binary Search Tree, in what order are the keys visited?",
        "options": ["Descending Order", "Sorted Ascending Order", "Random Order", "Level-by-Level"],
        "answer": "Sorted Ascending Order",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Conceptual"
    },
    {
        "id": 5,
        "question": "Which tree traversal algorithm utilizes a Queue for its implementation?",
        "options": ["Preorder Traversal", "Inorder Traversal", "Postorder Traversal", "Breadth-First / Level Order Traversal"],
        "answer": "Breadth-First / Level Order Traversal",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Application"
    }
]

STUDENT_SESSIONS: Dict[int, Dict] = {}

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
def get_quiz():
    client_questions = []
    for q in QUESTIONS_DB[:3]:
        client_questions.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "topic": q["topic"],
            "concept": q["concept"],
            "skill_type": q["skill_type"]
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
def submit_quiz(submission: QuizSubmission):
    total_questions = len(submission.answers)
    correct_count = 0
    detailed_results = []
    attempted_question_ids = []
    question_map = {q["id"]: q for q in QUESTIONS_DB}

    for item in submission.answers:
        attempted_question_ids.append(item.question_id)
        target_question = question_map.get(item.question_id)
        if not target_question:
            continue

        is_correct = (item.selected_option.strip().lower() == target_question["answer"].strip().lower())
        if is_correct:
            correct_count += 1

        detailed_results.append({
            "question_id": item.question_id,
            "topic": target_question["topic"],
            "concept": target_question["concept"],
            "skill_type": target_question["skill_type"],
            "selected_option": item.selected_option,
            "correct_answer": target_question["answer"],
            "is_correct": is_correct
        })

    score_percentage = round((correct_count / total_questions) * 100, 2) if total_questions > 0 else 0
    diagnostics = compute_diagnostic_matrix(detailed_results)

    STUDENT_SESSIONS[submission.student_id] = {
        "attempted_ids": attempted_question_ids,
        "flagged_weak_concepts": diagnostics["flagged_weak_concepts"]
    }

    return {
        "student_id": submission.student_id,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "overall_score": score_percentage,
        "diagnostics": diagnostics,
        "detailed_results": detailed_results
    }

@app.get("/remediation/{student_id}")
def get_remediation_quiz(student_id: int):
    # Step 5.1: Retrieve student weaknesses
    session = STUDENT_SESSIONS.get(student_id)
    if not session:
        raise HTTPException(status_code=404, detail="No quiz history found for this student ID. Please take the diagnostic quiz first.")

    weak_concepts = session.get("flagged_weak_concepts", [])
    attempted_ids = set(session.get("attempted_ids", []))

    if not weak_concepts:
        return {
            "student_id": student_id,
            "message": "Excellent mastery! No knowledge gaps detected below 70%.",
            "remediation_questions": []
        }

    targeted_questions = []
    for q in QUESTIONS_DB:
        
        if q["id"] in attempted_ids:
            continue
       
        if q["concept"] in weak_concepts:
            targeted_questions.append({
                "id": q["id"],
                "question": q["question"],
                "options": q["options"],
                "topic": q["topic"],
                "concept": q["concept"],
                "skill_type": q["skill_type"]
            })

    return {
        "student_id": student_id,
        "targeted_weak_concepts": weak_concepts,
        "total_remediation_questions": len(targeted_questions),
        "remediation_questions": targeted_questions
    }