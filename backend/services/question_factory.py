"""Grounded MCQ generation using retrieved document chunks and Gemini."""

import json
import random
import re

from pydantic import ValidationError
from sqlalchemy.orm import Session

from backend.ai_config import GEMINI_API_KEY, GEMINI_MODEL
from backend.ai_schemas import GeneratedQuestion
from backend.models import Question, SourceDocument
from backend.services.vector_store import get_document_chunks, query_by_topic


_gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        _gemini_model = genai.GenerativeModel(model_name=GEMINI_MODEL)
    except Exception as exc:
        print(f"[QuestionFactory] Gemini unavailable; using grounded fallback: {exc}")


def _gemini_json(prompt: str) -> dict | None:
    if _gemini_model is None:
        return None
    try:
        response = _gemini_model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        text = re.sub(r"^```json\s*|\s*```$", "", response.text.strip())
        value = json.loads(text)
        return value[0] if isinstance(value, list) and value else value
    except Exception as exc:
        print(f"[QuestionFactory] Gemini generation warning: {exc}")
        return None


def _fallback(chunk: str, topic: str, subtopic: str) -> GeneratedQuestion:
    sentences = [
        sentence.strip()
        for sentence in re.split(r"[.!?]\s+", chunk)
        if len(sentence.strip()) > 35
    ]
    statement = sentences[0] if sentences else chunk[:220].strip()
    correct = statement[:180]
    options = [
        correct,
        f"It reverses the standard behavior described for {topic}.",
        f"It applies only when {topic} has no constraints or dependencies.",
        f"It is unrelated to the mechanism described in this material.",
    ]
    random.shuffle(options)
    return GeneratedQuestion(
        topic=topic,
        subtopic=subtopic,
        skill_type="application" if len(sentences) > 2 else "memorization",
        question_text=f"Which statement about {subtopic} is supported by the uploaded material?",
        options=options,
        answer_index=options.index(correct),
        explanation=f"The source material states: {statement}",
    )


def generate_question(
    user_id: int,
    topic: str,
    subtopic: str,
    document_id: int | None = None,
    context_chunk: str | None = None,
) -> GeneratedQuestion | None:
    if context_chunk:
        chunks = [context_chunk]
    else:
        hits = query_by_topic(user_id, f"{topic} {subtopic}", 3, document_id)
        chunks = [hit["text"] for hit in hits]
    if not chunks:
        return None

    context = "\n\n".join(chunks)[:4000]
    prompt = f"""Create one multiple-choice assessment question using only this context:
---
{context}
---
Topic: {topic}
Subtopic: {subtopic}
Return JSON with exactly these keys: topic, subtopic, skill_type, question_text,
options, answer_index, explanation. options must contain exactly four distinct
strings; answer_index must be 0-3; skill_type must be memorization or application.
Do not introduce facts absent from the context."""
    raw = _gemini_json(prompt)
    if raw:
        raw["topic"] = topic
        raw["subtopic"] = subtopic
        try:
            return GeneratedQuestion.model_validate(raw)
        except ValidationError as exc:
            print(f"[QuestionFactory] Invalid model output; using fallback: {exc}")
    return _fallback(chunks[0], topic, subtopic)


def _store(db: Session, generated: GeneratedQuestion) -> Question:
    question = Question(
        question_text=generated.question_text,
        option_a=generated.options[0],
        option_b=generated.options[1],
        option_c=generated.options[2],
        option_d=generated.options[3],
        correct_answer=generated.options[generated.answer_index],
        topic=generated.topic,
        concept=generated.subtopic,
        skill_type=generated.skill_type,
    )
    db.add(question)
    db.flush()
    return question


def generate_from_document(
    db: Session,
    user_id: int,
    document_id: int,
    count: int = 5,
    topic: str | None = None,
    subtopic: str | None = None,
) -> list[Question]:
    document = (
        db.query(SourceDocument)
        .filter(
            SourceDocument.id == document_id,
            SourceDocument.user_id == user_id,
        )
        .first()
    )
    if document is None:
        return []
    chunks = get_document_chunks(user_id, document_id)
    if not chunks:
        return []

    chosen = chunks if len(chunks) <= count else random.sample(chunks, count)
    title = document.filename.rsplit(".", 1)[0].replace("_", " ").strip()
    created = []
    for index, chunk in enumerate(chosen[:count], start=1):
        generated = generate_question(
            user_id=user_id,
            topic=topic or title[:80],
            subtopic=subtopic or f"Section {index}",
            document_id=document_id,
            context_chunk=chunk,
        )
        if generated:
            created.append(_store(db, generated))
    db.commit()
    for question in created:
        db.refresh(question)
    return created

