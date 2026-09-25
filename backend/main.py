from fastapi import FastAPI
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
    }
]

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
    for q in QUESTIONS_DB:
        client_questions.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"],
            "topic": q["topic"],
            "concept": q["concept"],
            "skill_type": q["skill_type"]
        })
    return {"total": len(client_questions), "questions": client_questions}

@app.post("/quiz/submit")
def submit_quiz(submission: QuizSubmission):
    total_questions = len(submission.answers)
    correct_count = 0
    detailed_results = []
    
    question_map = {q["id"]: q for q in QUESTIONS_DB}

    for item in submission.answers:
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

    return {
        "student_id": submission.student_id,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "score_percentage": score_percentage,
        "results": detailed_results
    }