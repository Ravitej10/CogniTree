"""Validated data contracts returned by the LLM question factory."""

from typing import Literal

from pydantic import BaseModel, Field


class GeneratedQuestion(BaseModel):
    question_text: str = Field(min_length=10)
    options: list[str] = Field(min_length=4, max_length=4)
    answer_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=1)
    topic: str = Field(min_length=1)
    subtopic: str = Field(min_length=1)
    skill_type: Literal["memorization", "application"]


class GenerateQuestionsRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=20)
    topic: str | None = None
    subtopic: str | None = None


class RetrievalHit(BaseModel):
    text: str
    document_id: int
    chunk_index: int
    distance: float | None = None


class MatrixCell(BaseModel):
    topic: str
    skill_type: str
    correct: int
    attempted: int
    accuracy: float
    is_gap: bool
