import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Table, Select, Input, Button, Space, Typography, Tag, Modal, Form, Descriptions, message, Popconfirm, Empty, Tabs, List } from 'antd';
import { SearchOutlined, PlusOutlined, DeleteOutlined, EyeOutlined, ThunderboltOutlined, ApartmentOutlined, LinkOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { ontologyApi, instanceApi } from '@/services/api';
import { useI18n } from '@/i18n';
import PageHeader from '@/components/PageHeader';
import ObjectGraphExplorer from '@/components/ObjectGraphExplorer';
import type { ObjectType, ObjectInstance, ActionType, LinkType } from '@/types';

const { Text } = Typography;

export default function ObjectExplorer() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [objectTypes, setObjectTypes] = useState<ObjectType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | undefined>();
  const [objects, setObjects] = useState<ObjectInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const onSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 300);
  }, []);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedObj, setSelectedObj] = useState<ObjectInstance | null>(null);
  const [form] = Form.useForm();
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [linkTypes, setLinkTypes] = useState<LinkType[]>([]);
  const [executing, setExecuting] = useState<string | null>(null);
  const [neighbors, setNeighbors] = useState<{ id: string; display_name: string; object_type_id?: string; properties: Record<string, unknown> }[]>([]);
  const [neighborEdges, setNeighborEdges] = useState<{ source_id: string; target_id: string; link_type_id: string }[]>([]);
  const [lineage, setLineage] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    ontologyApi.listObjectTypes().then(({ data }) => setObjectTypes(data));
    ontologyApi.listActionTypes().then(({ data }) => setActionTypes(data)).catch(() => {});
    ontologyApi.listLinkTypes().then(({ data }) => setLinkTypes(data)).catch(() => {});
  }, []);

  const fetchObjects = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: 50 };
      if (selectedTypeId) params.object_type_id = selectedTypeId;
      if (search) params.q = search;
      const { data } = await instanceApi.listObjects(params);
      setObjects(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchObjects(); }, [selectedTypeId, page, search]);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId) {
      searchParams.delete('highlight');
      setSearchParams(searchParams, { replace: true });
      instanceApi.getObject(highlightId).then(({ data }) => openDetail(data)).catch(() => {});
    }
  }, []);

  const selectedType = objectTypes.find((ot) => ot.id === selectedTypeId);

  const columns = [
    { title: t('explorer.displayName'), dataIndex: 'display_name', key: 'name', render: (v: string) => <Text strong style={{ color: 'var(--text-primary)' }}>{v || '—'}</Text> },
    {
      title: t('common.type'), dataIndex: 'object_type_id', key: 'type',
      render: (id: string) => {
        const ot = objectTypes.find((o) => o.id === id);
        return ot ? <Tag color={ot.color}>{ot.display_name}</Tag> : id;
      },
    },
    {
      title: t('explorer.properties'), dataIndex: 'properties', key: 'props',
      render: (props: Record<string, unknown>) => {
        const entries = Object.entries(props).slice(0, 3);
        return entries.map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>);
      },
    },
    { title: t('explorer.created'), dataIndex: 'created_at', key: 'created', render: (v: string) => new Date(v).toLocaleDateString() },
    {
      title: '', key: 'actions', width: 100,
      render: (_: unknown, record: ObjectInstance) => (
        <Space>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          <Popconfirm title={t('explorer.deleteConfirm')} onConfirm={async () => { await instanceApi.deleteObject(record.id); fetchObjects(); message.success(t('ontology.deleted')); }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const openDetail = useCallback(async (obj: ObjectInstance) => {
    setSelectedObj(obj);
    setDetailOpen(true);
    setLineage(null);
    try {
      const [nbr, lin] = await Promise.all([
        instanceApi.getNeighbors(obj.id, 2),
        instanceApi.getLineage(obj.id).catch(() => ({ data: null })),
      ]);
      setNeighbors(nbr.data.neighbors || []);
      setNeighborEdges(nbr.data.edges || []);
      setLineage(lin.data);
    } catch {
      setNeighbors([]);
      setNeighborEdges([]);
    }
  }, []);

  const executeAction = useCallback(async (actionId: string, obj: ObjectInstance, extraParams?: Record<string, unknown>) => {
    setExecuting(actionId);
    try {
      await instanceApi.executeAction({ action_type_id: actionId, params: { target_id: obj.id, ...extraParams } });
      message.success(t('explorer.actionSuccess'));
      // Re-fetch list and refresh detail
      const params: Record<string, unknown> = { page, page_size: 50 };
      if (selectedTypeId) params.object_type_id = selectedTypeId;
      if (search) params.q = search;
      instanceApi.listObjects(params).then(({ data }) => { setObjects(data.items); setTotal(data.total); }).catch(() => {});
      const { data: refreshed } = await instanceApi.getObject(obj.id);
      setSelectedObj(refreshed);
    } catch {
      message.error(t('explorer.actionFailed'));
    } finally {
      setExecuting(null);
    }
  }, [t, page, selectedTypeId, search]);

  const createObject = async (values: Record<string, unknown>) => {
    if (!selectedTypeId) { message.error(t('explorer.selectTypeFirst')); return; }
    try {
      const { display_name, ...rest } = values;
      await instanceApi.createObject({ object_type_id: selectedTypeId, display_name, properties: rest });
      message.success(t('explorer.objectCreated'));
      setCreateOpen(false);
      form.resetFields();
      fetchObjects();
    } catch { message.error(t('explorer.createFailed')); }
  };

  return (
    <div>
      <PageHeader
        title={t('explorer.title')}
        subtitle={t('explorer.subtitle')}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} disabled={!selectedTypeId}>
            {t('explorer.createObject')}
          </Button>
        }
      />

      <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('explorer.filterByType')}
            style={{ width: 240 }}
            allowClear
            value={selectedTypeId}
            onChange={(v) => { setSelectedTypeId(v); setPage(1); }}
            options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))}
          />
          <Input
            placeholder={t('explorer.searchPlaceholder')}
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            allowClear
            onClear={() => { setSearchInput(''); setSearch(''); setPage(1); }}
          />
        </Space>
      </Card>

      <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
        <Table
          dataSource={objects}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ current: page, total, pageSize: 50, onChange: setPage, showTotal: (tot) => t('explorer.totalObjects', { count: tot }) }}
          locale={{ emptyText: <Empty description={t('explorer.emptyText')} /> }}
        />
      </Card>

      <Modal title={t('explorer.createTitle')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => form.submit()} okText={t('common.create')} width={600}>
        <Form form={form} onFinish={createObject} layout="vertical">
          <Form.Item name="display_name" label={t('explorer.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {selectedType?.properties.map((prop) => (
            <Form.Item key={prop.id} name={prop.name} label={prop.display_name} rules={prop.required ? [{ required: true }] : []}>
              {prop.data_type === 'boolean' ? (
                <Select options={[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]} />
              ) : prop.data_type === 'integer' || prop.data_type === 'float' ? (
                <Input type="number" />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Modal title={t('explorer.detailTitle')} open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width="90vw" style={{ top: 32, maxWidth: 1400 }} styles={{ body: { maxHeight: 'calc(100vh - 120px)', overflow: 'auto' } }}>
        {selectedObj && (
          <Tabs items={[
            {
              key: 'detail',
              label: <><EyeOutlined /> {t('explorer.detailTab')}</>,
              children: (
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="ID"><code>{selectedObj.id}</code></Descriptions.Item>
                  <Descriptions.Item label={t('explorer.displayName')}>{selectedObj.display_name}</Descriptions.Item>
                  <Descriptions.Item label={t('common.type')}>
                    {objectTypes.find((ot) => ot.id === selectedObj.object_type_id)?.display_name || selectedObj.object_type_id}
                  </Descriptions.Item>
                  {Object.entries(selectedObj.properties).map(([k, v]) => (
                    <Descriptions.Item key={k} label={k}>{String(v)}</Descriptions.Item>
                  ))}
                  <Descriptions.Item label={t('explorer.created')}>{new Date(selectedObj.created_at).toLocaleString()}</Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: 'linked',
              label: <><LinkOutlined /> {t('explorer.neighborsTitle')} ({neighbors.length})</>,
              children: neighbors.length === 0 ? (
                <Empty description={t('explorer.noNeighbors')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
              ) : (
                <Table
                  dataSource={neighbors.map((n) => {
                    const edge = neighborEdges.find(e => e.source_id === n.id || e.target_id === n.id);
                    const lt = edge ? linkTypes.find(l => l.id === edge.link_type_id) : undefined;
                    const ot = objectTypes.find(o => o.id === n.object_type_id);
                    return { ...n, _linkName: lt?.display_name || '—', _typeName: ot?.display_name || '—', _typeColor: ot?.color };
                  })}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  columns={[
                    { title: t('explorer.displayName'), dataIndex: 'display_name', key: 'name',
                      render: (v: string, r: Record<string, unknown>) => (
                        <Button type="link" size="small" style={{ padding: 0 }} onClick={async () => {
                          try {
                            const { data } = await instanceApi.getObject(r.id as string);
                            openDetail(data);
                          } catch { /* ignore */ }
                        }}>{v || (r.id as string).slice(0, 8)}</Button>
                      ),
                    },
                    { title: t('common.type'), dataIndex: '_typeName', key: 'type',
                      render: (v: string, r: Record<string, unknown>) => <Tag color={r._typeColor as string}>{v}</Tag>,
                    },
                    { title: t('ontology.linkType'), dataIndex: '_linkName', key: 'link', render: (v: string) => <Tag>{v}</Tag> },
                    { title: t('explorer.properties'), dataIndex: 'properties', key: 'props',
                      render: (props: Record<string, unknown>) => Object.entries(props).slice(0, 3).map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'graph',
              label: <><ApartmentOutlined /> {t('explorer.graphTab')}</>,
              children: (
                <ObjectGraphExplorer
                  rootObjectId={selectedObj.id}
                  rootDisplayName={selectedObj.display_name || selectedObj.id.slice(0, 8)}
                  rootObjectTypeId={selectedObj.object_type_id}
                  objectTypes={objectTypes}
                  linkTypes={linkTypes}
                  height="calc(100vh - 240px)"
                  onNodeSelect={async (objectId) => {
                    if (objectId === selectedObj.id) return;
                    try {
                      const { data } = await instanceApi.getObject(objectId);
                      openDetail(data);
                    } catch { /* ignore */ }
                  }}
                />
              ),
            },
            {
              key: 'actions',
              label: <><ThunderboltOutlined /> {t('explorer.actionsTab')}</>,
              children: (() => {
                const objActions = actionTypes.filter(a => !a.object_type_id || a.object_type_id === selectedObj.object_type_id);
                return objActions.length === 0 ? (
                  <Empty description={t('explorer.noActions')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
                ) : (
                  <List
                    dataSource={objActions}
                    renderItem={(action) => (
                      <List.Item
                        actions={[
                          <Button
                            key="exec"
                            type="primary"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            loading={executing === action.id}
                            onClick={() => executeAction(action.id, selectedObj)}
                          >
                            {t('common.execute')}
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={<Space><ThunderboltOutlined style={{ color: 'var(--color-yellow)' }} />{action.display_name}</Space>}
                          description={action.description || action.logic_type}
                        />
                      </List.Item>
                    )}
                  />
                );
              })(),
            },
            {
              key: 'lineage',
              label: <><NodeIndexOutlined /> {t('lineage.title')}</>,
              children: !lineage?.source_pipeline_id ? (
                <Empty description={t('lineage.noLineage')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
              ) : (
                <Descriptions column={1} bordered size="small">
                  {lineage.data_source ? (
                    <Descriptions.Item label={t('lineage.dataSource')}>
                      <Tag color="blue">{String((lineage.data_source as Record<string, unknown>).source_type)}</Tag>
                      {String((lineage.data_source as Record<string, unknown>).name)}
                    </Descriptions.Item>
                  ) : null}
                  {lineage.pipeline ? (
                    <Descriptions.Item label={t('lineage.pipeline')}>
                      {String((lineage.pipeline as Record<string, unknown>).name)}
                    </Descriptions.Item>
                  ) : null}
                  {lineage.pipeline_run ? (
                    <Descriptions.Item label={t('lineage.pipelineRun')}>
                      <Tag color={(lineage.pipeline_run as Record<string, unknown>).status === 'success' ? 'green' : 'red'}>
                        {String((lineage.pipeline_run as Record<string, unknown>).status)}
                      </Tag>
                      {String((lineage.pipeline_run as Record<string, unknown>).rows_processed)} rows
                      {(lineage.pipeline_run as Record<string, unknown>).started_at ? (
                        <> — {new Date(String((lineage.pipeline_run as Record<string, unknown>).started_at)).toLocaleString()}</>
                      ) : null}
                    </Descriptions.Item>
                  ) : null}
                  {lineage.source_row_index != null ? (
                    <Descriptions.Item label={t('lineage.rowIndex')}>
                      #{String(lineage.source_row_index)}
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>
              ),
            },
          ]} />
        )}
      </Modal>
    </div>
  );
}
