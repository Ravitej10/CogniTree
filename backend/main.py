import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Add project root directory so we can import root scripts (ingest.py, etc.)
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.database import get_db
from backend.models import (
    ConceptTag,
    DocumentStatus,
    Question,
    QuizSession,
    Response,
    SkillType,
    SourceDocument,
    User,
)


app = FastAPI(title="CogniTree API")

# Allow requests from Vite dev server and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = BASE_DIR / "uploaded_docs"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# --- Schemas ---
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class AnswerSubmission(BaseModel):
    question_id: int
    selected_index: int


class QuizSubmission(BaseModel):
    answers: List[AnswerSubmission]


# --- Auth Endpoints ---
@app.post("/auth/register", response_model=TokenResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    existing = (
        db.query(User)
        .filter(
            (User.username == user_data.username)
            | (User.email == user_data.email)
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered.",
        )

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "username": new_user.username,
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(
            (User.username == credentials.username)
            | (User.email == credentials.username)
        )
        .first()
    )

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
    }


@app.get("/auth/me")
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
    }


# --- Document Ingestion Endpoints ---
@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Create a tracking record in Supabase
    doc_record = SourceDocument(
        user_id=current_user.id,
        filename=file.filename,
        status=DocumentStatus.PENDING,
        chunk_count=0,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    # 2. Save physical file locally
    saved_path = UPLOAD_DIR / f"{doc_record.id}_{file.filename}"
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Run the ingestion pipeline
    import ingest
    result = ingest.ingest_document(
        document_id=str(doc_record.id),
        file_path=str(saved_path)
    )

    if result.status == "ready":
        doc_record.status = DocumentStatus.READY
        doc_record.chunk_count = result.chunk_count
    else:
        doc_record.status = DocumentStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Ingestion failed: {result.error}"
        )

    db.commit()
    db.refresh(doc_record)

    return {
        "message": "Document uploaded and processed successfully!",
        "document_id": doc_record.id,
        "filename": doc_record.filename,
        "chunk_count": doc_record.chunk_count,
        "status": doc_record.status.value,
    }

@app.get("/documents/my-documents")
def list_my_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(SourceDocument)
        .filter(SourceDocument.user_id == current_user.id)
        .all()
    )
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "chunk_count": doc.chunk_count,
            "status": doc.status.value,
            "created_at": doc.created_at,
        }
        for doc in docs
    ]


# --- Quiz Endpoints ---
@app.get("/")
def home():
    return {"message": "Welcome to CogniTree Backend!"}


@app.get("/quiz")
def get_quiz(db: Session = Depends(get_db)):
    db_questions = db.query(Question).limit(5).all()
    client_questions = []
    for q in db_questions:
        client_questions.append({
            "id": q.id,
            "question": q.question_text,
            "options": q.options,
            "topic": q.topic,
            "subtopic": q.subtopic,
            "skill_type": q.skill_type.value if hasattr(q.skill_type, "value") else str(q.skill_type),
        })
    return {"total": len(client_questions), "questions": client_questions}


@app.post("/quiz/submit")
def submit_quiz(
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total_questions = len(submission.answers)
    if total_questions == 0:
        raise HTTPException(status_code=400, detail="No answers submitted.")

    submitted_ids = [a.question_id for a in submission.answers]
    db_questions = db.query(Question).filter(Question.id.in_(submitted_ids)).all()
    question_map = {q.id: q for q in db_questions}

    session_record = QuizSession(user_id=current_user.id, score=0.0)
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    correct_count = 0
    evaluation_records = []

    for item in submission.answers:
        target = question_map.get(item.question_id)
        if not target:
            continue

        is_correct = (item.selected_index == target.answer_index)
        if is_correct:
            correct_count += 1

        resp = Response(
            session_id=session_record.id,
            question_id=target.id,
            selected_index=item.selected_index,
            is_correct=is_correct,
        )
        db.add(resp)

        evaluation_records.append({
            "question_id": target.id,
            "topic": target.topic,
            "subtopic": target.subtopic,
            "selected_index": item.selected_index,
            "correct_index": target.answer_index,
            "is_correct": is_correct,
            "explanation": target.explanation,
        })

    score_percentage = round((correct_count / total_questions) * 100, 2)
    session_record.score = score_percentage
    db.commit()

    return {
        "session_id": session_record.id,
        "score_percentage": score_percentage,
        "total_questions": total_questions,
        "correct_count": correct_count,
        "results": evaluation_records,
    }


@app.get("/quiz/history")
def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == current_user.id)
        .order_by(QuizSession.created_at.desc())
        .all()
    )
    return [
        {
            "session_id": s.id,
            "score": s.score,
            "created_at": s.created_at,
        }
        for s in sessions
    ]


@app.get("/quiz/mastery")
def get_student_mastery(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_responses = (
        db.query(Response, Question)
        .join(QuizSession, Response.session_id == QuizSession.id)
        .join(Question, Response.question_id == Question.id)
        .filter(QuizSession.user_id == current_user.id)
        .all()
    )

    if not user_responses:
        return {
            "topics": [],
            "total_assessed": 0,
            "gaps_count": 0,
            "strong_count": 0,
            "average_mastery": 0,
        }

    # Aggregate by (concept, topic)
    stats_by_concept: Dict[tuple, Dict[str, int]] = {}
    for resp, q in user_responses:
        concept_name = q.concept or q.topic or "Core Concept"
        topic_name = q.topic or "General"
        key = (concept_name, topic_name)
        if key not in stats_by_concept:
            stats_by_concept[key] = {"total": 0, "correct": 0}
        stats_by_concept[key]["total"] += 1
        if resp.is_correct:
            stats_by_concept[key]["correct"] += 1

    topics = []
    total_mastery_sum = 0
    for (concept_name, topic_name), stats in stats_by_concept.items():
        mastery = round((stats["correct"] / stats["total"]) * 100)
        status_val = "gap" if mastery < 70 else "strong"
        total_mastery_sum += mastery
        topics.append({
            "name": concept_name,
            "subject": topic_name,
            "mastery": mastery,
            "status": status_val,
            "total_questions": stats["total"],
            "correct_questions": stats["correct"],
        })

    # Sort topics: gaps first (lowest mastery first), then strong (highest mastery)
    topics.sort(key=lambda t: (0 if t["status"] == "gap" else 1, t["mastery"]))

    gaps_count = sum(1 for t in topics if t["status"] == "gap")
    strong_count = sum(1 for t in topics if t["status"] == "strong")
    avg_mastery = round(total_mastery_sum / len(topics)) if topics else 0

    return {
        "topics": topics,
        "total_assessed": len(topics),
        "gaps_count": gaps_count,
        "strong_count": strong_count,
        "average_mastery": avg_mastery,
    }