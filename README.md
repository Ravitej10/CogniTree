# CogniTree

CogniTree is an AI-powered diagnostic and adaptive study platform designed to pinpoint student knowledge gaps and deliver precision remediation.

Instead of generic scores, the system evaluates student responses across a multi-dimensional diagnostic matrix (Topic × Cognitive Skill). When deficits below a 70% threshold are detected, an adaptive learning loop automatically generates targeted practice sessions to help students master weak concepts.

## Core Modules
1. **RAG Ingestion Pipeline:** Extracts, chunks, and embeds course notes and syllabus documents into a searchable vector index.
2. **AI Question Generation:** Generates grounded multiple-choice questions with strict schema validation using Gemini.
3. **Student Test Engine:** Delivers interactive assessments while tracking timing and response behavior.
4. **Diagnostic Analytics:** Computes live concept-by-skill mastery matrices to isolate specific learning gaps.
5. **Adaptive Remediation:** Dynamically serves personalized practice questions targeting identified weaknesses.

## Tech Stack
- **Backend:** Python, FastAPI, PostgreSQL
- **Frontend:** Next.js, React, Tailwind CSS
- **AI & Processing:** Google Gemini API, LangChain, ChromaDB, SentenceTransformers

## AI/RAG setup

Install the main environment and the AI-specific dependencies:

```bash
pip install -r requirements.txt
pip install -r requirements-ai.txt
```

Copy `backend/env.example` to `.env` (or export the variables in your shell),
then set `GOOGLE_API_KEY` to enable Gemini. Without a working key, document
ingestion and retrieval still work, but question generation returns a clear error.

The integrated pipeline is:

1. `backend/services/ingestion_service.py` extracts and chunks PDF/text files.
2. `backend/services/vector_store.py` indexes user-scoped chunks in ChromaDB
   and maintains a SQLite keyword-search fallback.
3. `backend/services/question_factory.py` retrieves document context and creates
   schema-validated questions with Gemini. Invalid or failed generations are not stored.
4. `backend/services/diagnostic_service.py` and `adaptive_service.py` identify
   weak topic/skill cells and select targeted remediation questions.

Useful authenticated endpoints include:

- `GET /rag/search?query=...`
- `POST /documents/{document_id}/generate-questions`
- `GET /diagnostics/matrix`
- `GET /diagnostics/adaptive-questions`
