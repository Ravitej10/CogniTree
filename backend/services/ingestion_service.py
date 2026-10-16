"""Document extraction, chunking, and vector indexing for the RAG pipeline."""

from pathlib import Path

from backend.ai_config import CHUNK_OVERLAP, CHUNK_SIZE
from backend.services.vector_store import add_chunks


class IngestionError(Exception):
    pass


def extract_pages(file_path: str) -> list[tuple[int, str]]:
    path = Path(file_path)
    if not path.exists():
        raise IngestionError(f"File not found: {file_path}")

    if path.suffix.lower() in {".txt", ".md", ".csv", ".json"}:
        text = path.read_text(encoding="utf-8", errors="ignore").strip()
        pages = [(1, text)] if text else []
    elif path.suffix.lower() == ".pdf":
        extracted: list[str] = []
        try:
            import pypdf

            reader = pypdf.PdfReader(str(path))
            extracted = [(page.extract_text() or "").strip() for page in reader.pages]
            if not any(extracted):
                raise ValueError("PyPDF found no extractable text")
        except Exception as first_error:
            try:
                import pdfplumber

                with pdfplumber.open(path) as pdf:
                    extracted = [(page.extract_text() or "").strip() for page in pdf.pages]
            except Exception as second_error:
                raise IngestionError(
                    f"PDF extraction failed: {first_error}; fallback failed: {second_error}"
                ) from second_error
        pages = [(number, text) for number, text in enumerate(extracted, start=1) if text]
    else:
        raise IngestionError(f"Unsupported file type: {path.suffix}")

    if not pages:
        raise IngestionError(
            f"No extractable text found in {path.name}; scanned PDFs require OCR."
        )
    return pages


def extract_text(file_path: str) -> str:
    """Compatibility helper for callers that only need flattened document text."""
    return "\n\n".join(text for _, text in extract_pages(file_path))


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


def chunk_pages(pages: list[tuple[int, str]]) -> list[dict]:
    return [
        {"text": chunk, "source_page": page_number}
        for page_number, page_text in pages
        for chunk in chunk_text(page_text)
    ]


def ingest_document(user_id: int, document_id: int, file_path: str) -> int:
    chunks = chunk_pages(extract_pages(file_path))
    if not chunks:
        raise IngestionError("Chunking produced no usable content.")
    return add_chunks(user_id, document_id, chunks)
