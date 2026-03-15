import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, Index, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ObjectInstance(Base):
    __tablename__ = "object_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    object_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    properties: Mapped[dict] = mapped_column(JSON, default=dict)
    source_pipeline_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    source_run_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    source_row_index: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class LinkInstance(Base):
    __tablename__ = "link_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    link_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("link_types.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    properties: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
