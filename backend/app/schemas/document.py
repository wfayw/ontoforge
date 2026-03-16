from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentCreate(BaseModel):
    name: str
    content: str
    description: Optional[str] = None
    metadata: Optional[dict] = None


class DocumentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    chunk_count: int
    file_size: int
    metadata_: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentDetailResponse(DocumentResponse):
    content: str
    chunks: list[str]


class DocumentSearchRequest(BaseModel):
    query: str
    limit: int = 5


class DocumentSearchResult(BaseModel):
    document_id: str
    document_name: str
    chunk: str
    score: float
