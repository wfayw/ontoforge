import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, Button, Modal, Form, Input, Select, Space, Typography, message,
  Tabs, Tag, List, Empty, Slider, Popconfirm, Spin, Drawer,
} from 'antd';
import {
  PlusOutlined, SendOutlined, RobotOutlined, ThunderboltOutlined,
  DeleteOutlined, SearchOutlined, ToolOutlined, CheckCircleOutlined,
  EditOutlined, FileTextOutlined, UploadOutlined, PlayCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { aipApi, documentApi, ontologyApi } from '@/services/api';
import { useI18n } from '@/i18n';
import PageHeader from '@/components/PageHeader';
import type { LLMProvider, AIAgent, AIPFunction, Conversation, ChatMessage, Document } from '@/types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ToolCallInfo {
  tool: string;
  args: Record<string, unknown>;
  result?: unknown;
  loading?: boolean;
}

interface StreamMessage {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallInfo[];
  streaming?: boolean;
}

export default function AIPStudio() {
  const { t } = useI18n();
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [functions, setFunctions] = useState<AIPFunction[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [functionModalOpen, setFunctionModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const [nlQuery, setNlQuery] = useState('');
  const [nlResult, setNlResult] = useState<{ interpreted_query: string; results: Record<string, unknown>[] } | null>(null);
  const [nlLoading, setNlLoading] = useState(false);

  const [testingFn, setTestingFn] = useState<AIPFunction | null>(null);
  const [fnInputs, setFnInputs] = useState<Record<string, string>>({});
  const [fnResult, setFnResult] = useState<string | null>(null);
  const [fnLoading, setFnLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [providerForm] = Form.useForm();
  const [agentForm] = Form.useForm();
  const [functionForm] = Form.useForm();
  const [docForm] = Form.useForm();

  const [editProviderModalOpen, setEditProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(null);
  const [editProviderForm] = Form.useForm();
  const [editFunctionModalOpen, setEditFunctionModalOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<AIPFunction | null>(null);
  const [editFunctionForm] = Form.useForm();

  const fetchAll = async () => {
    const [p, a, f, c, d] = await Promise.all([
      aipApi.listProviders(), aipApi.listAgents(), aipApi.listFunctions(),
      aipApi.listConversations(), documentApi.list(),
    ]);
    setProviders(p.data);
    setAgents(a.data);
    setFunctions(f.data);
    setConversations(c.data);
    setDocuments(d.data);
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [streamMessages]);

  const createProvider = async (values: Record<string, unknown>) => {
    try {
      await aipApi.createProvider(values);
      message.success(t('aip.providerAdded'));
      setProviderModalOpen(false);
      providerForm.resetFields();
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const openCreateAgent = () => {
    setEditingAgent(null);
    agentForm.resetFields();
    setAgentModalOpen(true);
  };

  const openEditAgent = (agent: AIAgent) => {
    setEditingAgent(agent);
    agentForm.setFieldsValue({
      name: agent.name,
      description: agent.description ?? '',
      system_prompt: agent.system_prompt,
      llm_provider_id: agent.llm_provider_id ?? undefined,
      model_name: agent.model_name ?? undefined,
      temperature: agent.temperature ?? 0.7,
      tools: agent.tools ?? [],
      status: agent.status ?? 'active',
    });
    setAgentModalOpen(true);
  };

  const saveAgent = async (values: Record<string, unknown>) => {
    try {
      if (editingAgent) {
        await aipApi.updateAgent(editingAgent.id, values);
        message.success(t('aip.agentUpdated'));
      } else {
        await aipApi.createAgent(values);
        message.success(t('aip.agentCreated'));
      }
      setAgentModalOpen(false);
      setEditingAgent(null);
      agentForm.resetFields();
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const createFunction = async (values: Record<string, unknown>) => {
    try {
      await aipApi.createFunction(values);
      message.success(t('aip.functionCreated'));
      setFunctionModalOpen(false);
      functionForm.resetFields();
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: StreamMessage = { role: 'user', content: chatInput };
    setStreamMessages((prev) => [...prev, userMsg]);
    const inputText = chatInput;
    setChatInput('');
    setChatLoading(true);

    const assistantIdx = streamMessages.length + 1;
    setStreamMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true, toolCalls: [] }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await aipApi.chatStream({
        agent_id: selectedAgentId,
        conversation_id: conversationId,
        message: inputText,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const data = JSON.parse(payload);
            if (data.type === 'conversation_id') {
              setConversationId(data.conversation_id);
            } else if (data.type === 'content_delta') {
              setStreamMessages((prev) => {
                const updated = [...prev];
                const msg = updated[assistantIdx];
                if (msg) updated[assistantIdx] = { ...msg, content: msg.content + data.content };
                return updated;
              });
            } else if (data.type === 'tool_start') {
              setStreamMessages((prev) => {
                const updated = [...prev];
                const msg = updated[assistantIdx];
                if (msg) {
                  const tcs = [...(msg.toolCalls || []), { tool: data.tool, args: data.args, loading: true }];
                  updated[assistantIdx] = { ...msg, toolCalls: tcs };
                }
                return updated;
              });
            } else if (data.type === 'tool_end') {
              setStreamMessages((prev) => {
                const updated = [...prev];
                const msg = updated[assistantIdx];
                if (msg) {
                  const tcs = (msg.toolCalls || []).map((tc) =>
                    tc.tool === data.tool && tc.loading ? { ...tc, result: data.result, loading: false } : tc
                  );
                  updated[assistantIdx] = { ...msg, toolCalls: tcs };
                }
                return updated;
              });
            } else if (data.type === 'done') {
              setStreamMessages((prev) => {
                const updated = [...prev];
                const msg = updated[assistantIdx];
                if (msg) updated[assistantIdx] = { ...msg, streaming: false };
                return updated;
              });
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      setStreamMessages((prev) => {
        const updated = [...prev];
        const msg = updated[assistantIdx];
        if (msg?.streaming) updated[assistantIdx] = { ...msg, streaming: false };
        return updated;
      });

      aipApi.listConversations().then(({ data: convs }) => setConversations(convs));
    } catch (err) {
      setStreamMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: 'assistant', content: t('aip.chatError'), streaming: false };
        return updated;
      });
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }, [chatInput, chatLoading, conversationId, selectedAgentId, streamMessages.length, t]);

  const loadConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    setSelectedAgentId(conv.agent_id || undefined);
    const msgs: StreamMessage[] = [];
    for (const m of conv.messages) {
      if (m.role === 'user') msgs.push({ role: 'user', content: m.content });
      else if (m.role === 'assistant' && !m.tool_calls?.length) msgs.push({ role: 'assistant', content: m.content });
    }
    setStreamMessages(msgs);
  };

  const newConversation = () => {
    setConversationId(undefined);
    setStreamMessages([]);
  };

  const executeNlQuery = async () => {
    if (!nlQuery.trim()) return;
    setNlLoading(true);
    try {
      const { data } = await aipApi.nlQuery({ query: nlQuery });
      setNlResult(data);
    } catch {
      message.error(t('aip.queryFailed'));
    } finally {
      setNlLoading(false);
    }
  };

  const uploadDocument = async (values: { name: string; content: string; description?: string }) => {
    try {
      await documentApi.create(values);
      message.success(t('aip.docUploaded'));
      setDocModalOpen(false);
      docForm.resetFields();
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const openEditProvider = (p: LLMProvider) => {
    setEditingProvider(p);
    editProviderForm.setFieldsValue({
      name: p.name,
      provider_type: p.provider_type,
      base_url: p.base_url,
      default_model: p.default_model,
      api_key: '',
    });
    setEditProviderModalOpen(true);
  };

  const updateProvider = async (values: Record<string, unknown>) => {
    if (!editingProvider) return;
    try {
      const payload: Record<string, unknown> = { ...values };
      if (!payload.api_key) delete payload.api_key;
      await aipApi.updateProvider(editingProvider.id, payload);
      message.success(t('aip.providerUpdated'));
      setEditProviderModalOpen(false);
      setEditingProvider(null);
      fetchAll();
    } catch { message.error(t('aip.providerUpdateFailed')); }
  };

  const openEditFunction = (fn: AIPFunction) => {
    setEditingFunction(fn);
    editFunctionForm.setFieldsValue({
      display_name: fn.display_name,
      description: fn.description || '',
      prompt_template: fn.prompt_template,
      llm_provider_id: fn.llm_provider_id || undefined,
    });
    setEditFunctionModalOpen(true);
  };

  const updateFunction = async (values: Record<string, unknown>) => {
    if (!editingFunction) return;
    try {
      await aipApi.updateFunction(editingFunction.id, values);
      message.success(t('aip.functionUpdated'));
      setEditFunctionModalOpen(false);
      setEditingFunction(null);
      fetchAll();
    } catch { message.error(t('aip.functionUpdateFailed')); }
  };

  const openFnTest = (fn: AIPFunction) => {
    setTestingFn(fn);
    setFnResult(null);
    setFnLoading(false);
    const vars: Record<string, string> = {};
    const matches = fn.prompt_template.match(/\{\{(\w+)\}\}/g);
    if (matches) {
      for (const m of matches) {
        const key = m.replace(/\{|\}/g, '');
        vars[key] = '';
      }
    }
    setFnInputs(vars);
  };

  const executeFn = async () => {
    if (!testingFn) return;
    setFnLoading(true);
    try {
      const { data } = await aipApi.executeFunction(testingFn.id, fnInputs);
      setFnResult(data.output || data.error || JSON.stringify(data));
      message.success(t('aip.functionExecuted'));
    } catch { message.error(t('aip.operationFailed')); }
    finally { setFnLoading(false); }
  };

  const fnPreviewPrompt = () => {
    if (!testingFn) return '';
    let prompt = testingFn.prompt_template;
    for (const [k, v] of Object.entries(fnInputs)) {
      prompt = prompt.split(`{{${k}}}`).join(v || `[${k}]`);
    }
    return prompt;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader
        title={t('aip.title')}
        subtitle={t('aip.subtitle')}
        actions={
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setProviderModalOpen(true)}>{t('aip.llmProvider')}</Button>
            <Button icon={<RobotOutlined />} onClick={openCreateAgent}>{t('aip.agent')}</Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setFunctionModalOpen(true)}>{t('aip.function')}</Button>
          </Space>
        }
      />

      <Tabs items={[
        {
          key: 'chat',
          label: <><RobotOutlined /> {t('aip.agentChat')}</>,
          children: (
            <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)', minHeight: 400 }}>
              <Card style={{ width: 200, background: 'var(--bg-surface)', border: '1px solid var(--card-border)', overflow: 'auto', flexShrink: 0 }}>
                <Button block size="small" onClick={newConversation} style={{ marginBottom: 8 }}>{t('aip.newChat')}</Button>
                <Select
                  placeholder={t('aip.selectAgent')}
                  allowClear
                  style={{ width: '100%', marginBottom: 12 }}
                  value={selectedAgentId}
                  onChange={(v) => { setSelectedAgentId(v); newConversation(); }}
                  options={agents.map((a) => ({ value: a.id, label: a.name }))}
                />
                <Text style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginBottom: 8 }}>{t('aip.history')}</Text>
                <List
                  dataSource={conversations}
                  size="small"
                  renderItem={(c) => (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '4px 0', borderBottom: '1px solid var(--border)' }}
                      onClick={() => loadConversation(c)}
                    >
                      <Text ellipsis style={{ color: conversationId === c.id ? 'var(--primary)' : 'var(--text-secondary)', fontSize: 12 }}>{c.title || t('aip.untitled')}</Text>
                    </List.Item>
                  )}
                  locale={{ emptyText: <Empty description={t('aip.noConversations')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                />
              </Card>

              <Card style={{ flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
                  {streamMessages.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-tertiary)' }}>
                      <RobotOutlined style={{ fontSize: 48, marginBottom: 16, display: 'block' }} />
                      <Text style={{ color: 'var(--text-tertiary)', whiteSpace: 'pre-line' }}>{t('aip.chatEmptyText')}</Text>
                    </div>
                  )}
                  {streamMessages.map((m, i) => (
                    <div key={i}>
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div style={{ margin: '4px 0 8px', display: 'flex', justifyContent: 'flex-start' }}>
                          <div style={{ maxWidth: '80%', width: '100%' }}>
                            {m.toolCalls.map((tc, ti) => (
                              <div key={ti} style={{
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '8px 12px', marginBottom: 4, fontSize: 12,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <ToolOutlined style={{ color: 'var(--color-purple)', fontSize: 13 }} />
                                  <Text strong style={{ color: 'var(--color-purple)', fontSize: 12 }}>{tc.tool}</Text>
                                  {tc.loading
                                    ? <LoadingOutlined style={{ color: 'var(--primary)', fontSize: 11, marginLeft: 'auto' }} spin />
                                    : <CheckCircleOutlined style={{ color: 'var(--color-green)', fontSize: 11, marginLeft: 'auto' }} />
                                  }
                                </div>
                                {tc.args && Object.keys(tc.args).length > 0 && (
                                  <div style={{ color: 'var(--text-tertiary)', fontSize: 11, marginBottom: 2 }}>
                                    {Object.entries(tc.args).map(([k, v]) => (
                                      <Tag key={k} style={{ fontSize: 11, marginBottom: 2 }}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</Tag>
                                    ))}
                                  </div>
                                )}
                                {tc.result != null && (
                                  <div style={{
                                    background: 'var(--bg-surface)', borderRadius: 4, padding: '4px 8px', marginTop: 4,
                                    fontSize: 11, color: 'var(--text-secondary)', maxHeight: 120, overflow: 'auto',
                                    fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                  }}>
                                    {typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                        <div style={{
                          maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
                          background: m.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
                          color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                          fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                        }}>
                          {m.content}
                          {m.streaming && !m.content && (
                            <span style={{ color: 'var(--text-tertiary)' }}>{t('aip.thinking')}</span>
                          )}
                          {m.streaming && m.content && (
                            <span className="streaming-cursor" style={{ display: 'inline-block', width: 2, height: 16, background: 'var(--primary)', marginLeft: 2, animation: 'blink 1s infinite' }} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onPressEnter={sendMessage}
                    placeholder={t('aip.chatPlaceholder')}
                    disabled={chatLoading}
                    style={{ borderRadius: 20 }}
                  />
                  <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={sendMessage} loading={chatLoading} />
                </div>
              </Card>
            </div>
          ),
        },
        {
          key: 'documents',
          label: <><FileTextOutlined /> {t('aip.documents')}</>,
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ color: 'var(--text-secondary)' }}>
                  {documents.length > 0 ? `${documents.length} ${t('aip.documents').toLowerCase()}` : ''}
                </Text>
                <Button icon={<UploadOutlined />} type="primary" onClick={() => setDocModalOpen(true)}>{t('aip.uploadDocument')}</Button>
              </div>
              <List
                dataSource={documents}
                renderItem={(doc) => (
                  <List.Item
                    actions={[
                      <Popconfirm title={t('aip.deleteConfirm')} onConfirm={async () => { await documentApi.delete(doc.id); message.success(t('aip.docDeleted')); fetchAll(); }}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileTextOutlined style={{ fontSize: 24, color: 'var(--primary)' }} />}
                      title={<Text style={{ color: 'var(--text-primary)' }}>{doc.name}</Text>}
                      description={
                        <Space>
                          {doc.description && <Text style={{ color: 'var(--text-secondary)' }}>{doc.description}</Text>}
                          <Tag>{t('aip.chunks')}: {doc.chunk_count}</Tag>
                          <Tag>{t('aip.fileSize')}: {formatBytes(doc.file_size)}</Tag>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description={t('aip.noDocuments')} /> }}
              />
            </Card>
          ),
        },
        {
          key: 'nl-query',
          label: <><SearchOutlined /> {t('aip.nlQuery')}</>,
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    value={nlQuery}
                    onChange={(e) => setNlQuery(e.target.value)}
                    onPressEnter={executeNlQuery}
                    placeholder={t('aip.nlPlaceholder')}
                    size="large"
                  />
                  <Button type="primary" size="large" icon={<SearchOutlined />} onClick={executeNlQuery} loading={nlLoading}>{t('common.query')}</Button>
                </div>
                {nlResult && (
                  <>
                    <Card size="small" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <Text style={{ color: 'var(--primary)' }}>{t('aip.interpreted', { query: nlResult.interpreted_query })}</Text>
                    </Card>
                    <List
                      dataSource={nlResult.results}
                      renderItem={(item: Record<string, unknown>) => (
                        <List.Item style={{ borderBottom: '1px solid var(--border)' }}>
                          <List.Item.Meta
                            title={<Text style={{ color: 'var(--text-primary)' }}>{String(item.display_name || item.id)}</Text>}
                            description={
                              <Space wrap>
                                {Object.entries(item.properties as Record<string, unknown> || {}).map(([k, v]) => (
                                  <Tag key={k}>{k}: {String(v)}</Tag>
                                ))}
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                      locale={{ emptyText: <Empty description={t('aip.noResults')} /> }}
                    />
                  </>
                )}
              </Space>
            </Card>
          ),
        },
        {
          key: 'agents',
          label: t('aip.agents'),
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
              <List
                dataSource={agents}
                renderItem={(a) => (
                  <List.Item
                    actions={[
                      <Button size="small" onClick={() => { setSelectedAgentId(a.id); newConversation(); }}>{t('aip.chat')}</Button>,
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditAgent(a)}>{t('common.edit')}</Button>,
                      <Popconfirm title={t('aip.deleteConfirm')} onConfirm={async () => { await aipApi.deleteAgent(a.id); fetchAll(); }}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<RobotOutlined style={{ fontSize: 24, color: 'var(--color-purple)' }} />}
                      title={<Text style={{ color: 'var(--text-primary)' }}>{a.name}</Text>}
                      description={
                        <Space direction="vertical" size={2}>
                          <Text style={{ color: 'var(--text-secondary)' }}>{a.description}</Text>
                          <Space>
                            <Tag color={a.status === 'active' ? 'green' : 'blue'}>{a.status}</Tag>
                            {a.tools.map((tool: string) => <Tag key={tool}>{tool}</Tag>)}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description={t('aip.agentEmptyText')} /> }}
              />
            </Card>
          ),
        },
        {
          key: 'functions',
          label: t('aip.aipFunctions'),
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
              <List
                dataSource={functions}
                renderItem={(fn) => (
                  <List.Item actions={[
                    <Button size="small" icon={<PlayCircleOutlined />} onClick={() => openFnTest(fn)}>{t('aip.testFunction')}</Button>,
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEditFunction(fn)}>{t('common.edit')}</Button>,
                    <Popconfirm title={t('aip.deleteConfirm')} onConfirm={async () => { await aipApi.deleteFunction(fn.id); message.success(t('aip.functionDeleted')); fetchAll(); }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}>
                    <List.Item.Meta
                      avatar={<ThunderboltOutlined style={{ fontSize: 24, color: 'var(--color-yellow)' }} />}
                      title={<Text style={{ color: 'var(--text-primary)' }}>{fn.display_name}</Text>}
                      description={<Text style={{ color: 'var(--text-secondary)' }}>{fn.description || fn.prompt_template.substring(0, 100)}...</Text>}
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description={t('aip.functionEmptyText')} /> }}
              />
            </Card>
          ),
        },
        {
          key: 'providers',
          label: t('aip.llmProviders'),
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
              <List
                dataSource={providers}
                renderItem={(p) => (
                  <List.Item
                    actions={[
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditProvider(p)}>{t('common.edit')}</Button>,
                      <Popconfirm title={t('aip.deleteConfirm')} onConfirm={async () => { await aipApi.deleteProvider(p.id); fetchAll(); }}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text style={{ color: 'var(--text-primary)' }}>{p.name}</Text>}
                      description={<Space><Tag>{p.provider_type}</Tag><Tag>{p.default_model}</Tag><Tag color={p.is_active ? 'green' : 'red'}>{p.is_active ? 'Active' : 'Inactive'}</Tag></Space>}
                    />
                  </List.Item>
                )}
                locale={{ emptyText: <Empty description={t('aip.providerEmptyText')} /> }}
              />
            </Card>
          ),
        },
      ]} />

      {/* Provider Modal */}
      <Modal title={t('aip.addProvider')} open={providerModalOpen} onCancel={() => setProviderModalOpen(false)} onOk={() => providerForm.submit()} okText={t('common.add')}>
        <Form form={providerForm} onFinish={createProvider} layout="vertical">
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input placeholder="e.g. OpenAI Production" /></Form.Item>
          <Form.Item name="provider_type" label={t('aip.providerType')} rules={[{ required: true }]}>
            <Select options={[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }, { value: 'local', label: 'Local / Custom' }]} />
          </Form.Item>
          <Form.Item name="base_url" label={t('aip.baseUrl')} rules={[{ required: true }]}><Input placeholder="https://api.openai.com/v1" /></Form.Item>
          <Form.Item name="api_key" label={t('aip.apiKey')}><Input.Password placeholder="sk-..." /></Form.Item>
          <Form.Item name="default_model" label={t('aip.defaultModel')} rules={[{ required: true }]}><Input placeholder="gpt-4o-mini" /></Form.Item>
        </Form>
      </Modal>

      {/* Agent Modal */}
      <Modal
        title={editingAgent ? t('aip.editAgent') : t('aip.createAgent')}
        open={agentModalOpen}
        onCancel={() => { setAgentModalOpen(false); setEditingAgent(null); agentForm.resetFields(); }}
        onOk={() => agentForm.submit()}
        okText={editingAgent ? t('common.save') : t('common.create')}
        width={600}
      >
        <Form form={agentForm} onFinish={saveAgent} layout="vertical">
          <Form.Item name="name" label={t('aip.agentName')} rules={[{ required: true }]}><Input placeholder="e.g. Data Analyst Agent" /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input /></Form.Item>
          <Form.Item name="system_prompt" label={t('aip.systemPrompt')} rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="You are a helpful data analyst..." />
          </Form.Item>
          <Form.Item name="llm_provider_id" label={t('aip.llmProvider')}>
            <Select allowClear options={providers.map((p) => ({ value: p.id, label: p.name }))} placeholder={t('aip.useDefault')} />
          </Form.Item>
          <Form.Item name="model_name" label={t('aip.modelOverride')}><Input placeholder={t('aip.modelOverridePlaceholder')} /></Form.Item>
          <Form.Item name="temperature" label={t('aip.temperature')} initialValue={0.7}>
            <Slider min={0} max={2} step={0.1} />
          </Form.Item>
          <Form.Item name="tools" label={t('aip.tools')}>
            <Select mode="multiple" options={[
              { value: 'ontology_query', label: t('aip.toolOntologyQuery') },
              { value: 'action_execute', label: t('aip.toolActionExecute') },
              { value: 'analytics', label: t('aip.toolAnalytics') },
              { value: 'instance_write', label: t('aip.toolInstanceWrite') },
              { value: 'document_search', label: t('aip.toolDocumentSearch') },
              { value: 'aip_functions', label: t('aip.toolFunctionCall') },
              { value: 'ontology_functions', label: t('aip.toolOntologyFunctions') },
            ]} />
          </Form.Item>
          {editingAgent && (
            <Form.Item name="status" label={t('common.status')}>
              <Select options={[{ value: 'active', label: t('aip.statusActive') }, { value: 'draft', label: t('aip.statusDraft') }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Function Modal */}
      <Modal title={t('aip.createFunction')} open={functionModalOpen} onCancel={() => setFunctionModalOpen(false)} onOk={() => functionForm.submit()} okText={t('common.create')} width={600}>
        <Form form={functionForm} onFinish={createFunction} layout="vertical">
          <Form.Item name="name" label={t('aip.apiNameLabel')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input /></Form.Item>
          <Form.Item name="prompt_template" label={t('aip.promptTemplate')} rules={[{ required: true }]}>
            <TextArea rows={4} placeholder={t('aip.promptTemplatePlaceholder')} />
          </Form.Item>
          <Form.Item name="llm_provider_id" label={t('aip.llmProvider')}>
            <Select allowClear options={providers.map((p) => ({ value: p.id, label: p.name }))} placeholder={t('aip.useDefault')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Document Upload Modal */}
      <Modal title={t('aip.uploadDocument')} open={docModalOpen} onCancel={() => setDocModalOpen(false)} onOk={() => docForm.submit()} okText={t('common.create')} width={600}>
        <Form form={docForm} onFinish={uploadDocument} layout="vertical">
          <Form.Item name="name" label={t('aip.docName')} rules={[{ required: true }]}><Input placeholder="e.g. Maintenance Manual v3.2" /></Form.Item>
          <Form.Item name="description" label={t('aip.docDescription')}><Input /></Form.Item>
          <Form.Item name="content" label={t('aip.docContent')} rules={[{ required: true }]}>
            <TextArea rows={10} placeholder="Paste document content here..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Function Test Drawer */}
      <Drawer
        title={t('aip.functionTestPanel')}
        open={!!testingFn}
        onClose={() => setTestingFn(null)}
        width={560}
      >
        {testingFn && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong style={{ fontSize: 16 }}>{testingFn.display_name}</Text>
              <br />
              <Text style={{ color: 'var(--text-secondary)' }}>{testingFn.description}</Text>
            </div>

            {Object.keys(fnInputs).length > 0 && (
              <Card size="small" title={t('aip.inputVariables')}>
                {Object.entries(fnInputs).map(([key, val]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{`{{${key}}}`}</Text>
                    <Input
                      value={val}
                      onChange={(e) => setFnInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={key}
                    />
                  </div>
                ))}
              </Card>
            )}

            <Card size="small" title={t('aip.previewPrompt')}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 0 }}>
                {fnPreviewPrompt()}
              </Paragraph>
            </Card>

            <Button type="primary" icon={<PlayCircleOutlined />} onClick={executeFn} loading={fnLoading} block>
              {fnLoading ? t('aip.executingFunction') : t('common.execute')}
            </Button>

            {fnResult && (
              <Card size="small" title={t('aip.executeResult')}>
                <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginBottom: 0 }}>
                  {fnResult}
                </Paragraph>
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      <Modal title={t('aip.editProvider')} open={editProviderModalOpen} onCancel={() => { setEditProviderModalOpen(false); setEditingProvider(null); }} onOk={() => editProviderForm.submit()} okText={t('common.save')}>
        <Form form={editProviderForm} onFinish={updateProvider} layout="vertical">
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="provider_type" label={t('aip.providerType')} rules={[{ required: true }]}>
            <Select options={[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }, { value: 'local', label: 'Local / Custom' }]} />
          </Form.Item>
          <Form.Item name="base_url" label={t('aip.baseUrl')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="api_key" label={t('aip.apiKey')} help="Leave blank to keep existing key"><Input.Password placeholder="sk-..." /></Form.Item>
          <Form.Item name="default_model" label={t('aip.defaultModel')} rules={[{ required: true }]}><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={t('aip.editFunction')} open={editFunctionModalOpen} onCancel={() => { setEditFunctionModalOpen(false); setEditingFunction(null); }} onOk={() => editFunctionForm.submit()} okText={t('common.save')} width={600}>
        <Form form={editFunctionForm} onFinish={updateFunction} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input /></Form.Item>
          <Form.Item name="prompt_template" label={t('aip.promptTemplate')} rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="llm_provider_id" label={t('aip.llmProvider')}>
            <Select allowClear options={providers.map((p) => ({ value: p.id, label: p.name }))} placeholder={t('aip.useDefault')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
