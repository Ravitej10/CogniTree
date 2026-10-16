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
    difficulty: Literal["easy", "medium", "hard"]
    source_page: int | None = Field(default=None, ge=1)


class GenerateQuestionsRequest(BaseModel):
    count: int = Field(default=5, ge=5, le=10)
    topic: str | None = None
    subtopic: str | None = None
    model: Literal[
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-pro-preview",
    ] = "gemini-3.8-flash"


class RetrievalHit(BaseModel):
    text: str
    document_id: int
    chunk_index: int
    distance: float | None = None
    source_page: int | None = Field(default=None, ge=1)


class MatrixCell(BaseModel):
    topic: str
    skill_type: str
    correct: int
    attempted: int
    accuracy: float
    is_gap: bool
