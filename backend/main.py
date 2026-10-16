import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional

# Add project root directory so we can import root scripts (ingest.py, etc.)
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.database import Base, engine, get_db
from backend.ai_schemas import GenerateQuestionsRequest
from backend.models import (
    ConceptTag,
    DocumentQuestion,
    DocumentQuizResponse,
    DocumentQuizSession,
    DocumentStatus,
    Question,
    QuizSession,
    Response,
    SkillType,
    SourceDocument,
    User,
)


app = FastAPI(title="CogniTree API")


@app.on_event("startup")
def create_missing_tables():
    """Create the document-assessment tables on existing development databases."""
    Base.metadata.create_all(bind=engine)

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
    safe_filename = Path(file.filename or "upload.pdf").name
    doc_record = SourceDocument(
        user_id=current_user.id,
        filename=safe_filename,
        status=DocumentStatus.PENDING,
        chunk_count=0,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)

    # 2. Save physical file locally
    saved_path = UPLOAD_DIR / f"{doc_record.id}_{safe_filename}"
    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Extract, chunk, embed, and index the document for this user.
    from backend.services.ingestion_service import IngestionError, ingest_document

    doc_record.status = DocumentStatus.PROCESSING
    db.commit()
    try:
        stored_count = ingest_document(
            user_id=current_user.id,
            document_id=doc_record.id,
            file_path=str(saved_path),
        )
        doc_record.status = DocumentStatus.READY
        doc_record.chunk_count = stored_count
    except IngestionError as exc:
        doc_record.status = DocumentStatus.FAILED
        db.commit()
        raise HTTPException(
            status_code=422,
            detail=f"Ingestion failed: {exc}",
        ) from exc
    except Exception as exc:
        doc_record.status = DocumentStatus.FAILED
        db.commit()
        raise HTTPException(status_code=500, detail="Document indexing failed.") from exc

    db.commit()
    db.refresh(doc_record)

    return {
        "message": "Document uploaded and processed successfully!",
        "document_id": doc_record.id,
        "filename": doc_record.filename,
        "chunk_count": doc_record.chunk_count,
        "question_count": 0,
        "status": doc_record.status.value,
        "question_generation_error": None,
    }


def _question_payload(question: Question) -> dict:
    return {
        "id": question.id,
        "question": question.question_text,
        "question_text": question.question_text,
        "options": question.options,
        "answer_index": question.answer_index,
        "explanation": question.explanation,
        "topic": question.topic,
        "subtopic": question.subtopic,
        "skill_type": (
            question.skill_type.value
            if hasattr(question.skill_type, "value")
            else str(question.skill_type)
        ),
        "difficulty": getattr(question, "difficulty", "medium"),
        "source_page": getattr(question, "source_page", None),
    }


