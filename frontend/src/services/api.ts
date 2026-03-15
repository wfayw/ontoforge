import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Ontology
export const ontologyApi = {
  listObjectTypes: () => api.get('/ontology/object-types'),
  createObjectType: (data: unknown) => api.post('/ontology/object-types', data),
  getObjectType: (id: string) => api.get(`/ontology/object-types/${id}`),
  updateObjectType: (id: string, data: unknown) => api.patch(`/ontology/object-types/${id}`, data),
  deleteObjectType: (id: string) => api.delete(`/ontology/object-types/${id}`),
  addProperty: (typeId: string, data: unknown) => api.post(`/ontology/object-types/${typeId}/properties`, data),
  deleteProperty: (propId: string) => api.delete(`/ontology/properties/${propId}`),
  listLinkTypes: () => api.get('/ontology/link-types'),
  createLinkType: (data: unknown) => api.post('/ontology/link-types', data),
  deleteLinkType: (id: string) => api.delete(`/ontology/link-types/${id}`),
  listActionTypes: () => api.get('/ontology/action-types'),
  createActionType: (data: unknown) => api.post('/ontology/action-types', data),
  deleteActionType: (id: string) => api.delete(`/ontology/action-types/${id}`),
  executeActionType: (id: string, params: Record<string, unknown>) => api.post(`/ontology/action-types/${id}/execute`, { params }),
  validateActionType: (id: string, params: Record<string, unknown>) => api.post(`/ontology/action-types/${id}/validate`, { params }),
};

// Instances
export const instanceApi = {
  listObjects: (params?: Record<string, unknown>) => api.get('/instances/objects', { params }),
  createObject: (data: unknown) => api.post('/instances/objects', data),
  getObject: (id: string) => api.get(`/instances/objects/${id}`),
  updateObject: (id: string, data: unknown) => api.patch(`/instances/objects/${id}`, data),
  deleteObject: (id: string) => api.delete(`/instances/objects/${id}`),
  getNeighbors: (id: string, depth?: number) => api.get(`/instances/objects/${id}/neighbors`, { params: { depth } }),
  getLineage: (id: string) => api.get(`/instances/objects/${id}/lineage`),
  listLinks: (params?: Record<string, unknown>) => api.get('/instances/links', { params }),
  createLink: (data: unknown) => api.post('/instances/links', data),
  deleteLink: (id: string) => api.delete(`/instances/links/${id}`),
  executeAction: (data: { action_type_id: string; params: Record<string, unknown>; dry_run?: boolean }) =>
    api.post('/instances/actions/execute', data),
  aggregate: (data: { object_type_id: string; metric: string; property_name?: string; group_by?: string; filters?: Record<string, unknown> }) =>
    api.post('/instances/objects/aggregate', data),
};

// Data Sources
export const dataSourceApi = {
  list: () => api.get('/data-sources/'),
  create: (data: unknown) => api.post('/data-sources/', data),
  get: (id: string) => api.get(`/data-sources/${id}`),
  update: (id: string, data: unknown) => api.patch(`/data-sources/${id}`, data),
  delete: (id: string) => api.delete(`/data-sources/${id}`),
  test: (id: string) => api.post(`/data-sources/${id}/test`),
  preview: (id: string, limit?: number) => api.get(`/data-sources/${id}/preview`, { params: { limit } }),
  uploadCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/data-sources/upload-csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Pipelines
export const pipelineApi = {
  list: () => api.get('/pipelines/'),
  create: (data: unknown) => api.post('/pipelines/', data),
  get: (id: string) => api.get(`/pipelines/${id}`),
  update: (id: string, data: unknown) => api.patch(`/pipelines/${id}`, data),
  delete: (id: string) => api.delete(`/pipelines/${id}`),
  run: (id: string) => api.post(`/pipelines/${id}/run`),
  listRuns: (id: string) => api.get(`/pipelines/${id}/runs`),
  setSchedule: (id: string, config: Record<string, unknown>) => api.put(`/pipelines/${id}/schedule`, config),
  removeSchedule: (id: string) => api.delete(`/pipelines/${id}/schedule`),
  schedulerStatus: () => api.get('/pipelines/scheduler/status'),
};

// Alerts
export const alertApi = {
  listRules: () => api.get('/alerts/rules'),
  createRule: (data: unknown) => api.post('/alerts/rules', data),
  deleteRule: (id: string) => api.delete(`/alerts/rules/${id}`),
  list: (params?: Record<string, unknown>) => api.get('/alerts/', { params }),
  unreadCount: () => api.get('/alerts/count'),
  markRead: (id: string) => api.patch(`/alerts/${id}/read`),
  markAllRead: () => api.post('/alerts/mark-all-read'),
};

// AIP
export const aipApi = {
  listProviders: () => api.get('/aip/providers'),
  createProvider: (data: unknown) => api.post('/aip/providers', data),
  deleteProvider: (id: string) => api.delete(`/aip/providers/${id}`),
  listAgents: () => api.get('/aip/agents'),
  createAgent: (data: unknown) => api.post('/aip/agents', data),
  getAgent: (id: string) => api.get(`/aip/agents/${id}`),
  updateAgent: (id: string, data: unknown) => api.patch(`/aip/agents/${id}`, data),
  deleteAgent: (id: string) => api.delete(`/aip/agents/${id}`),
  listFunctions: () => api.get('/aip/functions'),
  createFunction: (data: unknown) => api.post('/aip/functions', data),
  executeFunction: (id: string, inputs: Record<string, unknown>) => api.post(`/aip/functions/${id}/execute`, inputs),
  chat: (data: { agent_id?: string; conversation_id?: string; message: string }) => api.post('/aip/chat', data),
  listConversations: () => api.get('/aip/conversations'),
  getConversation: (id: string) => api.get(`/aip/conversations/${id}`),
  nlQuery: (data: { query: string; object_type_id?: string }) => api.post('/aip/nl-query', data),
};
