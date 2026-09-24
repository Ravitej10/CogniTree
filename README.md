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