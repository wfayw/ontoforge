from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DataSourceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    source_type: str
    connection_config: dict = {}


class DataSourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    connection_config: Optional[dict] = None


class DataSourceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    source_type: str
    status: str
    last_synced_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    source_id: str
    target_object_type_id: str
    field_mappings: dict = {}
    transform_steps: list = []
    schedule: Optional[str] = None
    schedule_config: Optional[dict] = None
    sync_mode: str = "full"
    primary_key_property: Optional[str] = None


class PipelineUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    field_mappings: Optional[dict] = None
    transform_steps: Optional[list] = None
    schedule: Optional[str] = None
    schedule_config: Optional[dict] = None
    sync_mode: Optional[str] = None
    primary_key_property: Optional[str] = None
    status: Optional[str] = None


class PipelineResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    source_id: str
    target_object_type_id: str
    field_mappings: dict
    transform_steps: list
    schedule: Optional[str]
    schedule_config: Optional[dict] = None
    sync_mode: str = "full"
    primary_key_property: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ScheduleRequest(BaseModel):
    type: str = "cron"
    cron: Optional[str] = None
    minutes: Optional[int] = None
    hours: Optional[int] = None
    seconds: Optional[int] = None


class PipelineRunResponse(BaseModel):
    id: str
    pipeline_id: str
    status: str
    rows_processed: int
    rows_failed: int
    rows_created: int = 0
    rows_updated: int = 0
    rows_skipped: int = 0
    error_log: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class DataPreview(BaseModel):
    columns: list[str]
    rows: list[dict]
    total_count: int
