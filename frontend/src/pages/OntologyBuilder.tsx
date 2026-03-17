import { useEffect, useState, useCallback, memo } from 'react';
import { Card, Button, Modal, Form, Input, Select, Table, Tag, Space, Typography, message, Popconfirm, ColorPicker, Switch, InputNumber, Tabs, Empty, Spin, Badge, Collapse, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ApartmentOutlined, LinkOutlined, DatabaseOutlined, ThunderboltOutlined, ReloadOutlined, RobotOutlined, CheckCircleOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel, useNodesState, useEdgesState, useReactFlow, MarkerType, Handle, Position, type NodeProps, type Node as FlowNode, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ontologyApi } from '@/services/api';
import { useOntologyStore } from '@/stores/ontologyStore';
import { useI18n } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import PageHeader from '@/components/PageHeader';
import type { ObjectType, LinkType, PropertyDefinition, ActionType, OntologyFunction } from '@/types';

const { Text } = Typography;

interface SchemaNodeData {
  color: string;
  name: string;
  displayName: string;
  propertyCount: number;
  propertyNames: string[];
  [key: string]: unknown;
}

const HANDLE_STYLE = { opacity: 0, width: 6, height: 6 };

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
      <Handle type="target" position={Position.Top} id="t-in" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Top} id="t-out" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Right} id="r-in" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right} id="r-out" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Bottom} id="b-in" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b-out" style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Left} id="l-in" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left} id="l-out" style={HANDLE_STYLE} />
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
    </div>
  );
});

const NODE_TYPES = { schemaNode: SchemaNode };

const FIT_VIEW_OPTS = { padding: 0.15, maxZoom: 1.1, minZoom: 0.4 };

interface GraphCanvasProps {
  nodes: FlowNode[];
  edges: Edge[];
  onNodesChange: Parameters<typeof ReactFlow>[0]['onNodesChange'];
  onEdgesChange: Parameters<typeof ReactFlow>[0]['onEdgesChange'];
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  onNodeClick: (_event: React.MouseEvent, node: FlowNode) => void;
  onEdgeClick: (_event: React.MouseEvent, edge: Edge) => void;
  onPaneClick: () => void;
  onResetLayout: () => void;
  resetLabel: string;
}

