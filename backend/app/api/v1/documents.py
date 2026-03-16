from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.document import (
    DocumentCreate, DocumentResponse, DocumentDetailResponse,
    DocumentSearchRequest, DocumentSearchResult,
)
from app.services.auth_service import get_current_user, require_editor
from app.services.audit_service import create_audit_log
from app.services.rag_service import (
    upload_document, search_documents, get_document,
    list_documents, delete_document,
)

router = APIRouter()


@router.get("/", response_model=list[DocumentResponse])
async def list_docs(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    docs = await list_documents(db)
    return docs


@router.post("/", response_model=DocumentResponse, status_code=201)
async def create_doc(data: DocumentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    doc = await upload_document(db, name=data.name, content=data.content, description=data.description, metadata=data.metadata)
    await create_audit_log(db, user, "create_doc", "document", doc.id, {"name": doc.name})
    return doc


@router.get("/{doc_id}", response_model=DocumentDetailResponse)
async def get_doc(doc_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    doc = await get_document(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_doc(doc_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    doc = await get_document(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await create_audit_log(db, user, "delete_doc", "document", doc_id, {"name": doc.name})
    await delete_document(db, doc_id)


@router.post("/search", response_model=list[DocumentSearchResult])
async def search_docs(data: DocumentSearchRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    results = await search_documents(db, query=data.query, limit=data.limit)
    return results
