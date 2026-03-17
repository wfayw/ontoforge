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
    side_effects: list = []


class ActionTypeResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    object_type_id: Optional[str]
    parameters: dict
    logic_type: str
    logic_config: dict
    side_effects: list = []
    created_at: datetime

    model_config = {"from_attributes": True}


class LinkTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    cardinality: Optional[str] = None


class ActionTypeUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    object_type_id: Optional[str] = None
    parameters: Optional[dict] = None
    logic_type: Optional[str] = None
    logic_config: Optional[dict] = None
    side_effects: Optional[list] = None


class PropertyDefinitionUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    required: Optional[bool] = None
    order: Optional[int] = None


class FunctionDefCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    input_schema: dict = {}
    output_schema: dict = {}
    implementation_type: str = "python"
    implementation: Optional[str] = None


class FunctionDefUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    input_schema: Optional[dict] = None
    output_schema: Optional[dict] = None
    implementation: Optional[str] = None


class FunctionDefResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    input_schema: dict
    output_schema: dict
    implementation_type: str
    implementation: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class FunctionExecuteRequest(BaseModel):
    inputs: dict = {}


class OntologyGenerateRequest(BaseModel):
    description: str
    provider_id: Optional[str] = None


class OntologyGeneratePreview(BaseModel):
    plan: dict


class OntologyApplyRequest(BaseModel):
    plan: dict
