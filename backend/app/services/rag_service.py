import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping chunks at sentence boundaries when possible."""
    if len(text) <= chunk_size:
        return [text]

    sentences = re.split(r'(?<=[.!?。！？\n])\s*', text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if not sentence.strip():
            continue
        if len(current) + len(sentence) > chunk_size and current:
            chunks.append(current.strip())
            tail = current[-overlap:] if overlap else ""
            current = tail + sentence
        else:
            current += (" " if current else "") + sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks


async def upload_document(
    db: AsyncSession,
    name: str,
    content: str,
    description: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Document:
    chunks = chunk_text(content)
    doc = Document(
        name=name,
        description=description,
        content=content,
        chunks=chunks,
        chunk_count=len(chunks),
        file_size=len(content.encode("utf-8")),
        metadata_=metadata or {},
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return doc


async def search_documents(
    db: AsyncSession,
    query: str,
    limit: int = 5,
) -> list[dict]:
    """Keyword-based document search — returns top matching chunks."""
    keywords = [w.lower() for w in query.split() if len(w) >= 2]
    if not keywords:
        return []

    result = await db.execute(select(Document))
    all_docs = result.scalars().all()

    scored: list[tuple[float, str, str, str]] = []

    for doc in all_docs:
        for i, chunk in enumerate(doc.chunks):
            chunk_lower = chunk.lower()
            score = sum(chunk_lower.count(kw) for kw in keywords)
            if score > 0:
                scored.append((score, doc.id, doc.name, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {"document_id": s[1], "document_name": s[2], "chunk": s[3], "score": s[0]}
        for s in scored[:limit]
    ]


async def get_document(db: AsyncSession, doc_id: str) -> Optional[Document]:
    result = await db.execute(select(Document).where(Document.id == doc_id))
    return result.scalar_one_or_none()


async def list_documents(db: AsyncSession) -> list[Document]:
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    return list(result.scalars().all())


async def delete_document(db: AsyncSession, doc_id: str) -> bool:
    doc = await get_document(db, doc_id)
    if not doc:
        return False
    await db.delete(doc)
    return True
