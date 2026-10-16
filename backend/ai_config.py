"""Configuration for CogniTree's ML and retrieval-augmented generation layer."""

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent

# Support both the project-root .env used in local development and a backend
# .env used by common deployment layouts. Existing shell variables win.
load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_PERSIST_DIR = Path(
    os.getenv("CHROMA_PERSIST_DIR", str(BASE_DIR / "chroma_data"))
)
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
