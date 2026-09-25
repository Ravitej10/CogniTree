from fastapi import FastAPI

app = FastAPI(title="CogniTree API")

# Temporary mock database of questions with diagnostic metadata
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

@app.get("/")
def home():
    return {"message": "Welcome to CogniTree Backend!"}

@app.get("/quiz")
def get_quiz():
    # Return questions to the frontend without exposing the correct answer
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