import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    connection_config: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="inactive")
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Pipeline(Base):
    __tablename__ = "pipelines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_id: Mapped[str] = mapped_column(String(36), ForeignKey("data_sources.id"), nullable=False)
    target_object_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id"), nullable=False)
    field_mappings: Mapped[dict] = mapped_column(JSON, default=dict)
    transform_steps: Mapped[list] = mapped_column(JSON, default=list)
    schedule: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    schedule_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    sync_mode: Mapped[str] = mapped_column(String(16), default="full")
    primary_key_property: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pipeline_id: Mapped[str] = mapped_column(String(36), ForeignKey("pipelines.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    rows_processed: Mapped[int] = mapped_column(Integer, default=0)
    rows_failed: Mapped[int] = mapped_column(Integer, default=0)
    rows_created: Mapped[int] = mapped_column(Integer, default=0)
    rows_updated: Mapped[int] = mapped_column(Integer, default=0)
    rows_skipped: Mapped[int] = mapped_column(Integer, default=0)
    error_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
