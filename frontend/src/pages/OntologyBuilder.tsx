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
  propertyLabel: string;
  canDelete?: boolean;
  deleteLabel?: string;
  deleteConfirm?: string;
  onDelete?: () => void;
  [key: string]: unknown;
}

interface AiPropertyDraft {
  name: string;
  display_name: string;
  data_type: string;
  description?: string;
  required?: boolean;
  indexed?: boolean;
  order?: number;
}

interface AiObjectTypeDraft {
  name: string;
  display_name: string;
  description?: string;
  icon?: string;
  color?: string;
  primary_key_property?: string;
  properties: AiPropertyDraft[];
}

interface AiLinkTypeDraft {
  name: string;
  display_name: string;
  description?: string;
  source_type_name: string;
  target_type_name: string;
  cardinality: string;
}

interface AiActionTypeDraft {
  name: string;
  display_name: string;
  description?: string;
  object_type_name?: string;
  logic_type: string;
  parameters: Record<string, unknown>;
  logic_config: Record<string, unknown>;
}

interface AiOntologyPlan {
  object_types: AiObjectTypeDraft[];
  link_types: AiLinkTypeDraft[];
  action_types: AiActionTypeDraft[];
  _warnings?: string[];
}

const HANDLE_STYLE = { opacity: 0, width: 6, height: 6 };

const SchemaNode = memo(function SchemaNode({ data }: NodeProps<FlowNode<SchemaNodeData>>) {
  const d = data as SchemaNodeData;
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const first3 = d.propertyNames.slice(0, 3);
  return (
    <div
      className="graph-node"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!confirmOpen) setHovered(false); }}
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
      {d.canDelete && d.onDelete && (
        <Popconfirm
          title={d.deleteConfirm}
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) setHovered(false);
          }}
          onConfirm={(event) => {
            event?.stopPropagation();
            setConfirmOpen(false);
            d.onDelete?.();
          }}
          onCancel={(event) => {
            event?.stopPropagation();
            setConfirmOpen(false);
          }}
          onPopupClick={(event) => event.stopPropagation()}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={d.deleteLabel}
            onClick={(event) => {
              event.stopPropagation();
              setConfirmOpen(true);
            }}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              zIndex: 2,
              width: 26,
              height: 26,
              minWidth: 26,
              padding: 0,
              borderRadius: 999,
              background: 'var(--bg-surface)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              opacity: hovered || confirmOpen ? 1 : 0,
              pointerEvents: hovered || confirmOpen ? 'auto' : 'none',
            }}
          />
        </Popconfirm>
      )}
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

function extractBackendDetail(error: unknown): string | undefined {
  const maybe = error as { response?: { data?: { detail?: unknown } } };
  const detail = maybe?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }
  return undefined;
}

