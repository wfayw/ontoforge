import uuid
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ObjectType(Base):
    __tablename__ = "object_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[str] = mapped_column(String(64), default="cube")
    color: Mapped[str] = mapped_column(String(32), default="#4A90D9")
    primary_key_property: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    properties: Mapped[list["PropertyDefinition"]] = relationship(
        back_populates="object_type", cascade="all, delete-orphan", lazy="selectin"
    )
    source_link_types: Mapped[list["LinkType"]] = relationship(
        foreign_keys="LinkType.source_type_id", back_populates="source_type", lazy="selectin"
    )
    target_link_types: Mapped[list["LinkType"]] = relationship(
        foreign_keys="LinkType.target_type_id", back_populates="target_type", lazy="selectin"
    )


class PropertyDefinition(Base):
    __tablename__ = "property_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    object_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    indexed: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)

    object_type: Mapped["ObjectType"] = relationship(back_populates="properties")


class LinkType(Base):
    __tablename__ = "link_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id"), nullable=False)
    target_type_id: Mapped[str] = mapped_column(String(36), ForeignKey("object_types.id"), nullable=False)
    cardinality: Mapped[str] = mapped_column(String(32), default="many_to_many")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    source_type: Mapped["ObjectType"] = relationship(foreign_keys=[source_type_id], back_populates="source_link_types")
    target_type: Mapped["ObjectType"] = relationship(foreign_keys=[target_type_id], back_populates="target_link_types")


class ActionType(Base):
    __tablename__ = "action_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    object_type_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("object_types.id"), nullable=True)
    parameters: Mapped[dict] = mapped_column(JSON, default=dict)
    logic_type: Mapped[str] = mapped_column(String(32), default="webhook")
    logic_config: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class FunctionDef(Base):
    __tablename__ = "function_defs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    output_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    implementation_type: Mapped[str] = mapped_column(String(32), default="python")
    implementation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
