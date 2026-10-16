"""Grounded MCQ generation using retrieved document chunks and Gemini."""

import json
import random
import re

from pydantic import ValidationError
from sqlalchemy.orm import Session

from backend.ai_config import GEMINI_API_KEY, GEMINI_MODEL
from backend.ai_schemas import GeneratedQuestion
from backend.models import DocumentQuestion, SourceDocument
from backend.services.vector_store import get_document_chunks


_gemini_models = {}
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
    except Exception as exc:
        print(f"[QuestionFactory] Gemini unavailable: {exc}")
        genai = None
else:
    genai = None


class GeminiUnavailableError(RuntimeError):
    pass


class GeminiBusyError(RuntimeError):
    pass


def gemini_is_configured() -> bool:
    return genai is not None and bool(GEMINI_API_KEY)


def _get_gemini_model(model_name: str):
    if not gemini_is_configured():
        return None
    if model_name not in _gemini_models:
        _gemini_models[model_name] = genai.GenerativeModel(model_name=model_name)
    return _gemini_models[model_name]


def _gemini_json(prompt: str, model_name: str):
    model = _get_gemini_model(model_name)
    if model is None:
        return None
    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"},
        )
        text = re.sub(r"^```json\s*|\s*```$", "", response.text.strip())
        return json.loads(text)
    except Exception as exc:
        print(f"[QuestionFactory] Gemini generation warning: {exc}")
        raise GeminiBusyError(
            "Gemini could not complete the request and may be busy or rate-limited. "
            "Try again shortly or select a different model."
        ) from exc


def _batch_prompt(
    contexts: str,
    count: int,
    topic: str,
    subtopic: str | None,
    excluded_questions: list[str] | None = None,
) -> str:
    exclusions = ""
    if excluded_questions:
        exclusions = "\nDo not repeat these existing questions:\n- " + "\n- ".join(
            excluded_questions
        )
    return f"""Create exactly {count} distinct multiple-choice assessment questions
using only the labeled PDF excerpts below.

{contexts}

Topic: {topic}
{f'Subtopic preference: {subtopic}' if subtopic else ''}

Return ONLY a JSON array. Every array item must contain exactly these keys:
topic, subtopic, skill_type, difficulty, source_page, question_text, options,
answer_index, explanation.

Rules:
- options contains exactly four distinct, plausible answers.
- answer_index is an integer from 0 through 3.
- skill_type is either "memorization" or "application".
- difficulty is "easy", "medium", or "hard".
- source_page must match the SOURCE_PAGE label of the excerpt supporting it,
  or null when that label is unknown.
- Every question has exactly one unambiguous correct answer.
- Do not introduce facts absent from the excerpts.{exclusions}"""


def _validate_batch(
    raw,
    target_count: int,
    topic: str,
    subtopic: str | None,
    source_pages: list[int],
    existing_texts: set[str] | None = None,
) -> list[GeneratedQuestion]:
    items = raw.get("questions", []) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return []
    seen = set(existing_texts or set())
    valid = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        item["topic"] = topic
        item.setdefault("subtopic", subtopic or f"Section {index + 1}")
        page = item.get("source_page")
        if not source_pages or page not in source_pages:
            item["source_page"] = source_pages[index % len(source_pages)] if source_pages else None
        try:
            question = GeneratedQuestion.model_validate(item)
            normalized_options = [option.strip().casefold() for option in question.options]
            normalized_text = question.question_text.strip().casefold()
            if len(set(normalized_options)) != 4 or normalized_text in seen:
                continue
            seen.add(normalized_text)
            valid.append(question)
        except (ValidationError, AttributeError) as exc:
            print(f"[QuestionFactory] Invalid Gemini batch item skipped: {exc}")
        if len(valid) >= target_count:
            break
    return valid


def _store(
    db: Session,
    generated: GeneratedQuestion,
    user_id: int,
    document_id: int,
) -> DocumentQuestion:
    question = DocumentQuestion(
        user_id=user_id,
        source_document_id=document_id,
        question_text=generated.question_text,
        options=generated.options,
        answer_index=generated.answer_index,
        explanation=generated.explanation,
        topic=generated.topic,
        subtopic=generated.subtopic,
        skill_type=generated.skill_type,
        difficulty=generated.difficulty,
        source_page=generated.source_page,
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
    model_name: str = GEMINI_MODEL,
) -> list[DocumentQuestion]:
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
    if not gemini_is_configured():
        raise GeminiUnavailableError(
            "Gemini is not configured. Set GOOGLE_API_KEY in the project .env and restart the backend."
        )
    chunks = get_document_chunks(user_id, document_id)
    if not chunks:
        return []

    target_count = max(1, min(count, 10))
    chosen = random.sample(chunks, min(len(chunks), target_count))
    # Short documents may contain fewer chunks than the requested question-bank
    # size. Reuse their grounding context so the LLM can create multiple
    # assessment angles while still keeping every question tied to the PDF.
    while len(chosen) < target_count:
        chosen.append(random.choice(chunks))
    title = document.filename.rsplit(".", 1)[0].replace("_", " ").strip()
    question_topic = topic or title[:80]
    contexts = "\n\n".join(
        f"[EXCERPT {index} | SOURCE_PAGE {chunk.get('source_page') or 'unknown'}]\n"
        f"{chunk['text']}"
        for index, chunk in enumerate(chosen, start=1)
    )[:12000]
    source_pages = sorted(
        {chunk["source_page"] for chunk in chosen if chunk.get("source_page") is not None}
    )

    # Normal path: one request returns the full question bank addition.
    raw = _gemini_json(
        _batch_prompt(contexts, target_count, question_topic, subtopic),
        model_name,
    )
    generated_questions = _validate_batch(
        raw,
        target_count,
        question_topic,
        subtopic,
        source_pages,
    )

    # At most one repair/top-up request is made when Gemini returns malformed,
    # duplicate, or fewer items than requested.
    missing_count = target_count - len(generated_questions)
    if missing_count > 0:
        existing_texts = {question.question_text.strip().casefold() for question in generated_questions}
        repair_raw = _gemini_json(
            _batch_prompt(
                contexts,
                missing_count,
                question_topic,
                subtopic,
                [question.question_text for question in generated_questions],
            ),
            model_name,
        )
        generated_questions.extend(
            _validate_batch(
                repair_raw,
                missing_count,
                question_topic,
                subtopic,
                source_pages,
                existing_texts,
            )
        )

    created = [
        _store(db, generated, user_id, document_id)
        for generated in generated_questions[:target_count]
    ]
    db.commit()
    for question in created:
        db.refresh(question)
    return created