function normalizeAiPlan(plan: Record<string, unknown>): AiOntologyPlan {
  const objectTypes = Array.isArray(plan.object_types) ? plan.object_types : [];
  const linkTypes = Array.isArray(plan.link_types) ? plan.link_types : [];
  const actionTypes = Array.isArray(plan.action_types) ? plan.action_types : [];
  const warnings = Array.isArray(plan._warnings) ? plan._warnings.filter((item): item is string => typeof item === 'string') : [];

  return {
    object_types: objectTypes.map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const properties = Array.isArray(record.properties) ? record.properties : [];
      return {
        name: typeof record.name === 'string' ? record.name : `object_type_${index + 1}`,
        display_name: typeof record.display_name === 'string' ? record.display_name : typeof record.name === 'string' ? record.name : `Object Type ${index + 1}`,
        description: typeof record.description === 'string' ? record.description : '',
        icon: typeof record.icon === 'string' ? record.icon : 'cube',
        color: typeof record.color === 'string' ? record.color : '#4A90D9',
        primary_key_property: typeof record.primary_key_property === 'string' ? record.primary_key_property : '',
        properties: properties.map((prop, propIndex) => {
          const propRecord = (prop ?? {}) as Record<string, unknown>;
          return {
            name: typeof propRecord.name === 'string' ? propRecord.name : `property_${propIndex + 1}`,
            display_name: typeof propRecord.display_name === 'string' ? propRecord.display_name : typeof propRecord.name === 'string' ? propRecord.name : `Property ${propIndex + 1}`,
            data_type: typeof propRecord.data_type === 'string' ? propRecord.data_type : 'string',
            description: typeof propRecord.description === 'string' ? propRecord.description : '',
            required: Boolean(propRecord.required),
            indexed: Boolean(propRecord.indexed),
            order: typeof propRecord.order === 'number' ? propRecord.order : propIndex,
          };
        }),
      };
    }),
    link_types: linkTypes.map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        name: typeof record.name === 'string' ? record.name : `link_type_${index + 1}`,
        display_name: typeof record.display_name === 'string' ? record.display_name : typeof record.name === 'string' ? record.name : `Link Type ${index + 1}`,
        description: typeof record.description === 'string' ? record.description : '',
        source_type_name: typeof record.source_type_name === 'string' ? record.source_type_name : '',
        target_type_name: typeof record.target_type_name === 'string' ? record.target_type_name : '',
        cardinality: typeof record.cardinality === 'string' ? record.cardinality : 'many_to_many',
      };
    }),
    action_types: actionTypes.map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        name: typeof record.name === 'string' ? record.name : `action_type_${index + 1}`,
        display_name: typeof record.display_name === 'string' ? record.display_name : typeof record.name === 'string' ? record.name : `Action Type ${index + 1}`,
        description: typeof record.description === 'string' ? record.description : '',
        object_type_name: typeof record.object_type_name === 'string' ? record.object_type_name : '',
        logic_type: typeof record.logic_type === 'string' ? record.logic_type : 'edit_object',
        parameters: typeof record.parameters === 'object' && record.parameters !== null ? record.parameters as Record<string, unknown> : {},
        logic_config: typeof record.logic_config === 'object' && record.logic_config !== null ? record.logic_config as Record<string, unknown> : {},
      };
    }),
    ...(warnings.length > 0 ? { _warnings: warnings } : {}),
  };
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

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
  const [aiPlan, setAiPlan] = useState<AiOntologyPlan | null>(null);
  const [aiApplying, setAiApplying] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiEditTypeModalOpen, setAiEditTypeModalOpen] = useState(false);
  const [aiEditingTypeIndex, setAiEditingTypeIndex] = useState<number | null>(null);
  const [aiEditLinkModalOpen, setAiEditLinkModalOpen] = useState(false);
  const [aiEditingLinkIndex, setAiEditingLinkIndex] = useState<number | null>(null);
  const [aiEditActionModalOpen, setAiEditActionModalOpen] = useState(false);
  const [aiEditingActionIndex, setAiEditingActionIndex] = useState<number | null>(null);
  const [aiEditPropModalOpen, setAiEditPropModalOpen] = useState(false);
  const [aiEditingPropPos, setAiEditingPropPos] = useState<{ typeIndex: number; propIndex: number } | null>(null);
  const [aiEditTypeForm] = Form.useForm();
  const [aiEditLinkForm] = Form.useForm();
  const [aiEditActionForm] = Form.useForm();
  const [aiEditPropForm] = Form.useForm();

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

  const deleteObjectType = useCallback(async (id: string) => {
    try {
      await ontologyApi.deleteObjectType(id);
      if (selectedType?.id === id) setSelectedType(null);
      if (editingType?.id === id) {
        setEditTypeModalOpen(false);
        setEditingType(null);
      }
      setSelectedEdgeId(null);
      message.success(t('ontology.deleted'));
      fetchAll();
    } catch {
      message.error(t('ontology.deleteFailed'));
    }
  }, [selectedType, editingType, fetchAll, t]);

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
          canDelete: canWrite,
          deleteLabel: t('common.delete'),
          deleteConfirm: t('ontology.deleteTypeConfirm'),
          onDelete: () => {
            void deleteObjectType(ot.id);
          },
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
  }, [objectTypes, linkTypes, t, canWrite, deleteObjectType]);

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

  const openAiEditType = (typeIndex: number) => {
    if (!aiPlan) return;
    const draft = aiPlan.object_types[typeIndex];
    if (!draft) return;
    setAiEditingTypeIndex(typeIndex);
    aiEditTypeForm.setFieldsValue({
      name: draft.name,
      display_name: draft.display_name,
      description: draft.description || '',
      color: draft.color || '#4A90D9',
      primary_key_property: draft.primary_key_property || undefined,
    });
    setAiEditTypeModalOpen(true);
  };

  const updateAiObjectType = async (values: Record<string, unknown>) => {
    if (aiEditingTypeIndex === null) return;
    setAiPlan((prev) => {
      if (!prev) return prev;
      const current = prev.object_types[aiEditingTypeIndex];
      if (!current) return prev;
      const nextName = String(values.name || current.name).trim();
      const nextColor = typeof values.color === 'string' ? values.color : (values.color as { toHexString: () => string })?.toHexString?.() || current.color || '#4A90D9';
      const objectTypes = [...prev.object_types];
      objectTypes[aiEditingTypeIndex] = {
        ...current,
        name: nextName,
        display_name: String(values.display_name || current.display_name).trim(),
        description: String(values.description || '').trim(),
        color: nextColor,
        primary_key_property: values.primary_key_property ? String(values.primary_key_property) : '',
      };
      const linkTypes = prev.link_types.map((link) => ({
        ...link,
        source_type_name: link.source_type_name === current.name ? nextName : link.source_type_name,
        target_type_name: link.target_type_name === current.name ? nextName : link.target_type_name,
      }));
      const actionTypes = prev.action_types.map((action) => ({
        ...action,
        object_type_name: action.object_type_name === current.name ? nextName : action.object_type_name,
      }));
      return { ...prev, object_types: objectTypes, link_types: linkTypes, action_types: actionTypes };
    });
    setAiEditTypeModalOpen(false);
    setAiEditingTypeIndex(null);
  };

  const deleteAiObjectType = (typeIndex: number) => {
    setAiPlan((prev) => {
      if (!prev) return prev;
      const draft = prev.object_types[typeIndex];
      if (!draft) return prev;
      return {
        ...prev,
        object_types: prev.object_types.filter((_, index) => index !== typeIndex),
        link_types: prev.link_types.filter((link) => link.source_type_name !== draft.name && link.target_type_name !== draft.name),
        action_types: prev.action_types.filter((action) => action.object_type_name !== draft.name),
      };
    });
  };

  const openAiEditProperty = (typeIndex: number, propIndex: number) => {
    if (!aiPlan) return;
    const property = aiPlan.object_types[typeIndex]?.properties[propIndex];
    if (!property) return;
    setAiEditingPropPos({ typeIndex, propIndex });
    aiEditPropForm.setFieldsValue({
      name: property.name,
      display_name: property.display_name,
      data_type: property.data_type,
      description: property.description || '',
      required: Boolean(property.required),
      order: property.order || 0,
    });
    setAiEditPropModalOpen(true);
  };

  const updateAiProperty = async (values: Record<string, unknown>) => {
    if (!aiEditingPropPos) return;
    setAiPlan((prev) => {
      if (!prev) return prev;
      const objectTypes = [...prev.object_types];
      const currentType = objectTypes[aiEditingPropPos.typeIndex];
      const currentProperty = currentType?.properties[aiEditingPropPos.propIndex];
      if (!currentType || !currentProperty) return prev;
      const properties = [...currentType.properties];
      const nextName = String(values.name || currentProperty.name).trim();
      properties[aiEditingPropPos.propIndex] = {
        ...currentProperty,
        name: nextName,
        display_name: String(values.display_name || currentProperty.display_name).trim(),
        data_type: String(values.data_type || currentProperty.data_type).trim(),
        description: String(values.description || '').trim(),
        required: Boolean(values.required),
        order: typeof values.order === 'number' ? values.order : Number(values.order || 0),
      };
      objectTypes[aiEditingPropPos.typeIndex] = {
        ...currentType,
        properties,
        primary_key_property: currentType.primary_key_property === currentProperty.name
          ? nextName
          : currentType.primary_key_property,
      };
      return { ...prev, object_types: objectTypes };
    });
    setAiEditPropModalOpen(false);
    setAiEditingPropPos(null);
  };

  const deleteAiProperty = (typeIndex: number, propIndex: number) => {
    setAiPlan((prev) => {
      if (!prev) return prev;
      const objectTypes = [...prev.object_types];
      const currentType = objectTypes[typeIndex];
      const currentProperty = currentType?.properties[propIndex];
      if (!currentType || !currentProperty) return prev;
      objectTypes[typeIndex] = {
        ...currentType,
        properties: currentType.properties.filter((_, index) => index !== propIndex),
        primary_key_property: currentType.primary_key_property === currentProperty.name ? '' : currentType.primary_key_property,
      };
      return { ...prev, object_types: objectTypes };
    });
  };

  const openAiEditLink = (linkIndex: number) => {
    if (!aiPlan) return;
    const draft = aiPlan.link_types[linkIndex];
    if (!draft) return;
    setAiEditingLinkIndex(linkIndex);
    aiEditLinkForm.setFieldsValue({
      name: draft.name,
      display_name: draft.display_name,
      description: draft.description || '',
      source_type_name: draft.source_type_name,
      target_type_name: draft.target_type_name,
      cardinality: draft.cardinality,
    });
    setAiEditLinkModalOpen(true);
  };

  const updateAiLinkType = async (values: Record<string, unknown>) => {
    if (aiEditingLinkIndex === null) return;
    setAiPlan((prev) => {
      if (!prev) return prev;
      const linkTypes = [...prev.link_types];
      const current = linkTypes[aiEditingLinkIndex];
      if (!current) return prev;
      linkTypes[aiEditingLinkIndex] = {
        ...current,
        name: String(values.name || current.name).trim(),
        display_name: String(values.display_name || current.display_name).trim(),
        description: String(values.description || '').trim(),
        source_type_name: String(values.source_type_name || current.source_type_name).trim(),
        target_type_name: String(values.target_type_name || current.target_type_name).trim(),
        cardinality: String(values.cardinality || current.cardinality).trim(),
      };
      return { ...prev, link_types: linkTypes };
    });
    setAiEditLinkModalOpen(false);
    setAiEditingLinkIndex(null);
  };

  const deleteAiLinkType = (linkIndex: number) => {
    setAiPlan((prev) => prev ? { ...prev, link_types: prev.link_types.filter((_, index) => index !== linkIndex) } : prev);
  };

  const openAiEditAction = (actionIndex: number) => {
    if (!aiPlan) return;
    const draft = aiPlan.action_types[actionIndex];
    if (!draft) return;
    setAiEditingActionIndex(actionIndex);
    aiEditActionForm.setFieldsValue({
      name: draft.name,
      display_name: draft.display_name,
      description: draft.description || '',
      object_type_name: draft.object_type_name || undefined,
      logic_type: draft.logic_type,
      parameters: stringifyJson(draft.parameters),
      logic_config: stringifyJson(draft.logic_config),
    });
    setAiEditActionModalOpen(true);
  };

  const updateAiActionType = async (values: Record<string, unknown>) => {
    if (aiEditingActionIndex === null) return;
    try {
      const parameters = values.parameters ? JSON.parse(values.parameters as string) : {};
      const logicConfig = values.logic_config ? JSON.parse(values.logic_config as string) : {};
      setAiPlan((prev) => {
        if (!prev) return prev;
        const actionTypes = [...prev.action_types];
        const current = actionTypes[aiEditingActionIndex];
        if (!current) return prev;
        actionTypes[aiEditingActionIndex] = {
          ...current,
          name: String(values.name || current.name).trim(),
          display_name: String(values.display_name || current.display_name).trim(),
          description: String(values.description || '').trim(),
          object_type_name: values.object_type_name ? String(values.object_type_name) : '',
          logic_type: String(values.logic_type || current.logic_type).trim(),
          parameters,
          logic_config: logicConfig,
        };
        return { ...prev, action_types: actionTypes };
      });
      setAiEditActionModalOpen(false);
      setAiEditingActionIndex(null);
    } catch {
      message.error(t('ontology.jsonFormatError'));
    }
  };

  const deleteAiActionType = (actionIndex: number) => {
    setAiPlan((prev) => prev ? { ...prev, action_types: prev.action_types.filter((_, index) => index !== actionIndex) } : prev);
  };

  const handleAiGenerate = useCallback(async () => {
    if (!aiDescription.trim()) return;
    setAiGenerating(true);
    setAiPlan(null);
    try {
      const { data } = await ontologyApi.generateOntology(aiDescription);
      setAiPlan(normalizeAiPlan(data.plan as Record<string, unknown>));
    } catch (error) {
      message.error(extractBackendDetail(error) || t('ontology.aiGenerateFailed'));
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
    } catch (error) {
      message.error(extractBackendDetail(error) || t('ontology.aiGenerateFailed'));
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
        onCancel={() => {
          if (!aiGenerating && !aiApplying) {
            setAiModalOpen(false);
            setAiPlan(null);
            setAiEditTypeModalOpen(false);
            setAiEditingTypeIndex(null);
            setAiEditLinkModalOpen(false);
            setAiEditingLinkIndex(null);
            setAiEditActionModalOpen(false);
            setAiEditingActionIndex(null);
            setAiEditPropModalOpen(false);
            setAiEditingPropPos(null);
          }
        }}
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
          const otList = aiPlan.object_types || [];
          const ltList = aiPlan.link_types || [];
          const atList = aiPlan.action_types || [];
          const warns = aiPlan._warnings || [];
          const colorMap: Record<string, string> = {};
          otList.forEach((ot) => { colorMap[ot.name] = ot.color || '#4A90D9'; });

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

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={t('ontology.aiPreviewEditableHint')}
            />

            <Collapse
              defaultActiveKey={['types', 'links']}
              items={[
                {
                  key: 'types',
                  label: <Space><Badge count={otList.length} style={{ backgroundColor: 'var(--primary)' }} />{t('ontology.aiObjectTypes')}</Space>,
                  children: (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      {otList.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
                      ) : otList.map((ot, typeIndex) => (
                        <Card
                          key={`${ot.name}-${typeIndex}`}
                          size="small"
                          style={{ background: 'var(--bg-body)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${ot.color || '#4A90D9'}` }}
                          extra={
                            <Space>
                              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openAiEditType(typeIndex)} disabled={aiApplying} />
                              <Popconfirm title={t('ontology.deleteTypeConfirm')} onConfirm={() => deleteAiObjectType(typeIndex)}>
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={aiApplying} />
                              </Popconfirm>
                            </Space>
                          }
                        >
                          <Space wrap>
                            <div style={{ width: 12, height: 12, borderRadius: 3, background: ot.color || '#4A90D9' }} />
                            <Text strong>{ot.display_name}</Text>
                            <Tag>{ot.name}</Tag>
                            <Tag color="blue">{ot.properties.length} {t('ontology.aiProperties')}</Tag>
                            {ot.primary_key_property && <Tag color="gold">{t('ontology.primaryKey')}: {ot.primary_key_property}</Tag>}
                          </Space>
                          {ot.description && (
                            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{ot.description}</div>
                          )}
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ot.properties
                              .map((prop, originalIndex) => ({ prop, originalIndex }))
                              .sort((a, b) => (a.prop.order || 0) - (b.prop.order || 0))
                              .map(({ prop, originalIndex }) => (
                              <div
                                key={`${prop.name}-${originalIndex}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '8px 10px',
                                  borderRadius: 6,
                                  border: '1px solid var(--card-border)',
                                  background: 'var(--bg-surface)',
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Space wrap size={[6, 6]}>
                                    <Text strong style={{ fontSize: 13 }}>{prop.display_name}</Text>
                                    <Tag>{prop.name}</Tag>
                                    <Tag color="geekblue">{prop.data_type}</Tag>
                                    {prop.required && <Tag color="red">{t('common.required')}</Tag>}
                                    {ot.primary_key_property === prop.name && <Tag color="gold">{t('ontology.primaryKey')}</Tag>}
                                  </Space>
                                  {prop.description && (
                                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>{prop.description}</div>
                                  )}
                                </div>
                                <Space>
                                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openAiEditProperty(typeIndex, originalIndex)} disabled={aiApplying} />
                                  <Popconfirm title={t('ontology.deletePropertyConfirm')} onConfirm={() => deleteAiProperty(typeIndex, originalIndex)}>
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={aiApplying} />
                                  </Popconfirm>
                                </Space>
                              </div>
                            ))}
                            {ot.properties.length === 0 && (
                              <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{t('common.noData')}</Text>
                            )}
                          </div>
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
                      {ltList.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
                      ) : ltList.map((lt, linkIndex) => {
                        const srcName = lt.source_type_name;
                        const tgtName = lt.target_type_name;
                        const srcColor = colorMap[srcName] || '#999';
                        const tgtColor = colorMap[tgtName] || '#999';
                        return (
                          <div key={`${lt.name}-${linkIndex}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-body)', border: '1px solid var(--card-border)' }}>
                            <Tag color={srcColor} style={{ margin: 0, color: '#fff', fontWeight: 500 }}>{srcName || '—'}</Tag>
                            <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 12 }} />
                            <Tag color={tgtColor} style={{ margin: 0, color: '#fff', fontWeight: 500 }}>{tgtName || '—'}</Tag>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <Text strong style={{ fontSize: 13 }}>{lt.display_name}</Text>
                              <Space wrap size={[6, 6]} style={{ marginLeft: 8 }}>
                                <Tag>{lt.name}</Tag>
                                <Tag>{lt.cardinality}</Tag>
                              </Space>
                              {lt.description && <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-secondary)' }}>{lt.description}</div>}
                            </div>
                            <Space>
                              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openAiEditLink(linkIndex)} disabled={aiApplying} />
                              <Popconfirm title={t('ontology.deleteLinkConfirm')} onConfirm={() => deleteAiLinkType(linkIndex)}>
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={aiApplying} />
                              </Popconfirm>
                            </Space>
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
                      {atList.length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
                      ) : atList.map((at, actionIndex) => (
                        <div key={`${at.name}-${actionIndex}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--bg-body)', border: '1px solid var(--card-border)' }}>
                          <ThunderboltOutlined style={{ marginTop: 4, color: 'var(--color-yellow)' }} />
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                            <Space wrap size={[6, 6]}>
                              <Text strong>{at.display_name}</Text>
                              <Tag>{at.name}</Tag>
                              <Tag>{at.logic_type}</Tag>
                              {at.object_type_name && <Tag color={colorMap[at.object_type_name]}>{at.object_type_name}</Tag>}
                            </Space>
                            {at.description && <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{at.description}</div>}
                          </div>
                          <Space>
                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openAiEditAction(actionIndex)} disabled={aiApplying} />
                            <Popconfirm title={t('ontology.deleteActionConfirm')} onConfirm={() => deleteAiActionType(actionIndex)}>
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={aiApplying} />
                            </Popconfirm>
                          </Space>
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

      <Modal
        title={t('ontology.editObjectType')}
        open={aiEditTypeModalOpen}
        onCancel={() => { setAiEditTypeModalOpen(false); setAiEditingTypeIndex(null); }}
        onOk={() => aiEditTypeForm.submit()}
        okText={t('common.save')}
      >
        <Form form={aiEditTypeForm} onFinish={updateAiObjectType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="primary_key_property" label={t('ontology.primaryKey')}>
            <Select
              allowClear
              options={(aiEditingTypeIndex !== null ? aiPlan?.object_types[aiEditingTypeIndex]?.properties || [] : []).map((prop) => ({
                value: prop.name,
                label: `${prop.display_name} (${prop.name})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="color" label={t('ontology.color')}>
            <ColorPicker />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('ontology.editProperty')}
        open={aiEditPropModalOpen}
        onCancel={() => { setAiEditPropModalOpen(false); setAiEditingPropPos(null); }}
        onOk={() => aiEditPropForm.submit()}
        okText={t('common.save')}
      >
        <Form form={aiEditPropForm} onFinish={updateAiProperty} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="data_type" label={t('ontology.dataType')} rules={[{ required: true }]}>
            <Select options={DATA_TYPES.map((dt) => ({ value: dt, label: dt }))} />
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

      <Modal
        title={t('ontology.editLinkType')}
        open={aiEditLinkModalOpen}
        onCancel={() => { setAiEditLinkModalOpen(false); setAiEditingLinkIndex(null); }}
        onOk={() => aiEditLinkForm.submit()}
        okText={t('common.save')}
      >
        <Form form={aiEditLinkForm} onFinish={updateAiLinkType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="source_type_name" label={t('ontology.sourceType')} rules={[{ required: true }]}>
            <Select options={(aiPlan?.object_types || []).map((ot) => ({ value: ot.name, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="target_type_name" label={t('ontology.targetType')} rules={[{ required: true }]}>
            <Select options={(aiPlan?.object_types || []).map((ot) => ({ value: ot.name, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="cardinality" label={t('ontology.cardinality')} rules={[{ required: true }]}>
            <Select options={CARDINALITIES} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('ontology.editActionType')}
        open={aiEditActionModalOpen}
        onCancel={() => { setAiEditActionModalOpen(false); setAiEditingActionIndex(null); }}
        onOk={() => aiEditActionForm.submit()}
        okText={t('common.save')}
        width={640}
      >
        <Form form={aiEditActionForm} onFinish={updateAiActionType} layout="vertical">
          <Form.Item name="name" label={t('ontology.apiName')} rules={[{ required: true }, { pattern: /^[a-z_][a-z0-9_]*$/, message: t('ontology.snakeCaseHint') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label={t('ontology.displayName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description')}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="object_type_name" label={t('ontology.actionObjectType')}>
            <Select allowClear options={(aiPlan?.object_types || []).map((ot) => ({ value: ot.name, label: ot.display_name }))} />
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
        </Form>
      </Modal>
    </div>
  );
}
