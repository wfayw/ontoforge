/**
 * ObjectGraphExplorer — 知识图谱探索器
 *
 * 设计：
 * - 分层径向布局（Radial Hierarchy）：根节点居中，每层邻居按扇形分布，
 *   父-子角度继承，天然无交叉
 * - 按需展开/折叠：双击节点展开邻居，再次双击折叠
 * - Smoothstep 连线：避免直线穿越节点
 * - 按类型着色、边标签、MiniMap、类型筛选、统计
 * - 适应 1000+ 对象的渐进式探索
 */

import { useCallback, useEffect, useRef, useState, memo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Checkbox, Space, Tooltip } from 'antd';
import { CompressOutlined, ExpandOutlined, LoadingOutlined } from '@ant-design/icons';
import { instanceApi } from '@/services/api';
import type { ObjectType, LinkType } from '@/types';

// ─── Types ───────────────────────────────────────────────

interface GraphNodeData {
  id: string;
  displayName: string;
  objectTypeId: string;
  typeName: string;
  typeColor: string;
  expanded: boolean;
  loading: boolean;
  hiddenCount: number;
  isRoot: boolean;
  [key: string]: unknown;
}

interface NeighborObj {
  id: string;
  display_name: string;
  object_type_id: string;
  properties: Record<string, unknown>;
}

interface NeighborEdge {
  source_id: string;
  target_id: string;
  link_type_id: string;
}

interface Props {
  rootObjectId: string;
  rootDisplayName: string;
  rootObjectTypeId: string;
  objectTypes: ObjectType[];
  linkTypes: LinkType[];
  height?: number | string;
  onNodeSelect?: (objectId: string) => void;
}

// ─── Radial Hierarchy Layout ─────────────────────────────
// Deterministic: BFS levels → concentric rings, children inherit parent angle sector

function radialLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  rootId: string,
): Map<string, { x: number; y: number }> {
  const N = nodeIds.length;
  if (N === 0) return new Map();
  if (N === 1) return new Map([[nodeIds[0], { x: 0, y: 0 }]]);

  // Build undirected adjacency
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  // BFS from root → parent map + level map + ordered children
  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();
  const levelMap = new Map<string, number>();
  const nodeSet = new Set(nodeIds);

  parent.set(rootId, null);
  levelMap.set(rootId, 0);
  children.set(rootId, []);
  const queue = [rootId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const curLevel = levelMap.get(cur)!;
    const curChildren: string[] = [];
    for (const nb of adj.get(cur) || []) {
      if (!nodeSet.has(nb)) continue;
      if (levelMap.has(nb)) continue;
      levelMap.set(nb, curLevel + 1);
      parent.set(nb, cur);
      children.set(nb, []);
      curChildren.push(nb);
      queue.push(nb);
    }
    children.set(cur, curChildren);
  }

  // Handle disconnected nodes
  for (const id of nodeIds) {
    if (!levelMap.has(id)) {
      levelMap.set(id, 1);
      parent.set(id, rootId);
      children.set(id, []);
      children.get(rootId)!.push(id);
    }
  }

  // Compute subtree size (leaf weight)
  const subtreeSize = new Map<string, number>();
  function computeSize(id: string): number {
    const ch = children.get(id) || [];
    if (ch.length === 0) { subtreeSize.set(id, 1); return 1; }
    let total = 0;
    for (const c of ch) total += computeSize(c);
    subtreeSize.set(id, total);
    return total;
  }
  computeSize(rootId);

  // Assign angle sectors based on subtree weight
  const RING_GAP = N < 30 ? 220 : N < 100 ? 200 : N < 300 ? 180 : 150;
  const result = new Map<string, { x: number; y: number }>();
  result.set(rootId, { x: 0, y: 0 });

  function layoutChildren(parentId: string, angleStart: number, angleEnd: number) {
    const ch = children.get(parentId) || [];
    if (ch.length === 0) return;

    const parentSize = subtreeSize.get(parentId) || 1;
    const level = (levelMap.get(parentId) || 0) + 1;
    const radius = level * RING_GAP;

    // Distribute angular space proportionally to subtree sizes
    let cursor = angleStart;
    for (const cid of ch) {
      const cSize = subtreeSize.get(cid) || 1;
      const fraction = cSize / parentSize;
      const cAngleStart = cursor;
      const cAngleEnd = cursor + (angleEnd - angleStart) * fraction;
      const midAngle = (cAngleStart + cAngleEnd) / 2;

      result.set(cid, {
        x: radius * Math.cos(midAngle),
        y: radius * Math.sin(midAngle),
      });

      layoutChildren(cid, cAngleStart, cAngleEnd);
      cursor = cAngleEnd;
    }
  }

  layoutChildren(rootId, 0, 2 * Math.PI);

  // Overlap resolution: push apart nodes that are too close
  const MIN_DIST = 100;
  const positions = [...result.entries()].filter(([id]) => id !== rootId);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [, pi] = positions[i];
        const [, pj] = positions[j];
        const dx = pj.x - pi.x, dy = pj.y - pi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MIN_DIST && dist > 0) {
          const push = (MIN_DIST - dist) / 2;
          const nx = (dx / dist) * push, ny = (dy / dist) * push;
          pi.x -= nx; pi.y -= ny;
          pj.x += nx; pj.y += ny;
        }
      }
    }
  }

  for (const [id, pos] of positions) result.set(id, pos);
  return result;
}

