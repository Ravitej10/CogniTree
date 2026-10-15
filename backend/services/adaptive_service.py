"""Select remediation questions for a student's diagnosed weak cells."""

import random

from sqlalchemy.orm import Session

from backend.ai_schemas import MatrixCell
from backend.models import Question, QuizSession, Response


def build_remediation_quiz(
    db: Session,
    user_id: int,
    gap_cells: list[MatrixCell],
    target_count: int = 10,
) -> list[Question]:
    attempted_ids = {
        question_id
        for (question_id,) in (
            db.query(Response.question_id)
            .join(QuizSession, QuizSession.id == Response.session_id)
            .filter(QuizSession.user_id == user_id)
            .all()
        )
    }
    candidates: list[Question] = []
    for cell in gap_cells:
        candidates.extend(
            db.query(Question)
            .filter(
                Question.topic == cell.topic,
                Question.skill_type == cell.skill_type,
            )
            .all()
        )
    unique = {question.id: question for question in candidates}
    fresh = [question for question in unique.values() if question.id not in attempted_ids]
    repeated = [question for question in unique.values() if question.id in attempted_ids]
    random.shuffle(fresh)
    random.shuffle(repeated)
    return (fresh + repeated)[: max(1, min(target_count, 20))]

