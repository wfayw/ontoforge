from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ObjectInstanceCreate(BaseModel):
    object_type_id: str
    display_name: Optional[str] = None
    properties: dict = Field(default_factory=dict)


class ObjectInstanceUpdate(BaseModel):
    display_name: Optional[str] = None
    properties: Optional[dict] = None


class ObjectInstanceResponse(BaseModel):
    id: str
    object_type_id: str
    display_name: Optional[str]
    properties: dict
    source_pipeline_id: Optional[str] = None
    source_run_id: Optional[str] = None
    source_row_index: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LinkInstanceCreate(BaseModel):
    link_type_id: str
    source_id: str
    target_id: str
    properties: dict = Field(default_factory=dict)


class LinkInstanceResponse(BaseModel):
    id: str
    link_type_id: str
    source_id: str
    target_id: str
    properties: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class ObjectSearchParams(BaseModel):
    object_type_id: Optional[str] = None
    query: Optional[str] = None
    filters: Optional[dict] = None
    page: int = 1
    page_size: int = 50