// ─── Custom Node Component ───────────────────────────────

const GraphNode = memo(({ data }: NodeProps<Node<GraphNodeData>>) => {
  const d = data as GraphNodeData;
  const nodeStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderRadius: d.isRoot ? 14 : 10,
    border: `2px solid ${d.typeColor}`,
    background: 'var(--bg-surface)',
    minWidth: 90,
    maxWidth: 180,
    textAlign: 'center' as const,
    cursor: 'pointer',
    boxShadow: d.isRoot
      ? `0 0 0 3px ${d.typeColor}33, 0 2px 8px rgba(0,0,0,0.12)`
      : d.expanded ? `0 0 0 2px ${d.typeColor}22` : '0 1px 4px rgba(0,0,0,0.08)',
    transition: 'box-shadow .2s, transform .2s',
    position: 'relative' as const,
  };

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 8, height: 8 }} id="tl" />
      <div style={nodeStyle}>
        <div style={{
          fontSize: 9, lineHeight: '14px', color: d.typeColor, fontWeight: 600,
          letterSpacing: '0.02em', marginBottom: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {d.typeName}
        </div>
        <div style={{
          fontSize: d.isRoot ? 13 : 11, fontWeight: d.isRoot ? 700 : 500,
          color: 'var(--text-primary)', lineHeight: '16px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {d.displayName}
        </div>
        {d.loading && (
          <div style={{ marginTop: 4 }}>
            <LoadingOutlined style={{ fontSize: 12, color: d.typeColor }} />
          </div>
        )}
        {!d.loading && d.hiddenCount > 0 && (
          <Tooltip title={`${d.hiddenCount} hidden connections`}>
            <div style={{
              position: 'absolute', top: -8, right: -8,
              background: d.typeColor, color: '#fff', borderRadius: 10,
              fontSize: 9, fontWeight: 700, minWidth: 18, height: 18,
              lineHeight: '18px', textAlign: 'center', padding: '0 4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}>
              +{d.hiddenCount}
            </div>
          </Tooltip>
        )}
        {!d.loading && d.expanded && !d.isRoot && (
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            background: d.typeColor, color: '#fff', borderRadius: 6,
            fontSize: 8, width: 14, height: 14, lineHeight: '14px', textAlign: 'center',
          }}>
            −
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 8, height: 8 }} id="sr" />
    </>
  );
});
GraphNode.displayName = 'GraphNode';

const NODE_TYPES = { graphNode: GraphNode };

// ─── Inner Component (needs ReactFlowProvider) ───────────

function GraphInner({
  rootObjectId,
  rootDisplayName,
  rootObjectTypeId,
  objectTypes,
  linkTypes,
  height = 600,
  onNodeSelect,
}: Props) {
  const typeMap = useRef(new Map<string, ObjectType>());
  useEffect(() => {
    typeMap.current = new Map(objectTypes.map((t) => [t.id, t]));
  }, [objectTypes]);
  const ltMap = useRef(new Map<string, LinkType>());
  useEffect(() => {
    ltMap.current = new Map(linkTypes.map((l) => [l.id, l]));
  }, [linkTypes]);

  const getType = useCallback((typeId: string) => typeMap.current.get(typeId), []);
  const getColor = useCallback((typeId: string) => typeMap.current.get(typeId)?.color || '#888', []);
  const getTypeName = useCallback((typeId: string) => typeMap.current.get(typeId)?.display_name || '', []);

  // Graph state — ref + state pair to avoid stale closures
  const allNeighborsRef = useRef(new Map<string, { neighbors: NeighborObj[]; edges: NeighborEdge[] }>());
  const expandedSet = useRef(new Set<string>());
  const visibleIdsRef = useRef(new Set<string>([rootObjectId]));
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set([rootObjectId]));
  const visNodeMap = useRef(new Map<string, { id: string; displayName: string; objectTypeId: string }>());
  const visEdgeList = useRef<{ source: string; target: string; linkTypeId: string; key: string }[]>([]);

  const commitVisible = useCallback((ids: Set<string>) => {
    visibleIdsRef.current = ids;
    setVisibleNodeIds(ids);
  }, []);

  // ReactFlow
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({ nodes: 1, edges: 0, expanded: 0 });

  // ─── Build visible graph ───────────────────────────────

  const rebuildGraph = useCallback(() => {
    const nodeIds = [...visibleNodeIds].filter((id) => {
      const nd = visNodeMap.current.get(id);
      return nd && !hiddenTypes.has(nd.objectTypeId);
    });

    const visibleSet = new Set(nodeIds);
    const filteredEdges = visEdgeList.current.filter(
      (e) => visibleSet.has(e.source) && visibleSet.has(e.target)
    );

    const positions = radialLayout(
      nodeIds,
      filteredEdges.map((e) => ({ source: e.source, target: e.target })),
      rootObjectId,
    );

    const rfNodes: Node[] = nodeIds.map((id) => {
      const nd = visNodeMap.current.get(id)!;
      const pos = positions.get(id) || { x: 0, y: 0 };
      const isExpanded = expandedSet.current.has(id);
      const cached = allNeighborsRef.current.get(id);
      let hiddenCount = 0;
      if (cached) {
        hiddenCount = cached.neighbors.length
          - cached.neighbors.filter((n) => visibleSet.has(n.id)).length;
      }
      return {
        id,
        type: 'graphNode',
        position: pos,
        data: {
          id,
          displayName: nd.displayName,
          objectTypeId: nd.objectTypeId,
          typeName: getTypeName(nd.objectTypeId),
          typeColor: getColor(nd.objectTypeId),
          expanded: isExpanded,
          loading: false,
          hiddenCount: isExpanded ? 0 : hiddenCount,
          isRoot: id === rootObjectId,
        } satisfies GraphNodeData,
      };
    });

    const rfEdges: Edge[] = filteredEdges.map((e) => {
      const lt = ltMap.current.get(e.linkTypeId);
      const color = getColor(e.linkTypeId) || 'var(--border)';
      return {
        id: e.key,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        pathOptions: { borderRadius: 20 },
        label: lt?.display_name,
        labelStyle: { fontSize: 9, fill: 'var(--text-tertiary)', fontWeight: 500 },
        labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
        style: { stroke: color, strokeWidth: 1.5, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-tertiary)', width: 12, height: 12 },
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
    setStats({ nodes: rfNodes.length, edges: rfEdges.length, expanded: expandedSet.current.size });

    requestAnimationFrame(() => fitView({ padding: 0.12, duration: 300 }));
  }, [visibleNodeIds, hiddenTypes, rootObjectId, getColor, getTypeName, setNodes, setEdges, fitView]);

  // ─── Init root ─────────────────────────────────────────

  useEffect(() => {
    visNodeMap.current.clear();
    visEdgeList.current = [];
    expandedSet.current.clear();
    allNeighborsRef.current.clear();
    setHiddenTypes(new Set());

    visNodeMap.current.set(rootObjectId, {
      id: rootObjectId,
      displayName: rootDisplayName,
      objectTypeId: rootObjectTypeId,
    });
    commitVisible(new Set([rootObjectId]));

    expandNode(rootObjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootObjectId]);

  useEffect(() => { rebuildGraph(); }, [rebuildGraph]);

  // ─── Expand / Collapse ─────────────────────────────────

  const expandNode = useCallback(async (nodeId: string) => {
    if (expandedSet.current.has(nodeId)) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, loading: true } } : n,
      ),
    );

    let data: { neighbors: NeighborObj[]; edges: NeighborEdge[] };
    if (allNeighborsRef.current.has(nodeId)) {
      data = allNeighborsRef.current.get(nodeId)!;
    } else {
      try {
        const res = await instanceApi.getNeighbors(nodeId, 1);
        data = { neighbors: res.data.neighbors || [], edges: res.data.edges || [] };
        allNeighborsRef.current.set(nodeId, data);
      } catch {
        data = { neighbors: [], edges: [] };
      }
    }

    expandedSet.current.add(nodeId);

    const newVisible = new Set(visibleIdsRef.current);
    newVisible.add(nodeId);
    for (const nb of data.neighbors) {
      if (!visNodeMap.current.has(nb.id)) {
        visNodeMap.current.set(nb.id, {
          id: nb.id,
          displayName: nb.display_name || nb.id.slice(0, 8),
          objectTypeId: nb.object_type_id || '',
        });
      }
      newVisible.add(nb.id);
    }

    const existingKeys = new Set(visEdgeList.current.map((e) => e.key));
    for (const e of data.edges) {
      const key = `${e.source_id}-${e.target_id}-${e.link_type_id}`;
      if (!existingKeys.has(key)) {
        visEdgeList.current.push({
          source: e.source_id, target: e.target_id, linkTypeId: e.link_type_id, key,
        });
      }
    }

    commitVisible(newVisible);
  }, [setNodes, commitVisible]);

  const collapseNode = useCallback((nodeId: string) => {
    if (!expandedSet.current.has(nodeId) || nodeId === rootObjectId) return;

    expandedSet.current.delete(nodeId);

    const cached = allNeighborsRef.current.get(nodeId);
    if (!cached) { rebuildGraph(); return; }

    const toRemove = new Set<string>();
    for (const nb of cached.neighbors) {
      if (nb.id === rootObjectId) continue;
      if (expandedSet.current.has(nb.id)) continue;

      let connectedElsewhere = false;
      for (const expId of expandedSet.current) {
        const expData = allNeighborsRef.current.get(expId);
        if (expData?.neighbors.some((n) => n.id === nb.id)) {
          connectedElsewhere = true;
          break;
        }
      }
      if (!connectedElsewhere) toRemove.add(nb.id);
    }

    if (toRemove.size > 0) {
      for (const id of toRemove) expandedSet.current.delete(id);
      const newVisible = new Set([...visibleIdsRef.current].filter((id) => !toRemove.has(id)));
      visEdgeList.current = visEdgeList.current.filter(
        (e) => newVisible.has(e.source) && newVisible.has(e.target),
      );
      commitVisible(newVisible);
    } else {
      rebuildGraph();
    }
  }, [rootObjectId, rebuildGraph, commitVisible]);

  // ─── Node interaction ──────────────────────────────────

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const d = node.data as GraphNodeData;
      if (d.expanded && node.id !== rootObjectId) collapseNode(node.id);
      else expandNode(node.id);
    },
    [expandNode, collapseNode, rootObjectId],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => { onNodeSelect?.(node.id); },
    [onNodeSelect],
  );

  // ─── Type filter ───────────────────────────────────────

  const visibleTypes = [...new Set([...visNodeMap.current.values()].map((n) => n.objectTypeId))];

  const toggleType = useCallback((typeId: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId); else next.add(typeId);
      return next;
    });
  }, []);

  const expandAll = useCallback(async () => {
    const toExpand = [...visibleIdsRef.current].filter((id) => !expandedSet.current.has(id));
    for (const id of toExpand) await expandNode(id);
  }, [expandNode]);

  const collapseAll = useCallback(() => {
    const toCollapse = [...expandedSet.current].filter((id) => id !== rootObjectId);
    for (const id of toCollapse.reverse()) collapseNode(id);
  }, [rootObjectId, collapseNode]);

  // ─── Render ────────────────────────────────────────────

  return (
    <div style={{ height, position: 'relative', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {/* Control panel */}
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 10,
        background: 'var(--bg-surface)', border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12,
        maxWidth: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
          {stats.nodes} nodes · {stats.edges} edges
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
          {visibleTypes.map((typeId) => {
            const ot = getType(typeId);
            if (!ot) return null;
            return (
              <label key={typeId} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)' }}>
                <Checkbox checked={!hiddenTypes.has(typeId)} onChange={() => toggleType(typeId)} style={{ transform: 'scale(0.85)' }} />
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ot.color, flexShrink: 0 }} />
                {ot.display_name}
              </label>
            );
          })}
        </div>
        <Space size={4}>
          <Tooltip title="Expand all visible nodes">
            <button onClick={expandAll} style={{
              background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <ExpandOutlined style={{ fontSize: 10 }} /> Expand
            </button>
          </Tooltip>
          <Tooltip title="Collapse all (keep root)">
            <button onClick={collapseAll} style={{
              background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 4,
              padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <CompressOutlined style={{ fontSize: 10 }} /> Collapse
            </button>
          </Tooltip>
        </Space>
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: '14px' }}>
          Double-click: expand / collapse
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={0.05}
        maxZoom={2.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-body)' }}
      >
        <Background color="var(--border-subtle)" gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
          maskColor="rgba(0,0,0,0.08)"
          nodeColor={(node) => (node.data as GraphNodeData)?.typeColor || '#888'}
          nodeStrokeWidth={0}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

// ─── Wrapper with ReactFlowProvider ──────────────────────

export default function ObjectGraphExplorer(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
