import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    object_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False, index=True)
    condition: Mapped[dict] = mapped_column(JSON, nullable=False)
    severity: Mapped[str] = mapped_column(String(16), default="warning")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False, index=True)
    object_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
