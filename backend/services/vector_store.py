"""User-scoped vector storage with a local keyword-search fallback.

ChromaDB and SentenceTransformers provide semantic retrieval when available.
The SQLite copy keeps ingestion and basic retrieval usable if the embedding
runtime or model is unavailable.
"""

import math
import re
import sqlite3

from backend.ai_config import CHROMA_PERSIST_DIR, EMBEDDING_MODEL


CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
_DB_PATH = CHROMA_PERSIST_DIR / "rag_chunks.db"


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(_DB_PATH)
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            document_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL
        )
        """
    )
    connection.commit()
    return connection


_chroma_collection = None
try:
    import chromadb
    from chromadb.utils import embedding_functions

    _chroma_client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    _embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=EMBEDDING_MODEL
    )
    _chroma_collection = _chroma_client.get_or_create_collection(
        name="user_course_chunks",
        embedding_function=_embedding_fn,
    )
except Exception as exc:
    print(f"[VectorStore] Semantic index unavailable; using keyword fallback: {exc}")


def add_chunks(user_id: int, document_id: int, chunks: list[str]) -> int:
    """Replace and index all chunks belonging to one user's document."""
    if not chunks:
        return 0

    ids = [f"user{user_id}-doc{document_id}-chunk{i}" for i in range(len(chunks))]
    metadatas = [
        {"user_id": user_id, "document_id": document_id, "chunk_index": i}
        for i in range(len(chunks))
    ]

    with _connect() as connection:
        connection.execute(
            "DELETE FROM chunks WHERE user_id = ? AND document_id = ?",
            (user_id, document_id),
        )
        connection.executemany(
            "INSERT INTO chunks (id, user_id, document_id, chunk_index, content) "
            "VALUES (?, ?, ?, ?, ?)",
            [
                (ids[i], user_id, document_id, i, chunk)
                for i, chunk in enumerate(chunks)
            ],
        )

    if _chroma_collection is not None:
        try:
            scope = {
                "$and": [
                    {"user_id": {"$eq": user_id}},
                    {"document_id": {"$eq": document_id}},
                ]
            }
            existing = _chroma_collection.get(where=scope)
            if existing.get("ids"):
                _chroma_collection.delete(ids=existing["ids"])
            _chroma_collection.add(ids=ids, documents=chunks, metadatas=metadatas)
        except Exception as exc:
            print(f"[VectorStore] Chroma write warning: {exc}")

    return len(chunks)


def _where(user_id: int, document_id: int | None) -> dict:
    if document_id is None:
        return {"user_id": {"$eq": user_id}}
    return {
        "$and": [
            {"user_id": {"$eq": user_id}},
            {"document_id": {"$eq": document_id}},
        ]
    }


def query_by_topic(
    user_id: int,
    topic_keywords: str,
    n_results: int = 5,
    document_id: int | None = None,
) -> list[dict]:
    """Retrieve relevant chunks, always restricted to the authenticated user."""
    limit = max(1, min(n_results, 20))
    if _chroma_collection is not None:
        try:
            results = _chroma_collection.query(
                query_texts=[topic_keywords],
                n_results=limit,
                where=_where(user_id, document_id),
            )
            documents = results.get("documents", [[]])[0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]
            if documents:
                return [
                    {
                        "text": text,
                        "document_id": int(meta["document_id"]),
                        "chunk_index": int(meta["chunk_index"]),
                        "distance": float(distance),
                    }
                    for text, meta, distance in zip(documents, metadatas, distances)
                ]
        except Exception as exc:
            print(f"[VectorStore] Chroma query warning: {exc}")

    sql = "SELECT document_id, chunk_index, content FROM chunks WHERE user_id = ?"
    params: list[int] = [user_id]
    if document_id is not None:
        sql += " AND document_id = ?"
        params.append(document_id)
    with _connect() as connection:
        rows = connection.execute(sql, params).fetchall()

    query_tokens = set(re.findall(r"\w+", topic_keywords.lower()))
    ranked = []
    for row_document_id, chunk_index, content in rows:
        lowered = content.lower()
        score = sum(
            1.0 + math.log(lowered.count(token))
            for token in query_tokens
            if lowered.count(token)
        )
        ranked.append((score, row_document_id, chunk_index, content))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "text": content,
            "document_id": row_document_id,
            "chunk_index": chunk_index,
            "distance": None,
        }
        for _, row_document_id, chunk_index, content in ranked[:limit]
    ]


def get_document_chunks(user_id: int, document_id: int) -> list[str]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT content FROM chunks WHERE user_id = ? AND document_id = ? "
            "ORDER BY chunk_index",
            (user_id, document_id),
        ).fetchall()
    return [row[0] for row in rows]

