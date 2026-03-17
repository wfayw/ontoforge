from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class LLMProviderCreate(BaseModel):
    name: str
    provider_type: str
    base_url: str
    api_key: Optional[str] = None
    default_model: str


class LLMProviderResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    base_url: str
    default_model: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AIAgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: str
    llm_provider_id: Optional[str] = None
    model_name: Optional[str] = None
    temperature: float = 0.7
    tools: list[str] = Field(default_factory=list)


class AIAgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_provider_id: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    tools: Optional[list[str]] = None
    status: Optional[str] = None


class AIAgentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    system_prompt: str
    llm_provider_id: Optional[str]
    model_name: Optional[str]
    temperature: float
    tools: list
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AIPFunctionCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None
    prompt_template: str
    input_schema: dict = Field(default_factory=dict)
    output_schema: dict = Field(default_factory=dict)
    llm_provider_id: Optional[str] = None
    model_name: Optional[str] = None


class AIPFunctionResponse(BaseModel):
    id: str
    name: str
    display_name: str
    description: Optional[str]
    prompt_template: str
    input_schema: dict
    output_schema: dict
    llm_provider_id: Optional[str]
    model_name: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class LLMProviderUpdate(BaseModel):
    name: Optional[str] = None
    provider_type: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    default_model: Optional[str] = None
    is_active: Optional[bool] = None


class AIPFunctionUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    prompt_template: Optional[str] = None
    llm_provider_id: Optional[str] = None
    model_name: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    agent_id: Optional[str] = None
    conversation_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessage
    tool_calls: list[dict] = Field(default_factory=list)


class ConversationResponse(BaseModel):
    id: str
    agent_id: Optional[str]
    title: Optional[str]
    messages: list[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NLQueryRequest(BaseModel):
    query: str
    object_type_id: Optional[str] = None


class NLQueryResponse(BaseModel):
    interpreted_query: str
    results: list[dict]
    sql_generated: Optional[str] = None
