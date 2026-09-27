from backend.database import engine, SessionLocal, Base
from backend.models import Question

# 1. Automatically create all tables defined in models.py if they don't exist yet
print("Creating tables in Supabase PostgreSQL...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")

# 2. Seed initial questions with multi-dimensional metadata
INITIAL_QUESTIONS = [
    {
        "question_text": "Which data structure follows the First-In, First-Out (FIFO) principle?",
        "option_a": "Stack",
        "option_b": "Queue",
        "option_c": "Tree",
        "option_d": "Graph",
        "correct_answer": "Queue",
        "topic": "Queues",
        "concept": "FIFO Principle",
        "skill_type": "Recall"
    },
    {
        "question_text": "In a Binary Search Tree (BST), where are keys smaller than the root node placed?",
        "option_a": "Right Subtree",
        "option_b": "Left Subtree",
        "option_c": "At the same level",
        "option_d": "Randomly",
        "correct_answer": "Left Subtree",
        "topic": "Trees",
        "concept": "BST Ordering",
        "skill_type": "Conceptual"
    },
    {
        "question_text": "What is the worst-case time complexity to search an element in an unbalanced Binary Search Tree?",
        "option_a": "O(1)",
        "option_b": "O(log N)",
        "option_c": "O(N)",
        "option_d": "O(N log N)",
        "correct_answer": "O(N)",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Application"
    },
    {
        "question_text": "In an inorder traversal of a Binary Search Tree, in what order are the keys visited?",
        "option_a": "Descending Order",
        "option_b": "Sorted Ascending Order",
        "option_c": "Random Order",
        "option_d": "Level-by-Level",
        "correct_answer": "Sorted Ascending Order",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Conceptual"
    },
    {
        "question_text": "Which tree traversal algorithm utilizes a Queue for its implementation?",
        "option_a": "Preorder Traversal",
        "option_b": "Inorder Traversal",
        "option_c": "Postorder Traversal",
        "option_d": "Breadth-First / Level Order Traversal",
        "correct_answer": "Breadth-First / Level Order Traversal",
        "topic": "Trees",
        "concept": "BST Traversal",
        "skill_type": "Application"
    }
]

def seed_database():
    db = SessionLocal()
    try:
        # Check if questions already exist to avoid duplicate seeding
        existing_count = db.query(Question).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} questions. Skipping seed.")
            return

        print("Seeding initial questions into Supabase...")
        for item in INITIAL_QUESTIONS:
            question_obj = Question(**item)
            db.add(question_obj)
        
        db.commit()
        print(f"Successfully seeded {len(INITIAL_QUESTIONS)} questions!")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()