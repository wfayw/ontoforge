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
    if (error.response?.status === 403) {
      import('antd').then(({ message }) => message.warning('权限不足 / Insufficient permissions'));
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth & User Management
export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  listUsers: () => api.get('/auth/users'),
  updateUserRole: (userId: string, role: string) => api.patch(`/auth/users/${userId}/role`, { role }),
  updateUser: (userId: string, data: { display_name?: string; is_active?: boolean }) =>
    api.patch(`/auth/users/${userId}`, data),
};

// Audit
export const auditApi = {
  listLogs: (params?: { page?: number; page_size?: number; action?: string; resource_type?: string; username?: string }) =>
    api.get('/audit/logs', { params }),
  listActions: () => api.get('/audit/actions'),
  listResourceTypes: () => api.get('/audit/resource-types'),
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

// Workshop
export const workshopApi = {
  listApps: () => api.get('/workshop/apps'),
  createApp: (data: { name: string; description?: string; icon?: string }) => api.post('/workshop/apps', data),
  getApp: (id: string) => api.get(`/workshop/apps/${id}`),
  updateApp: (id: string, data: unknown) => api.patch(`/workshop/apps/${id}`, data),
  deleteApp: (id: string) => api.delete(`/workshop/apps/${id}`),
  publishApp: (id: string) => api.post(`/workshop/apps/${id}/publish`),
  listWidgets: (appId: string) => api.get(`/workshop/apps/${appId}/widgets`),
  createWidget: (appId: string, data: unknown) => api.post(`/workshop/apps/${appId}/widgets`, data),
  updateWidget: (widgetId: string, data: unknown) => api.patch(`/workshop/widgets/${widgetId}`, data),
  deleteWidget: (widgetId: string) => api.delete(`/workshop/widgets/${widgetId}`),
  updateLayout: (appId: string, items: Array<{ id: string; position: unknown }>) => api.put(`/workshop/apps/${appId}/layout`, items),
  resolve: (widgets: Array<{ id: string; widget_type: string; data_binding: unknown }>, variables?: Record<string, unknown>) =>
    api.post('/workshop/resolve', { widgets, variables }),
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
  chatStream: (data: { agent_id?: string; conversation_id?: string; message: string }) => {
    const token = localStorage.getItem('token');
    return fetch('/api/v1/aip/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
  },
  listConversations: () => api.get('/aip/conversations'),
  getConversation: (id: string) => api.get(`/aip/conversations/${id}`),
  nlQuery: (data: { query: string; object_type_id?: string }) => api.post('/aip/nl-query', data),
};

// Documents (RAG)
export const documentApi = {
  list: () => api.get('/documents/'),
  create: (data: { name: string; content: string; description?: string }) => api.post('/documents/', data),
  get: (id: string) => api.get(`/documents/${id}`),
  delete: (id: string) => api.delete(`/documents/${id}`),
  search: (data: { query: string; limit?: number }) => api.post('/documents/search', data),
};