function GraphCanvas({ nodes, edges, onNodesChange, onEdgesChange, objectTypes, onNodeClick, onEdgeClick, onPaneClick, onResetLayout, resetLabel }: GraphCanvasProps) {
  const { fitView } = useReactFlow();
  const handleReset = useCallback(() => {
    onResetLayout();
    setTimeout(() => fitView(FIT_VIEW_OPTS), 60);
  }, [onResetLayout, fitView]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={NODE_TYPES}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={FIT_VIEW_OPTS}
      defaultEdgeOptions={{ type: 'smoothstep' }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={2}
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
      <Panel position="top-right">
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleReset}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--card-border)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {resetLabel}
        </Button>
      </Panel>
    </ReactFlow>
  );
}

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
  const [editTypeModalOpen, setEditTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<ObjectType | null>(null);
  const [editLinkModalOpen, setEditLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkType | null>(null);
  const [editActionModalOpen, setEditActionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionType | null>(null);
  const [editPropModalOpen, setEditPropModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<PropertyDefinition | null>(null);
  const [editTypeForm] = Form.useForm();
  const [editLinkForm] = Form.useForm();
  const [editActionForm] = Form.useForm();
  const [editPropForm] = Form.useForm();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [functions, setFunctions] = useState<OntologyFunction[]>([]);
  const [funcModalOpen, setFuncModalOpen] = useState(false);
  const [editFuncModalOpen, setEditFuncModalOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<OntologyFunction | null>(null);
  const [testFuncId, setTestFuncId] = useState<string | null>(null);
  const [testInputs, setTestInputs] = useState('{}');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [funcForm] = Form.useForm();
  const [editFuncForm] = Form.useForm();

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<Record<string, unknown> | null>(null);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiDescription, setAiDescription] = useState('');

  const fetchActionTypes = useCallback(async () => {
    try {
      const { data } = await ontologyApi.listActionTypes();
      setActionTypes(data);
    } catch { /* ignore */ }
  }, []);

  const fetchFunctions = useCallback(async () => {
    try {
      const { data } = await ontologyApi.listFunctions();
      setFunctions(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAll(); fetchActionTypes(); fetchFunctions(); }, []);

  const buildGraph = useCallback(() => {
    const N = objectTypes.length;
    const positions = new Map<string, { x: number; y: number }>();

    if (N > 0) {
      const ids = objectTypes.map((ot) => ot.id);
      const simNodes = ids.map((id, i) => {
        const angle = (2 * Math.PI * i) / N + Math.PI / 6;
        const r = N <= 2 ? 120 : Math.max(180, N * 35);
        return { id, x: r * Math.cos(angle), y: r * Math.sin(angle), vx: 0, vy: 0 };
      });
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const simEdges = linkTypes.map((l) => ({ source: l.source_type_id, target: l.target_type_id }));

      const ITERS = 300, REPULSION = 18000, SPRING_K = 0.006, IDEAL = 260, DAMPING = 0.85;

      for (let iter = 0; iter < ITERS; iter++) {
        const alpha = 1 - iter / ITERS;
        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const a = simNodes[i], b = simNodes[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 60) dist = 60;
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
          n.vx -= n.x * 0.0005 * alpha; n.vy -= n.y * 0.0005 * alpha;
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

    const NODE_W = 140, NODE_H = 70;

    const pickHandles = (srcId: string, tgtId: string): { sourceHandle: string; targetHandle: string } => {
      const sp = positions.get(srcId) || { x: 0, y: 0 };
      const tp = positions.get(tgtId) || { x: 0, y: 0 };
      const scx = sp.x + NODE_W / 2, scy = sp.y + NODE_H / 2;
      const tcx = tp.x + NODE_W / 2, tcy = tp.y + NODE_H / 2;
      const dx = tcx - scx, dy = tcy - scy;
      const angle = Math.atan2(dy, dx);

      let srcSide: string, tgtSide: string;
      if (angle >= -Math.PI / 4 && angle < Math.PI / 4) {
        srcSide = 'r'; tgtSide = 'l';
      } else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) {
        srcSide = 'b'; tgtSide = 't';
      } else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) {
        srcSide = 't'; tgtSide = 'b';
      } else {
        srcSide = 'l'; tgtSide = 'r';
      }
      return { sourceHandle: `${srcSide}-out`, targetHandle: `${tgtSide}-in` };
    };

    const linkEdges: Edge[] = linkTypes.map((l) => {
      const sourceOt = objectTypes.find((ot) => ot.id === l.source_type_id);
      const color = sourceOt?.color || 'var(--border)';
      const handles = pickHandles(l.source_type_id, l.target_type_id);
      return {
        id: l.id,
        source: l.source_type_id,
        target: l.target_type_id,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'smoothstep',
        label: l.display_name,
        labelStyle: { fontSize: 9, fill: 'var(--text-tertiary)', fontWeight: 500, cursor: 'pointer' },
        labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
        style: { stroke: color, strokeWidth: 1.5, opacity: 0.6, cursor: 'pointer' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-tertiary)', width: 12, height: 12 },
        interactionWidth: 20,
      };
    });

    setNodes(typeNodes);
    setEdges(linkEdges);
  }, [objectTypes, linkTypes, t]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const isSelected = e.id === selectedEdgeId;
        const sourceOt = objectTypes.find((ot) => ot.id === e.source);
        const color = sourceOt?.color || 'var(--border)';
        return {
          ...e,
          animated: isSelected,
          style: {
            stroke: color,
            strokeWidth: isSelected ? 3 : 1.5,
            opacity: isSelected ? 1 : 0.6,
            cursor: 'pointer',
          },
          labelStyle: {
            fontSize: isSelected ? 10 : 9,
            fill: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontWeight: isSelected ? 700 : 500,
            cursor: 'pointer',
          },
        };
      })
    );
  }, [selectedEdgeId, objectTypes, setEdges]);

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
      const sideEffects = values.side_effects ? JSON.parse(values.side_effects as string) : [];
      await ontologyApi.createActionType({
        name: values.name,
        display_name: values.display_name,
        description: values.description,
        object_type_id: values.object_type_id || null,
        parameters: params,
        logic_type: values.logic_type,
        logic_config: config,
        side_effects: sideEffects,
      });
      message.success(t('ontology.actionCreated'));
      setActionModalOpen(false);
      actionForm.resetFields();
      fetchActionTypes();
    } catch {
      message.error(t('ontology.actionCreateFailed'));
    }
  };

  const openEditType = (ot: ObjectType) => {
    setEditingType(ot);
    editTypeForm.setFieldsValue({
      display_name: ot.display_name,
      description: ot.description || '',
      color: ot.color,
    });
    setEditTypeModalOpen(true);
  };

  const updateObjectType = async (values: Record<string, unknown>) => {
    if (!editingType) return;
    try {
      const color = typeof values.color === 'string' ? values.color : (values.color as { toHexString: () => string })?.toHexString?.() || editingType.color;
      await ontologyApi.updateObjectType(editingType.id, { ...values, color });
      message.success(t('ontology.typeUpdated'));
      setEditTypeModalOpen(false);
      setEditingType(null);
      fetchAll();
    } catch { message.error(t('ontology.typeUpdateFailed')); }
  };

  const openEditLink = (lt: LinkType) => {
    setEditingLink(lt);
    editLinkForm.setFieldsValue({
      display_name: lt.display_name,
      description: lt.description || '',
      cardinality: lt.cardinality,
    });
    setEditLinkModalOpen(true);
  };

  const updateLinkType = async (values: Record<string, unknown>) => {
    if (!editingLink) return;
    try {
      await ontologyApi.updateLinkType(editingLink.id, values);
      message.success(t('ontology.linkUpdated'));
      setEditLinkModalOpen(false);
      setEditingLink(null);
      fetchAll();
    } catch { message.error(t('ontology.linkUpdateFailed')); }
  };

  const openEditAction = (action: ActionType) => {
    setEditingAction(action);
    const se = (action as ActionType & { side_effects?: unknown[] }).side_effects;
    editActionForm.setFieldsValue({
      display_name: action.display_name,
      description: action.description || '',
      object_type_id: action.object_type_id || undefined,
      logic_type: action.logic_type,
      parameters: JSON.stringify(action.parameters, null, 2),
      logic_config: JSON.stringify(action.logic_config, null, 2),
      side_effects: se && se.length > 0 ? JSON.stringify(se, null, 2) : '',
    });
    setEditActionModalOpen(true);
  };

  const updateActionType = async (values: Record<string, unknown>) => {
    if (!editingAction) return;
    try {
      const params = values.parameters ? JSON.parse(values.parameters as string) : undefined;
      const config = values.logic_config ? JSON.parse(values.logic_config as string) : undefined;
      const sideEffects = values.side_effects ? JSON.parse(values.side_effects as string) : [];
      await ontologyApi.updateActionType(editingAction.id, {
        display_name: values.display_name,
        description: values.description,
        object_type_id: values.object_type_id || null,
        logic_type: values.logic_type,
        ...(params !== undefined && { parameters: params }),
        ...(config !== undefined && { logic_config: config }),
        side_effects: sideEffects,
      });
      message.success(t('ontology.actionUpdated'));
      setEditActionModalOpen(false);
      setEditingAction(null);
      fetchActionTypes();
    } catch { message.error(t('ontology.actionUpdateFailed')); }
  };

  const openEditProp = (prop: PropertyDefinition) => {
    setEditingProp(prop);
    editPropForm.setFieldsValue({
      display_name: prop.display_name,
      description: prop.description || '',
      required: prop.required,
      order: prop.order,
    });
    setEditPropModalOpen(true);
  };

  const updateProperty = async (values: Record<string, unknown>) => {
    if (!editingProp) return;
    try {
      await ontologyApi.updateProperty(editingProp.id, values);
      message.success(t('ontology.propertyUpdated'));
      setEditPropModalOpen(false);
      setEditingProp(null);
      fetchAll();
    } catch { message.error(t('ontology.propertyUpdateFailed')); }
  };

  const handleAiGenerate = useCallback(async () => {
    if (!aiDescription.trim()) return;
    setAiGenerating(true);
    setAiPlan(null);
    try {
      const { data } = await ontologyApi.generateOntology(aiDescription);
      setAiPlan(data.plan);
    } catch {
      message.error(t('ontology.aiGenerateFailed'));
    } finally {
      setAiGenerating(false);
    }
  }, [aiDescription, t]);

  const handleAiApply = useCallback(async () => {
    if (!aiPlan) return;
    setAiApplying(true);
    try {
      await ontologyApi.applyOntologyPlan(aiPlan);
      message.success(t('ontology.aiGenerateSuccess'));
      setAiModalOpen(false);
      setAiPlan(null);
      setAiDescription('');
      fetchAll();
      fetchActionTypes();
      fetchFunctions();
    } catch {
      message.error(t('ontology.aiGenerateFailed'));
    } finally {
      setAiApplying(false);
    }
  }, [aiPlan, t, fetchAll, fetchActionTypes, fetchFunctions]);

  const createFunc = async (values: Record<string, unknown>) => {
    try {
      const inputSchema = values.input_schema ? JSON.parse(values.input_schema as string) : {};
      const outputSchema = values.output_schema ? JSON.parse(values.output_schema as string) : {};
      await ontologyApi.createFunction({
        name: values.name,
        display_name: values.display_name,
        description: values.description,
        implementation: values.implementation,
        input_schema: inputSchema,
        output_schema: outputSchema,
      });
      message.success(t('ontology.functionCreated'));
      setFuncModalOpen(false);
      funcForm.resetFields();
      fetchFunctions();
    } catch { message.error(t('ontology.functionCreateFailed')); }
  };

  const openEditFunc = (fn: OntologyFunction) => {
    setEditingFunc(fn);
    editFuncForm.setFieldsValue({
      display_name: fn.display_name,
      description: fn.description || '',
      implementation: fn.implementation || '',
      input_schema: JSON.stringify(fn.input_schema, null, 2),
      output_schema: JSON.stringify(fn.output_schema, null, 2),
    });
    setEditFuncModalOpen(true);
  };

  const updateFunc = async (values: Record<string, unknown>) => {
    if (!editingFunc) return;
    try {
      const inputSchema = values.input_schema ? JSON.parse(values.input_schema as string) : undefined;
      const outputSchema = values.output_schema ? JSON.parse(values.output_schema as string) : undefined;
      await ontologyApi.updateFunction(editingFunc.id, {
        display_name: values.display_name,
        description: values.description,
        implementation: values.implementation,
        ...(inputSchema !== undefined && { input_schema: inputSchema }),
        ...(outputSchema !== undefined && { output_schema: outputSchema }),
      });
      message.success(t('ontology.functionUpdated'));
      setEditFuncModalOpen(false);
      setEditingFunc(null);
      fetchFunctions();
    } catch { message.error(t('ontology.functionUpdateFailed')); }
  };

  const testFunc = async (funcId: string) => {
    try {
      const inputs = JSON.parse(testInputs);
      const { data } = await ontologyApi.executeFunction(funcId, inputs);
      setTestResult(JSON.stringify(data.result, null, 2));
      message.success(t('ontology.functionExecuted'));
    } catch {
      message.error(t('ontology.functionExecuteFailed'));
    }
  };

  const propColumns = [
    { title: t('common.name'), dataIndex: 'display_name', key: 'name' },
    { title: t('ontology.field'), dataIndex: 'name', key: 'field', render: (v: string) => <code style={{ color: 'var(--primary)' }}>{v}</code> },
    { title: t('common.type'), dataIndex: 'data_type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    { title: t('common.required'), dataIndex: 'required', key: 'req', render: (v: boolean) => v ? <Tag color="red">{t('common.yes')}</Tag> : <Tag>{t('common.no')}</Tag> },
    {
      title: '', key: 'actions', width: 80,
      render: (_: unknown, record: PropertyDefinition) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditProp(record)} />
          <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={async () => { await ontologyApi.deleteProperty(record.id); fetchAll(); }}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
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
            <Button type="primary" icon={<RobotOutlined />} onClick={() => setAiModalOpen(true)}>{t('ontology.aiGenerate')}</Button>
            <Button icon={<PlusOutlined />} onClick={() => setTypeModalOpen(true)}>{t('ontology.objectType')}</Button>
            <Button icon={<LinkOutlined />} onClick={() => setLinkModalOpen(true)}>{t('ontology.linkType')}</Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setActionModalOpen(true)}>{t('ontology.actionType')}</Button>
            <Button onClick={() => setFuncModalOpen(true)}>ƒ(x)</Button>
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
              <ReactFlowProvider>
                <GraphCanvas
                  nodes={nodes} edges={edges}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  objectTypes={objectTypes} linkTypes={linkTypes}
                  onNodeClick={(_event: React.MouseEvent, node: FlowNode) => {
                    setSelectedEdgeId(null);
                    const ot = objectTypes.find((o) => o.id === node.id);
                    if (ot) openEditType(ot);
                  }}
                  onEdgeClick={(_event: React.MouseEvent, edge: Edge) => {
                    setSelectedEdgeId(edge.id);
                    const lt = linkTypes.find((l) => l.id === edge.id);
                    if (lt) openEditLink(lt);
                  }}
                  onPaneClick={() => setSelectedEdgeId(null)}
                  onResetLayout={buildGraph}
                  resetLabel={t('ontology.resetLayout')}
                />
              </ReactFlowProvider>
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
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditType(ot)}>{t('common.edit')}</Button>
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
                { title: '', key: 'actions', width: 80, render: (_: unknown, r: ActionType) => (
                  <Space>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditAction(r)} />
                    <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={async () => { await ontologyApi.deleteActionType(r.id); fetchActionTypes(); }}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          ),
        },
        {
          key: 'links',
          label: <><LinkOutlined /> {t('ontology.linkTypesTab')}</>,
          children: linkTypes.length === 0 ? (
            <Empty description={t('ontology.noLinkTypes')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
          ) : (
            <Table
              dataSource={linkTypes}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: t('ontology.displayName'), dataIndex: 'display_name', key: 'name', render: (v: string, r: LinkType) => <Space><LinkOutlined style={{ color: 'var(--primary)' }} /><Text strong>{v}</Text><Tag>{r.name}</Tag></Space> },
                { title: t('ontology.sourceType'), dataIndex: 'source_type_id', key: 'src', render: (id: string) => { const ot = objectTypes.find(o => o.id === id); return ot ? <Tag color={ot.color}>{ot.display_name}</Tag> : id || '—'; } },
                { title: t('ontology.targetType'), dataIndex: 'target_type_id', key: 'tgt', render: (id: string) => { const ot = objectTypes.find(o => o.id === id); return ot ? <Tag color={ot.color}>{ot.display_name}</Tag> : id || '—'; } },
                { title: t('ontology.cardinality'), dataIndex: 'cardinality', key: 'card', render: (v: string) => <Tag>{v === 'one_to_one' ? '1:1' : v === 'one_to_many' ? '1:N' : 'N:N'}</Tag> },
                { title: '', key: 'actions', width: 80, render: (_: unknown, r: LinkType) => (
                  <Space>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditLink(r)} />
                    <Popconfirm title={t('ontology.deleteLinkConfirm')} onConfirm={async () => { await ontologyApi.deleteLinkType(r.id); fetchAll(); }}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                )},
              ]}
            />
          ),
        },
        {
          key: 'functions',
          label: <>ƒ(x) {t('ontology.functionsTab')}</>,
          children: functions.length === 0 ? (
            <Empty description={t('ontology.noFunctions')} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '48px 0' }} />
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {functions.map((fn) => (
                <Card
                  key={fn.id}
                  size="small"
                  title={<Space><Text strong>{fn.display_name}</Text><Tag>{fn.name}</Tag></Space>}
                  extra={
                    <Space>
                      <Button size="small" onClick={() => { setTestFuncId(fn.id); setTestInputs('{}'); setTestResult(null); }}>{t('ontology.testFunction')}</Button>
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditFunc(fn)} />
                      <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={async () => { await ontologyApi.deleteFunction(fn.id); fetchFunctions(); message.success(t('ontology.functionDeleted')); }}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
                >
                  {fn.description && <div style={{ marginBottom: 8, color: 'var(--text-secondary)', fontSize: 13 }}>{fn.description}</div>}
                  <code style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-body)', borderRadius: 6, fontSize: 13 }}>{fn.implementation || '—'}</code>
                  {testFuncId === fn.id && (
                    <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-body)', borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>{t('ontology.testFunction')}</div>
                      <Input.TextArea
                        rows={2}
                        value={testInputs}
                        onChange={(e) => setTestInputs(e.target.value)}
                        placeholder={t('ontology.testInputs')}
                        style={{ marginBottom: 8 }}
                      />
                      <Button type="primary" size="small" onClick={() => testFunc(fn.id)}>{t('common.execute')}</Button>
                      {testResult !== null && (
                        <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-surface)', borderRadius: 4, fontFamily: 'monospace', fontSize: 13 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('ontology.testResult')}</div>
                          {testResult}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </Space>
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
          <Form.Item name="side_effects" label={t('ontology.sideEffects')} help={t('ontology.sideEffectsHelp')}>
            <Input.TextArea rows={4} placeholder={t('ontology.sideEffectsPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.editObjectType')} open={editTypeModalOpen} onCancel={() => { setEditTypeModalOpen(false); setEditingType(null); }} onOk={() => editTypeForm.submit()} okText={t('common.save')}>
        <Form form={editTypeForm} onFinish={updateObjectType} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="color" label={t('ontology.color')}>
            <ColorPicker />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.editLinkType')} open={editLinkModalOpen} onCancel={() => { setEditLinkModalOpen(false); setEditingLink(null); }} onOk={() => editLinkForm.submit()} okText={t('common.save')}>
        <Form form={editLinkForm} onFinish={updateLinkType} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="cardinality" label={t('ontology.cardinality')}>
            <Select options={CARDINALITIES} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.editActionType')} open={editActionModalOpen} onCancel={() => { setEditActionModalOpen(false); setEditingAction(null); }} onOk={() => editActionForm.submit()} okText={t('common.save')} width={640}>
        <Form form={editActionForm} onFinish={updateActionType} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="object_type_id" label={t('ontology.actionObjectType')}>
            <Select allowClear options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="logic_type" label={t('ontology.actionLogicType')} rules={[{ required: true }]}>
            <Select options={[
              { value: 'edit_object', label: 'Edit Object' },
              { value: 'create_object', label: 'Create Object' },
              { value: 'delete_object', label: 'Delete Object' },
            ]} />
          </Form.Item>
          <Form.Item name="parameters" label={t('ontology.actionParameters')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="logic_config" label={t('ontology.actionLogicConfig')}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="side_effects" label={t('ontology.sideEffects')} help={t('ontology.sideEffectsHelp')}>
            <Input.TextArea rows={4} placeholder={t('ontology.sideEffectsPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ontology.editProperty')} open={editPropModalOpen} onCancel={() => { setEditPropModalOpen(false); setEditingProp(null); }} onOk={() => editPropForm.submit()} okText={t('common.save')}>
        <Form form={editPropForm} onFinish={updateProperty} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="required" label={t('common.required')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="order" label={t('ontology.order')}>
            <InputNumber min={0} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Function Create Modal */}
      <Modal title={t('ontology.createFunction')} open={funcModalOpen} onCancel={() => setFuncModalOpen(false)} onOk={() => funcForm.submit()} okText={t('common.create')} width={640}>
        <Form form={funcForm} onFinish={createFunc} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input placeholder="e.g. calc_total_amount" />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input placeholder="e.g. 计算总金额" />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="implementation" label={t('ontology.functionImpl')} help={t('ontology.functionImplHelp')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="quantity * unit_price" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="input_schema" label={t('ontology.inputSchema')} help='e.g. {"quantity": "integer", "unit_price": "float"}'>
            <Input.TextArea rows={3} placeholder='{}' />
          </Form.Item>
          <Form.Item name="output_schema" label={t('ontology.outputSchema')}>
            <Input.TextArea rows={2} placeholder='{}' />
          </Form.Item>
        </Form>
      </Modal>

      {/* Function Edit Modal */}
      <Modal title={t('ontology.editFunction')} open={editFuncModalOpen} onCancel={() => { setEditFuncModalOpen(false); setEditingFunc(null); }} onOk={() => editFuncForm.submit()} okText={t('common.save')} width={640}>
        <Form form={editFuncForm} onFinish={updateFunc} layout="vertical">
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="implementation" label={t('ontology.functionImpl')} help={t('ontology.functionImplHelp')} rules={[{ required: true }]}>
            <Input.TextArea rows={3} style={{ fontFamily: 'monospace' }} />
          </Form.Item>
          <Form.Item name="input_schema" label={t('ontology.inputSchema')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="output_schema" label={t('ontology.outputSchema')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Ontology Generator Modal */}
      <Modal
        title={<Space><RobotOutlined style={{ color: 'var(--primary)' }} />{t('ontology.aiGenerateTitle')}</Space>}
        open={aiModalOpen}
        onCancel={() => { if (!aiGenerating && !aiApplying) { setAiModalOpen(false); setAiPlan(null); } }}
        footer={null}
        width={720}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
          {t('ontology.aiGenerateDesc')}
        </div>

        <Input.TextArea
          rows={4}
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          placeholder={t('ontology.aiGeneratePlaceholder')}
          disabled={aiGenerating || aiApplying}
          style={{ marginBottom: 12 }}
        />

        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleAiGenerate}
            loading={aiGenerating}
            disabled={!aiDescription.trim() || aiApplying}
          >
            {aiGenerating ? t('ontology.aiGenerating') : aiPlan ? t('ontology.aiRegenerate') : t('ontology.aiGenerate')}
          </Button>
        </Space>

        {aiGenerating && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: 'var(--text-secondary)' }}>{t('ontology.aiGenerating')}</div>
          </div>
        )}

        {aiPlan && !aiGenerating && (() => {
          const otList = (aiPlan.object_types as Array<Record<string, unknown>>) || [];
          const ltList = (aiPlan.link_types as Array<Record<string, unknown>>) || [];
          const atList = (aiPlan.action_types as Array<Record<string, unknown>>) || [];
          const warns = (aiPlan._warnings as string[]) || [];
          const colorMap: Record<string, string> = {};
          otList.forEach(ot => { colorMap[ot.name as string] = (ot.color as string) || '#4A90D9'; });

          return (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
              {t('ontology.aiPreviewTitle')}
            </div>

            {warns.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`AI 自动修正了 ${warns.length} 个问题`}
                description={<ul style={{ margin: 0, paddingLeft: 16 }}>{warns.map((w, i) => <li key={i} style={{ fontSize: 12 }}>{w}</li>)}</ul>}
              />
            )}

            <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              {t('ontology.aiPreviewDesc')}
            </div>

            <Collapse
              defaultActiveKey={['types', 'links']}
              items={[
                {
                  key: 'types',
                  label: <Space><Badge count={otList.length} style={{ backgroundColor: 'var(--primary)' }} />{t('ontology.aiObjectTypes')}</Space>,
                  children: (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {otList.map((ot, i) => (
                        <Card key={i} size="small" style={{ background: 'var(--bg-body)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${(ot.color as string) || '#4A90D9'}` }}>
                          <Space>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: (ot.color as string) || '#4A90D9' }} />
                            <Text strong>{ot.display_name as string}</Text>
                            <Tag>{ot.name as string}</Tag>
                            <Tag color="blue">{(ot.properties as unknown[])?.length || 0} {t('ontology.aiProperties')}</Tag>
                          </Space>
                          {typeof ot.description === 'string' && ot.description && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{ot.description}</div>
                          )}
                        </Card>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'links',
                  label: <Space><Badge count={ltList.length} style={{ backgroundColor: '#50C878' }} />{t('ontology.aiLinkTypes')}</Space>,
                  children: (
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {ltList.map((lt, i) => {
                        const srcName = lt.source_type_name as string;
                        const tgtName = lt.target_type_name as string;
                        const srcColor = colorMap[srcName] || '#999';
                        const tgtColor = colorMap[tgtName] || '#999';
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-body)', border: '1px solid var(--card-border)' }}>
                            <Tag color={srcColor} style={{ margin: 0, color: '#fff', fontWeight: 500 }}>{srcName}</Tag>
                            <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 12 }} />
                            <Tag color={tgtColor} style={{ margin: 0, color: '#fff', fontWeight: 500 }}>{tgtName}</Tag>
                            <Text strong style={{ fontSize: 13 }}>{lt.display_name as string}</Text>
                            <Tag style={{ marginLeft: 'auto' }}>{lt.cardinality as string}</Tag>
                          </div>
                        );
                      })}
                    </Space>
                  ),
                },
                {
                  key: 'actions',
                  label: <Space><Badge count={atList.length} style={{ backgroundColor: '#FFB347' }} />{t('ontology.aiActionTypes')}</Space>,
                  children: (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {atList.map((at, i) => (
                        <div key={i} style={{ fontSize: 13 }}>
                          <ThunderboltOutlined style={{ marginRight: 6, color: 'var(--color-yellow)' }} />
                          <Text strong>{at.display_name as string}</Text>
                          <Tag style={{ marginLeft: 8 }}>{at.logic_type as string}</Tag>
                          {typeof at.object_type_name === 'string' && at.object_type_name && <Tag color={colorMap[at.object_type_name]}>{at.object_type_name}</Tag>}
                        </div>
                      ))}
                    </Space>
                  ),
                },
              ]}
            />

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleAiApply}
                loading={aiApplying}
                size="large"
              >
                {aiApplying ? t('ontology.aiApplying') : t('ontology.aiApply')}
              </Button>
            </div>
          </div>
          );
        })()}
      </Modal>
    </div>
  );
}
