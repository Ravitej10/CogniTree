"""Convert response history into topic-by-skill mastery cells."""

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.ai_schemas import MatrixCell
from backend.models import Question, QuizSession, Response


MASTERY_THRESHOLD = 0.70


def compute_matrix(db: Session, user_id: int) -> list[MatrixCell]:
    rows = (
        db.query(
            Question.topic,
            Question.skill_type,
            func.count(Response.id).label("attempted"),
            func.sum(case((Response.is_correct.is_(True), 1), else_=0)).label("correct"),
        )
        .join(Response, Response.question_id == Question.id)
        .join(QuizSession, QuizSession.id == Response.session_id)
        .filter(QuizSession.user_id == user_id)
        .group_by(Question.topic, Question.skill_type)
        .all()
    )
    cells = []
    for topic, skill_type, attempted, correct in rows:
        correct = int(correct or 0)
        attempted = int(attempted or 0)
        accuracy = correct / attempted if attempted else 0.0
        cells.append(
            MatrixCell(
                topic=topic,
                skill_type=(
                    skill_type.value if hasattr(skill_type, "value") else str(skill_type)
                ),
                correct=correct,
                attempted=attempted,
                accuracy=round(accuracy, 3),
                is_gap=accuracy < MASTERY_THRESHOLD,
            )
        )
    return cells


def get_gap_cells(db: Session, user_id: int) -> list[MatrixCell]:
    return [cell for cell in compute_matrix(db, user_id) if cell.is_gap]

