"""Configuration for CogniTree's ML and retrieval-augmented generation layer."""

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "50"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
CHROMA_PERSIST_DIR = Path(
    os.getenv("CHROMA_PERSIST_DIR", str(BASE_DIR / "chroma_data"))
)
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

