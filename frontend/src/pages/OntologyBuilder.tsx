import { useEffect, useState, useCallback, memo } from 'react';
import { Card, Button, Modal, Form, Input, Select, Table, Tag, Space, Typography, message, Popconfirm, ColorPicker, Switch, InputNumber, Tabs, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, ApartmentOutlined, LinkOutlined, DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType, Handle, Position, type NodeProps, type Node as FlowNode, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ontologyApi } from '@/services/api';
import { useOntologyStore } from '@/stores/ontologyStore';
import { useI18n } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import PageHeader from '@/components/PageHeader';
import type { ObjectType, LinkType, PropertyDefinition, ActionType } from '@/types';

const { Text } = Typography;

interface SchemaNodeData {
  color: string;
  name: string;
  displayName: string;
  propertyCount: number;
  propertyNames: string[];
  [key: string]: unknown;
}

const SchemaNode = memo(function SchemaNode({ data }: NodeProps<FlowNode<SchemaNodeData>>) {
  const d = data as SchemaNodeData;
  const [hovered, setHovered] = useState(false);
  const first3 = d.propertyNames.slice(0, 3);
  return (
    <div
      className="graph-node"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', borderColor: d.color }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} id="tl" />
      <div className="node-color-bar" style={{ background: d.color }} />
      <div className="node-content">
        <div style={{ fontSize: 9, color: d.color, fontWeight: 600, letterSpacing: '0.02em' }}>{d.name}</div>
        <div className="node-title">{d.displayName}</div>
        <div className="node-subtitle">{d.propertyCount} {d.propertyLabel as string}</div>
        {hovered && first3.length > 0 && (
          <div className="node-props">
            {first3.map((p, i) => (
              <div key={`${p}-${i}`} className="node-prop-item">{p}</div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} id="sr" />
    </div>
  );
});

const NODE_TYPES = { schemaNode: SchemaNode };

const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'datetime', 'json'];
const CARDINALITIES = [
  { value: 'one_to_one', label: '1:1' },
  { value: 'one_to_many', label: '1:N' },
  { value: 'many_to_many', label: 'N:N' },
];

export default function OntologyBuilder() {
  const { objectTypes, linkTypes, fetchAll, loading } = useOntologyStore();
  const { t } = useI18n();
  const { canWrite } = usePermission();
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ObjectType | null>(null);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [typeForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [propForm] = Form.useForm();
  const [actionForm] = Form.useForm();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const fetchActionTypes = useCallback(async () => {
    try {
      const { data } = await ontologyApi.listActionTypes();
      setActionTypes(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAll(); fetchActionTypes(); }, []);

  const buildGraph = useCallback(() => {
    // Force-directed layout for schema graph
    const N = objectTypes.length;
    const positions = new Map<string, { x: number; y: number }>();

    if (N > 0) {
      // Build adjacency from link types
      const adj = new Map<string, Set<string>>();
      for (const ot of objectTypes) adj.set(ot.id, new Set());
      for (const lt of linkTypes) {
        adj.get(lt.source_type_id)?.add(lt.target_type_id);
        adj.get(lt.target_type_id)?.add(lt.source_type_id);
      }

      // Init positions on a circle
      const ids = objectTypes.map((ot) => ot.id);
      const simNodes = ids.map((id, i) => {
        const angle = (2 * Math.PI * i) / N;
        const r = N <= 2 ? 0 : 200;
        return { id, x: r * Math.cos(angle), y: r * Math.sin(angle), vx: 0, vy: 0 };
      });
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

      const simEdges = linkTypes.map((l) => ({ source: l.source_type_id, target: l.target_type_id }));
      const ITERS = 100, REPULSION = 8000, SPRING_K = 0.008, IDEAL = 240, DAMPING = 0.82;

      for (let iter = 0; iter < ITERS; iter++) {
        const alpha = 1 - iter / ITERS;
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const a = simNodes[i], b = simNodes[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 30) dist = 30;
            const f = (REPULSION * alpha) / (dist * dist);
            const fx = (dx / dist) * f, fy = (dy / dist) * f;
            a.vx -= fx; a.vy -= fy;
            b.vx += fx; b.vy += fy;
          }
        }
        for (const e of simEdges) {
          const a = nodeMap.get(e.source), b = nodeMap.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = SPRING_K * (dist - IDEAL) * alpha;
          const fx = (dx / dist) * f, fy = (dy / dist) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        for (const n of simNodes) {
          n.vx -= n.x * 0.001 * alpha; n.vy -= n.y * 0.001 * alpha;
          n.vx *= DAMPING; n.vy *= DAMPING;
          n.x += n.vx; n.y += n.vy;
        }
      }
      for (const n of simNodes) positions.set(n.id, { x: n.x, y: n.y });
    }

    const typeNodes: FlowNode[] = objectTypes.map((ot) => {
      const pos = positions.get(ot.id) || { x: 0, y: 0 };
      return {
        id: ot.id,
        type: 'schemaNode',
        position: pos,
        data: {
          color: ot.color,
          name: ot.name,
          displayName: ot.display_name,
          propertyCount: ot.properties.length,
          propertyNames: ot.properties.map((p) => p.display_name || p.name),
          propertyLabel: t('ontology.properties'),
        } satisfies SchemaNodeData,
      };
    });

    const linkEdges: Edge[] = linkTypes.map((l) => {
      const sourceOt = objectTypes.find((ot) => ot.id === l.source_type_id);
      const color = sourceOt?.color || 'var(--border)';
      return {
        id: l.id,
        source: l.source_type_id,
        target: l.target_type_id,
        type: 'smoothstep',
        label: l.display_name,
        labelStyle: { fontSize: 9, fill: 'var(--text-tertiary)', fontWeight: 500 },
        labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
        style: { stroke: color, strokeWidth: 1.5, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-tertiary)', width: 12, height: 12 },
      };
    });

    setNodes(typeNodes);
    setEdges(linkEdges);
  }, [objectTypes, linkTypes, t]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  const createObjectType = async (values: Record<string, unknown>) => {
    try {
      const color = typeof values.color === 'string' ? values.color : (values.color as { toHexString: () => string })?.toHexString?.() || '#4A90D9';
      await ontologyApi.createObjectType({ ...values, color, properties: [] });
      message.success(t('ontology.typeCreated'));
      setTypeModalOpen(false);
      typeForm.resetFields();
      fetchAll();
    } catch { message.error(t('ontology.typeCreateFailed')); }
  };

  const createLinkType = async (values: Record<string, unknown>) => {
    try {
      await ontologyApi.createLinkType(values);
      message.success(t('ontology.linkCreated'));
      setLinkModalOpen(false);
      linkForm.resetFields();
      fetchAll();
    } catch { message.error(t('ontology.linkCreateFailed')); }
  };

  const addProperty = async (values: Record<string, unknown>) => {
    if (!selectedType) return;
    try {
      await ontologyApi.addProperty(selectedType.id, values);
      message.success(t('ontology.propertyAdded'));
      setPropModalOpen(false);
      propForm.resetFields();
      fetchAll();
    } catch { message.error(t('ontology.propertyAddFailed')); }
  };

  const deleteObjectType = async (id: string) => {
    try {
      await ontologyApi.deleteObjectType(id);
      message.success(t('ontology.deleted'));
      fetchAll();
    } catch { message.error(t('ontology.deleteFailed')); }
  };

  const createActionType = async (values: Record<string, unknown>) => {
    try {
      const params = values.parameters ? JSON.parse(values.parameters as string) : {};
      const config = values.logic_config ? JSON.parse(values.logic_config as string) : {};
      await ontologyApi.createActionType({
        name: values.name,
        display_name: values.display_name,
        description: values.description,
        object_type_id: values.object_type_id || null,
        parameters: params,
        logic_type: values.logic_type,
        logic_config: config,
      });
      message.success(t('ontology.actionCreated'));
      setActionModalOpen(false);
      actionForm.resetFields();
      fetchActionTypes();
    } catch {
      message.error(t('ontology.actionCreateFailed'));
    }
  };

  const propColumns = [
    { title: t('common.name'), dataIndex: 'display_name', key: 'name' },
    { title: t('ontology.field'), dataIndex: 'name', key: 'field', render: (v: string) => <code style={{ color: 'var(--primary)' }}>{v}</code> },
    { title: t('common.type'), dataIndex: 'data_type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('common.required'), dataIndex: 'required', key: 'req', render: (v: boolean) => v ? <Tag color="red">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag> },
    {
      title: '', key: 'actions', width: 50,
      render: (_: unknown, record: PropertyDefinition) => (
        <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={async () => { await ontologyApi.deleteProperty(record.id); fetchAll(); }}>
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('ontology.title')}
        subtitle={t('ontology.subtitle')}
        actions={canWrite ?
          <Space>
            <Button icon={<PlusOutlined />} onClick={() => setTypeModalOpen(true)}>{t('ontology.objectType')}</Button>
            <Button icon={<LinkOutlined />} onClick={() => setLinkModalOpen(true)}>{t('ontology.linkType')}</Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setActionModalOpen(true)}>{t('ontology.actionType')}</Button>
          </Space>
          : undefined
        }
      />

      <Tabs items={[
        {
          key: 'graph',
          label: <><ApartmentOutlined /> {t('ontology.graphView')}</>,
          children: (
            <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', position: 'relative' }} styles={{ body: { padding: 0, height: 'calc(100vh - 260px)', minHeight: 400 } }}>
              {/* Legend panel — consistent with ObjectGraphExplorer */}
              <div style={{
                position: 'absolute', top: 10, left: 10, zIndex: 10,
                background: 'var(--bg-surface)', border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12,
                maxWidth: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                  {objectTypes.length} nodes · {linkTypes.length} edges
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {objectTypes.map((ot) => (
                    <div key={ot.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: ot.color, flexShrink: 0 }} />
                      {ot.display_name}
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{ot.properties.length}p</span>
                    </div>
                  ))}
                </div>
              </div>
              <ReactFlow
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                nodeTypes={NODE_TYPES}
                fitView
                defaultEdgeOptions={{ type: 'smoothstep' }}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'var(--bg-body)', height: '100%' }}
              >
                <Background color="var(--border-subtle)" gap={24} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
                  maskColor="rgba(0,0,0,0.08)"
                  nodeColor={(node) => {
                    const ot = objectTypes.find((o) => o.id === node.id);
                    return ot?.color || 'var(--border)';
                  }}
                  nodeStrokeWidth={0}
                  pannable
                  zoomable
                />
              </ReactFlow>
            </Card>
          ),
        },
        {
          key: 'list',
          label: <><DatabaseOutlined /> {t('ontology.listView')}</>,
          children: objectTypes.length === 0 ? (
            <Empty description={t('ontology.emptyText')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {objectTypes.map((ot) => (
                <Card
                  key={ot.id}
                  title={<Space><div style={{ width: 12, height: 12, borderRadius: 3, background: ot.color }} /><span style={{ color: 'var(--text-primary)' }}>{ot.display_name}</span><Tag>{ot.name}</Tag></Space>}
                  extra={
                    <Space>
                      <Button size="small" onClick={() => { setSelectedType(ot); setPropModalOpen(true); }}>{t('ontology.addProperty')}</Button>
                      <Popconfirm title={t('ontology.deleteTypeConfirm')} onConfirm={() => deleteObjectType(ot.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
                >
                  {ot.description && <Text style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 12 }}>{ot.description}</Text>}
                  <Table dataSource={ot.properties} columns={propColumns} rowKey="id" pagination={false} size="small" />
                </Card>
              ))}
            </Space>
          ),
        },
        {
          key: 'actions',
          label: <><ThunderboltOutlined /> {t('ontology.actionsTab')}</>,
          children: actionTypes.length === 0 ? (
            <Empty description={t('ontology.noActions')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
          ) : (
            <Table
              dataSource={actionTypes}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t('ontology.displayName'), dataIndex: 'display_name', key: 'name', render: (v: string, r: ActionType) => <Space><ThunderboltOutlined style={{ color: 'var(--color-yellow)' }} /><Text strong>{v}</Text><Tag>{r.name}</Tag></Space> },
                { title: t('ontology.actionObjectType'), dataIndex: 'object_type_id', key: 'ot', render: (id: string) => { const ot = objectTypes.find(o => o.id === id); return ot ? <Tag color={ot.color}>{ot.display_name}</Tag> : id || '—'; } },
                { title: t('ontology.actionLogicType'), dataIndex: 'logic_type', key: 'logic', render: (v: string) => <Tag color="blue">{v}</Tag> },
                { title: t('common.description'), dataIndex: 'description', key: 'desc', render: (v: string) => v || '—' },
                { title: '', key: 'actions', width: 50, render: (_: unknown, r: ActionType) => (
                  <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={async () => { await ontologyApi.deleteActionType(r.id); fetchActionTypes(); }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                )},
              ]}
            />
          ),
        },
      ]} />

      <Modal title={t('ontology.createObjectType')} open={typeModalOpen} onCancel={() => setTypeModalOpen(false)} onOk={() => typeForm.submit()} okText={t('common.create')}>
        <Form form={typeForm} onFinish={createObjectType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input placeholder="e.g. customer_order" />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. Customer Order" />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="color" label={t('ontology.color')} initialValue="#4A90D9">
            <ColorPicker />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.createLinkType')} open={linkModalOpen} onCancel={() => setLinkModalOpen(false)} onOk={() => linkForm.submit()} okText={t('common.create')}>
        <Form form={linkForm} onFinish={createLinkType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. order_has_items" />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. Has Items" />
          </Form.Item>
          <Form.Item name="source_type_id" label={t('ontology.sourceType')} rules={[{ required: true }]}>
            <Select options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="target_type_id" label={t('ontology.targetType')} rules={[{ required: true }]}>
            <Select options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="cardinality" label={t('ontology.cardinality')} initialValue="many_to_many">
            <Select options={CARDINALITIES} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.addPropertyTo', { name: selectedType?.display_name || '' })} open={propModalOpen} onCancel={() => setPropModalOpen(false)} onOk={() => propForm.submit()} okText={t('common.add')}>
        <Form form={propForm} onFinish={addProperty} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. email_address" />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. Email Address" />
          </Form.Item>
          <Form.Item name="data_type" label={t('ontology.dataType')} rules={[{ required: true }]}>
            <Select options={DATA_TYPES.map((dt) => ({ value: dt, label: dt }))} />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="required" label={t('common.required')} valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
          <Form.Item name="order" label={t('ontology.order')} initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.createActionType')} open={actionModalOpen} onCancel={() => setActionModalOpen(false)} onOk={() => actionForm.submit()} okText={t('common.create')} width={640}>
        <Form form={actionForm} onFinish={createActionType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input placeholder="e.g. approve_purchase_order" />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. Approve Purchase Order" />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="object_type_id" label={t('ontology.actionObjectType')}>
            <Select allowClear options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="logic_type" label={t('ontology.actionLogicType')} initialValue="edit_object" rules={[{ required: true }]}>
            <Select options={[
              { value: 'edit_object', label: 'Edit Object' },
              { value: 'create_object', label: 'Create Object' },
              { value: 'delete_object', label: 'Delete Object' },
            ]} />
          </Form.Item>
          <Form.Item name="parameters" label={t('ontology.actionParameters')} help='e.g. {"parameters":[{"name":"target_id","type":"string","required":true}]}'>
            <Input.TextArea rows={4} placeholder='{"parameters": []}' />
          </Form.Item>
          <Form.Item name="logic_config" label={t('ontology.actionLogicConfig')} help='e.g. {"target":"{{target_id}}","updates":{"status":"approved"}}'>
            <Input.TextArea rows={4} placeholder='{}' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
