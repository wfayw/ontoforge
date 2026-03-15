from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PropertyDefinitionCreate(BaseModel):
    name: str
    display_name: str
    data_type: str
    description: Optional[str] = None
    required: bool = False
    indexed: bool = False
    order: int = 0


class PropertyDefinitionResponse(PropertyDefinitionCreate):
    id: str
    object_type_id: str

    model_config = {"from_attributes": True}


class ObjectTypeCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    icon: str = "cube"
    color: str = "#4A90D9"
    primary_key_property: Optional[str] = None
    properties: list[PropertyDefinitionCreate] = []


class ObjectTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    primary_key_property: Optional[str] = None


class ObjectTypeResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    icon: str
    color: str
    primary_key_property: Optional[str]
    created_at: datetime
    updated_at: datetime
    properties: list[PropertyDefinitionResponse] = []

    model_config = {"from_attributes": True}


class LinkTypeCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    source_type_id: str
    target_type_id: str
    cardinality: str = "many_to_many"


class LinkTypeResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    source_type_id: str
    target_type_id: str
    cardinality: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActionTypeCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    object_type_id: Optional[str] = None
    parameters: dict = {}
    logic_type: str = "webhook"
    logic_config: dict = {}


class ActionTypeResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    object_type_id: Optional[str]
    parameters: dict
    logic_type: str
    logic_config: dict
    created_at: datetime

    model_config = {"from_attributes": True}