@app.get("/rag/search")
def search_my_materials(
    query: str = Query(min_length=1),
    document_id: Optional[int] = None,
    limit: int = Query(default=5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Semantically retrieve chunks from the current user's indexed material."""
    if document_id is not None:
        owned = (
            db.query(SourceDocument)
            .filter(
                SourceDocument.id == document_id,
                SourceDocument.user_id == current_user.id,
            )
            .first()
        )
        if owned is None:
            raise HTTPException(status_code=404, detail="Document not found.")

    from backend.services.vector_store import query_by_topic

    return {
        "query": query,
        "results": query_by_topic(
            user_id=current_user.id,
            topic_keywords=query,
            n_results=limit,
            document_id=document_id,
        ),
    }


@app.post("/documents/{document_id}/generate-questions")
def generate_document_questions(
    document_id: int,
    request: GenerateQuestionsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and persist validated questions grounded in one owned document."""
    document = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.id == document_id,
            SourceDocument.user_id == current_user.id,
        )
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    if document.status != DocumentStatus.READY:
        raise HTTPException(status_code=409, detail="Document indexing is not complete.")

    from backend.services.question_factory import (
        GeminiBusyError,
        GeminiUnavailableError,
        generate_from_document,
    )

    existing_count = (
        db.query(DocumentQuestion)
        .filter(
            DocumentQuestion.source_document_id == document_id,
            DocumentQuestion.user_id == current_user.id,
        )
        .count()
    )

    try:
        questions = generate_from_document(
            db=db,
            user_id=current_user.id,
            document_id=document_id,
            count=request.count,
            topic=request.topic,
            subtopic=request.subtopic,
            model_name=request.model,
        )
    except (GeminiUnavailableError, GeminiBusyError) as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not questions:
        raise HTTPException(status_code=422, detail="No grounded questions could be generated.")
    return {
        "document_id": document_id,
        "generated": len(questions),
        "question_count": existing_count + len(questions),
        "questions": [_question_payload(question) for question in questions],
    }


@app.get("/documents/detail/{document_id}")
def get_document_workspace(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.id == document_id,
            SourceDocument.user_id == current_user.id,
        )
        .first()
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    question_count = (
        db.query(DocumentQuestion)
        .filter(
            DocumentQuestion.source_document_id == document_id,
            DocumentQuestion.user_id == current_user.id,
        )
        .count()
    )
    attempt_count = (
        db.query(DocumentQuizSession)
        .filter(
            DocumentQuizSession.source_document_id == document_id,
            DocumentQuizSession.user_id == current_user.id,
        )
        .count()
    )
    return {
        "id": document.id,
        "filename": document.filename,
        "status": document.status.value,
        "chunk_count": document.chunk_count,
        "question_count": question_count,
        "attempt_count": attempt_count,
        "created_at": document.created_at,
    }


@app.get("/documents/{document_id}/questions")
def get_document_questions(
    document_id: int,
    quiz_size: int = Query(default=10, ge=7, le=10),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_document = (
        db.query(SourceDocument.id)
        .filter(
            SourceDocument.id == document_id,
            SourceDocument.user_id == current_user.id,
        )
        .first()
    )
    if owned_document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    questions = (
        db.query(DocumentQuestion)
        .filter(
            DocumentQuestion.source_document_id == document_id,
            DocumentQuestion.user_id == current_user.id,
        )
        .order_by(func.random())
        .limit(quiz_size)
        .all()
    )
    return {
        "document_id": document_id,
        "total": len(questions),
        "questions": [
            {
                "id": question.id,
                "question": question.question_text,
                "options": question.options,
                "topic": question.topic,
                "subtopic": question.subtopic,
                "skill_type": question.skill_type,
                "difficulty": question.difficulty,
                "source_page": question.source_page,
            }
            for question in questions
        ],
    }


@app.post("/documents/{document_id}/quiz/submit")
def submit_document_quiz(
    document_id: int,
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not submission.answers:
        raise HTTPException(status_code=400, detail="No answers submitted.")
    question_ids = [answer.question_id for answer in submission.answers]
    questions = (
        db.query(DocumentQuestion)
        .filter(
            DocumentQuestion.id.in_(question_ids),
            DocumentQuestion.source_document_id == document_id,
            DocumentQuestion.user_id == current_user.id,
        )
        .all()
    )
    question_map = {question.id: question for question in questions}
    if len(question_map) != len(set(question_ids)):
        raise HTTPException(
            status_code=400,
            detail="One or more questions do not belong to this document.",
        )

    session = DocumentQuizSession(
        user_id=current_user.id,
        source_document_id=document_id,
        score=0.0,
    )
    db.add(session)
    db.flush()

    correct_count = 0
    results = []
    for answer in submission.answers:
        question = question_map[answer.question_id]
        is_correct = answer.selected_index == question.answer_index
        correct_count += int(is_correct)
        db.add(
            DocumentQuizResponse(
                session_id=session.id,
                question_id=question.id,
                selected_index=answer.selected_index,
                is_correct=is_correct,
            )
        )
        results.append(
            {
                "question_id": question.id,
                "question": question.question_text,
                "selected_index": answer.selected_index,
                "correct_index": question.answer_index,
                "is_correct": is_correct,
                "explanation": question.explanation,
                "topic": question.topic,
                "subtopic": question.subtopic,
                "skill_type": question.skill_type,
                "difficulty": question.difficulty,
                "source_page": question.source_page,
            }
        )

    score = round(correct_count / len(submission.answers) * 100, 2)
    session.score = score
    db.commit()
    return {
        "session_id": session.id,
        "document_id": document_id,
        "score_percentage": score,
        "total_questions": len(submission.answers),
        "correct_count": correct_count,
        "results": results,
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
            "question_count": (
                db.query(DocumentQuestion)
                .filter(
                    DocumentQuestion.source_document_id == doc.id,
                    DocumentQuestion.user_id == current_user.id,
                )
                .count()
            ),
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


@app.get("/diagnostics/matrix")
def get_diagnostic_matrix(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.services.diagnostic_service import MASTERY_THRESHOLD, compute_matrix

    return {
        "user_id": current_user.id,
        "threshold": MASTERY_THRESHOLD,
        "cells": [cell.model_dump() for cell in compute_matrix(db, current_user.id)],
    }


@app.get("/diagnostics/adaptive-questions")
def get_adaptive_questions(
    count: int = Query(default=10, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from backend.services.adaptive_service import build_remediation_quiz
    from backend.services.diagnostic_service import get_gap_cells

    gaps = get_gap_cells(db, current_user.id)
    if not gaps:
        raise HTTPException(
            status_code=422,
            detail="No diagnosed gaps yet; complete a quiz first.",
        )
    questions = build_remediation_quiz(db, current_user.id, gaps, count)
    if not questions:
        raise HTTPException(
            status_code=422,
            detail="No questions are available for the diagnosed gaps.",
        )
    return {
        "targeted_gaps": [cell.model_dump() for cell in gaps],
        "questions": [_question_payload(question) for question in questions],
    }
