"""Document extraction, chunking, and vector indexing for the RAG pipeline."""

from pathlib import Path

from backend.ai_config import CHUNK_OVERLAP, CHUNK_SIZE
from backend.services.vector_store import add_chunks


class IngestionError(Exception):
    pass


def extract_text(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise IngestionError(f"File not found: {file_path}")

    if path.suffix.lower() in {".txt", ".md", ".csv", ".json"}:
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
    elif path.suffix.lower() == ".pdf":
        pages: list[str] = []
        try:
            import pypdf

            reader = pypdf.PdfReader(str(path))
            pages = [(page.extract_text() or "").strip() for page in reader.pages]
        except Exception as first_error:
            try:
                import pdfplumber

                with pdfplumber.open(path) as pdf:
                    pages = [(page.extract_text() or "").strip() for page in pdf.pages]
            except Exception as second_error:
                raise IngestionError(
                    f"PDF extraction failed: {first_error}; fallback failed: {second_error}"
                ) from second_error
        text = "\n\n".join(page for page in pages if page).strip()
    else:
        raise IngestionError(f"Unsupported file type: {path.suffix}")

    if not text:
        raise IngestionError(
            f"No extractable text found in {path.name}; scanned PDFs require OCR."
        )
    return text


def chunk_text(raw_text: str) -> list[str]:
    if not raw_text.strip():
        return []
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )
        return [chunk.strip() for chunk in splitter.split_text(raw_text) if chunk.strip()]
    except Exception:
        step = max(1, CHUNK_SIZE - CHUNK_OVERLAP)
        return [
            raw_text[start : start + CHUNK_SIZE].strip()
            for start in range(0, len(raw_text), step)
            if raw_text[start : start + CHUNK_SIZE].strip()
        ]


def ingest_document(user_id: int, document_id: int, file_path: str) -> int:
    text = extract_text(file_path)
    chunks = chunk_text(text)
    if not chunks:
        raise IngestionError("Chunking produced no usable content.")
    return add_chunks(user_id, document_id, chunks)

