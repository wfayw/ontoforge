import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkshopApp(Base):
    __tablename__ = "workshop_apps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default="AppstoreOutlined")
    layout: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    variables: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class WorkshopWidget(Base):
    __tablename__ = "workshop_widgets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    app_id: Mapped[str] = mapped_column(String(36), ForeignKey("workshop_apps.id", ondelete="CASCADE"), nullable=False, index=True)
    widget_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    position: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    data_binding: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
