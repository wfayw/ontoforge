export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface PropertyDefinition {
  id: string;
  object_type_id: string;
  name: string;
  display_name: string;
  data_type: string;
  description: string | null;
  required: boolean;
  indexed: boolean;
  order: number;
}

export interface ObjectType {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  color: string;
  primary_key_property: string | null;
  created_at: string;
  updated_at: string;
  properties: PropertyDefinition[];
}

export interface LinkType {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  source_type_id: string;
  target_type_id: string;
  cardinality: string;
  created_at: string;
}

export interface ObjectInstance {
  id: string;
  object_type_id: string;
  display_name: string | null;
  properties: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkInstance {
  id: string;
  link_type_id: string;
  source_id: string;
  target_id: string;
  properties: Record<string, unknown>;
  created_at: string;
}

export interface ActionType {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  object_type_id: string | null;
  parameters: Record<string, unknown>;
  logic_type: string;
  logic_config: Record<string, unknown>;
  created_at: string;
}

export interface DataSource {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  status: string;
  last_synced_at: string | null;
  created_at: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  source_id: string;
  target_object_type_id: string;
  field_mappings: Record<string, string>;
  transform_steps: TransformStep[];
  schedule: string | null;
  schedule_config: Record<string, unknown> | null;
  sync_mode: string;
  primary_key_property: string | null;
  status: string;
  created_at: string;
}

export interface TransformStep {
  operation: string;
  [key: string]: unknown;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status: string;
  rows_processed: number;
  rows_failed: number;
  rows_created: number;
  rows_updated: number;
  rows_skipped: number;
  error_log: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface DataPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  total_count: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  default_model: string;
  is_active: boolean;
  created_at: string;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  llm_provider_id: string | null;
  model_name: string | null;
  temperature: number;
  tools: string[];
  status: string;
  created_at: string;
}

export interface AIPFunction {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  prompt_template: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  llm_provider_id: string | null;
  model_name: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string | null;
  title: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
