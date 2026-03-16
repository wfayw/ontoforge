import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Select, Form, Input, InputNumber, Space, Typography, Popconfirm, Spin, Empty, message, Tooltip, Modal, Tabs } from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, SaveOutlined, DeleteOutlined, EyeOutlined,
  BarChartOutlined, TableOutlined, NumberOutlined, ThunderboltOutlined,
  UndoOutlined, CopyOutlined, ExclamationCircleOutlined,
  FilterOutlined, UnorderedListOutlined, RobotOutlined, BellOutlined,
} from '@ant-design/icons';
import RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { workshopApi, ontologyApi, aipApi } from '@/services/api';
import { useI18n } from '@/i18n';
import { useContainerSize } from '@/hooks/useContainerSize';
import { StatCardWidget, ChartWidget, FilterWidget } from '@/components/widgets';
import type { ObjectType, ActionType, AIAgent } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactGridLayout = RGL as any;
type RGLLayout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; static?: boolean };

const { Text } = Typography;

type WidgetI18nKey = 'workshop.statCard' | 'workshop.table' | 'workshop.chart' | 'workshop.actionButton'
  | 'workshop.filter' | 'workshop.objectList' | 'workshop.agentChat' | 'workshop.alertList';

const WIDGET_I18N_KEY: Record<string, WidgetI18nKey> = {
  stat_card: 'workshop.statCard',
  table: 'workshop.table',
  chart: 'workshop.chart',
  action_button: 'workshop.actionButton',
  filter: 'workshop.filter',
  object_list: 'workshop.objectList',
  agent_chat: 'workshop.agentChat',
  alert_list: 'workshop.alertList',
};

const METRIC_I18N_KEY: Record<string, 'workshop.count' | 'workshop.sum' | 'workshop.avg' | 'workshop.min' | 'workshop.max'> = {
  count: 'workshop.count', sum: 'workshop.sum', avg: 'workshop.avg', min: 'workshop.min', max: 'workshop.max',
};

interface Widget {
  id: string;
  app_id: string;
  widget_type: string;
  title: string;
  config: Record<string, unknown> | null;
  position: Record<string, unknown> | null;
  data_binding: Record<string, unknown> | null;
  order: number;
}

const WIDGET_TYPES = [
  { key: 'stat_card', icon: <NumberOutlined />, color: '#1890ff' },
  { key: 'table', icon: <TableOutlined />, color: '#52c41a' },
  { key: 'chart', icon: <BarChartOutlined />, color: '#faad14' },
  { key: 'action_button', icon: <ThunderboltOutlined />, color: '#eb2f96' },
  { key: 'filter', icon: <FilterOutlined />, color: '#722ed1' },
  { key: 'object_list', icon: <UnorderedListOutlined />, color: '#13c2c2' },
  { key: 'agent_chat', icon: <RobotOutlined />, color: '#2f54eb' },
  { key: 'alert_list', icon: <BellOutlined />, color: '#f5222d' },
];

const DEFAULT_POSITIONS: Record<string, { w: number; h: number; minW: number; minH: number }> = {
  stat_card:     { w: 4, h: 3, minW: 2, minH: 2 },
  table:         { w: 6, h: 5, minW: 4, minH: 4 },
  chart:         { w: 6, h: 5, minW: 4, minH: 4 },
  action_button: { w: 3, h: 2, minW: 2, minH: 2 },
  filter:        { w: 3, h: 2, minW: 2, minH: 2 },
  object_list:   { w: 4, h: 5, minW: 3, minH: 3 },
  agent_chat:    { w: 8, h: 6, minW: 4, minH: 4 },
  alert_list:    { w: 5, h: 5, minW: 3, minH: 3 },
};

const MAX_HISTORY = 20;

export default function WorkshopBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState('');
  const [appVariables, setAppVariables] = useState<Record<string, { default: string }>>({});
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objectTypes, setObjectTypes] = useState<ObjectType[]>([]);
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [resolvedData, setResolvedData] = useState<Record<string, unknown>>({});
  const [form] = Form.useForm();
  const [dirty, setDirty] = useState(false);
  const [draggingType, setDraggingType] = useState<string | null>(null);
  const historyRef = useRef<Widget[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [gridRef, gridSize] = useContainerSize<HTMLDivElement>();

  const selectedWidget = widgets.find(w => w.id === selectedId);

  const pushHistory = useCallback((ws: Widget[]) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY), ws.map(w => ({ ...w }))];
    setCanUndo(historyRef.current.length > 1);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev) {
      setWidgets(prev.map(w => ({ ...w })));
      setDirty(true);
    }
    setCanUndo(historyRef.current.length > 1);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [appRes, widgetRes, otRes, atRes, agentRes] = await Promise.all([
        workshopApi.getApp(id),
        workshopApi.listWidgets(id),
        ontologyApi.listObjectTypes(),
        ontologyApi.listActionTypes(),
        aipApi.listAgents(),
      ]);
      setAppName(appRes.data.name);
      setAppVariables(appRes.data.variables || {});
      const ws = widgetRes.data;
      setWidgets(ws);
      pushHistory(ws);
      setObjectTypes(otRes.data);
      setActionTypes(atRes.data);
      setAgents(agentRes.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id, pushHistory]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (widgets.length === 0) return;
    const bindable = widgets.filter(w => w.data_binding && Object.keys(w.data_binding).length > 0);
    if (bindable.length === 0) return;
    workshopApi.resolve(
      bindable.map(w => ({ id: w.id, widget_type: w.widget_type, data_binding: w.data_binding }))
    ).then(r => setResolvedData(r.data)).catch(() => {});
  }, [widgets]);

  useEffect(() => {
    if (selectedWidget) {
      form.setFieldsValue({
        title: selectedWidget.title,
        widget_type: selectedWidget.widget_type,
        object_type_id: selectedWidget.data_binding?.object_type_id,
        metric: selectedWidget.data_binding?.metric || 'count',
        property_name: selectedWidget.data_binding?.property_name,
        group_by: selectedWidget.data_binding?.group_by,
        chart_type: selectedWidget.config?.chart_type || 'bar',
        action_type_id: selectedWidget.data_binding?.action_type_id,
        page_size: selectedWidget.data_binding?.page_size || 10,
        filter_field: selectedWidget.data_binding?.field,
        filter_variable: selectedWidget.config?.variable,
        agent_id: selectedWidget.data_binding?.agent_id,
        severity_filter: selectedWidget.data_binding?.severity || undefined,
        show_unread_only: selectedWidget.data_binding?.is_read === false,
        display_properties: selectedWidget.data_binding?.display_properties || [],
      });
    }
  }, [selectedId, selectedWidget, form]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const addWidget = async (type: string, dropX?: number, dropY?: number) => {
    if (!id) return;
    const defaults = DEFAULT_POSITIONS[type] || { w: 3, h: 2 };
    let x = 0, y = 0;
    if (dropX !== undefined && dropY !== undefined) {
      const colW = (gridSize.width || 840) / 12;
      x = Math.max(0, Math.min(12 - defaults.w, Math.round(dropX / colW)));
      y = Math.max(0, Math.round(dropY / 60));
    } else {
      const usedPositions = widgets.map(w => w.position || { x: 0, y: 0 });
      y = usedPositions.reduce((m, p) => Math.max(m, (p.y as number || 0) + (p.h as number || 2)), 0);
    }
    const { data } = await workshopApi.createWidget(id, {
      widget_type: type,
      title: t(WIDGET_I18N_KEY[type] || 'workshop.statCard'),
      position: { x, y, ...defaults },
      data_binding: {},
      config: type === 'chart' ? { chart_type: 'bar' } : {},
    });
    const newWidgets = [...widgets, data];
    setWidgets(newWidgets);
    pushHistory(newWidgets);
    setSelectedId(data.id);
    setDirty(true);
    message.success(t('workshop.widgetAdded'));
  };

  const duplicateWidget = async (wid: string) => {
    if (!id) return;
    const src = widgets.find(w => w.id === wid);
    if (!src) return;
    const pos = src.position || { x: 0, y: 0, w: 3, h: 2 };
    const { data } = await workshopApi.createWidget(id, {
      widget_type: src.widget_type,
      title: `${src.title} (copy)`,
      position: { ...(pos as object), y: ((pos as { y: number }).y || 0) + ((pos as { h: number }).h || 2) },
      data_binding: src.data_binding || {},
      config: src.config || {},
    });
    const newWidgets = [...widgets, data];
    setWidgets(newWidgets);
    pushHistory(newWidgets);
    setSelectedId(data.id);
    setDirty(true);
    message.success(t('workshop.widgetAdded'));
  };

  const deleteWidget = async (wid: string) => {
    await workshopApi.deleteWidget(wid);
    const newWidgets = widgets.filter(w => w.id !== wid);
    setWidgets(newWidgets);
    pushHistory(newWidgets);
    if (selectedId === wid) setSelectedId(null);
    setDirty(true);
    message.success(t('workshop.widgetDeleted'));
  };

  const saveConfig = async () => {
    if (!selectedWidget) return;
    const values = form.getFieldsValue();
    const data_binding: Record<string, unknown> = {};
    const config: Record<string, unknown> = {};

    const wt = selectedWidget.widget_type;

    if (['stat_card', 'table', 'chart', 'filter', 'object_list'].includes(wt)) {
      if (values.object_type_id) data_binding.object_type_id = values.object_type_id;
    }
    if (['stat_card', 'chart'].includes(wt)) {
      if (values.metric) data_binding.metric = values.metric;
      if (values.property_name) data_binding.property_name = values.property_name;
    }
    if (wt === 'chart') {
      if (values.group_by) data_binding.group_by = values.group_by;
      if (values.chart_type) config.chart_type = values.chart_type;
    }
    if (['table', 'object_list', 'alert_list'].includes(wt)) {
      if (values.page_size) data_binding.page_size = values.page_size;
    }
    if (wt === 'action_button') {
      if (values.action_type_id) data_binding.action_type_id = values.action_type_id;
    }
    if (wt === 'filter') {
      if (values.filter_field) data_binding.field = values.filter_field;
      if (values.filter_variable) config.variable = values.filter_variable;
    }
    if (wt === 'object_list') {
      if (values.display_properties?.length) data_binding.display_properties = values.display_properties;
    }
    if (wt === 'agent_chat') {
      if (values.agent_id) data_binding.agent_id = values.agent_id;
    }
    if (wt === 'alert_list') {
      if (values.severity_filter) data_binding.severity = values.severity_filter;
      if (values.show_unread_only) data_binding.is_read = false;
    }

    const { data } = await workshopApi.updateWidget(selectedWidget.id, {
      title: values.title,
      data_binding,
      config: Object.keys(config).length > 0 ? config : selectedWidget.config,
    });
    const newWidgets = widgets.map(w => w.id === data.id ? data : w);
    setWidgets(newWidgets);
    pushHistory(newWidgets);
    setDirty(true);
    message.success(t('common.save'));
  };

  const onLayoutChange = (layout: readonly RGLLayout[]) => {
    setWidgets(prev => prev.map(w => {
      const item = layout.find(l => l.i === w.id);
      if (item) return { ...w, position: { x: item.x, y: item.y, w: item.w, h: item.h } };
      return w;
    }));
    setDirty(true);
  };

  const saveLayout = async () => {
    if (!id) return;
    const items = widgets.map(w => ({ id: w.id, position: w.position || { x: 0, y: 0, w: 3, h: 2 } }));
    await workshopApi.updateLayout(id, items);
    setDirty(false);
    message.success(t('workshop.layoutSaved'));
  };

  const handleNavigateAway = (path: string) => {
    if (dirty) {
      Modal.confirm({
        title: t('workshop.unsavedTitle') || 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content: t('workshop.unsavedContent') || 'You have unsaved changes. Discard?',
        okText: t('common.confirm') || 'Discard',
        cancelText: t('common.cancel') || 'Cancel',
        onOk: () => navigate(path),
      });
    } else {
      navigate(path);
    }
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('widget-type', type);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggingType(type);
  };

  const handleDragEnd = () => {
    setDraggingType(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('widget-type');
    if (!type) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    addWidget(type, dropX, dropY);
    setDraggingType(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const gridLayout: RGLLayout[] = widgets.map(w => {
    const defaults = DEFAULT_POSITIONS[w.widget_type] || { w: 4, h: 3, minW: 2, minH: 2 };
    const pos = w.position || { x: 0, y: 0, w: defaults.w, h: defaults.h };
    return {
      i: w.id,
      x: (pos.x as number) || 0,
      y: (pos.y as number) || 0,
      w: (pos.w as number) || defaults.w,
      h: (pos.h as number) || defaults.h,
      minW: defaults.minW,
      minH: defaults.minH,
    };
  });

  const getWidgetPreview = (w: Widget) => {
    const data = resolvedData[w.id] as Record<string, unknown> | undefined;
    const wt = WIDGET_TYPES.find(t => t.key === w.widget_type);
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: selectedId === w.id ? 'var(--bg-active)' : 'transparent',
        }}>
          <Space size={6}>
            <span style={{ color: wt?.color }}>{wt?.icon}</span>
            <Text strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{w.title}</Text>
          </Space>
          <Space size={2}>
            <Tooltip title="Duplicate">
              <Button type="text" size="small" icon={<CopyOutlined />} onClick={e => { e.stopPropagation(); duplicateWidget(w.id); }} />
            </Tooltip>
            <Popconfirm title={t('workshop.deleteConfirm')} onConfirm={(e) => { e?.stopPropagation(); deleteWidget(w.id); }}>
              <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={e => e.stopPropagation()} />
            </Popconfirm>
          </Space>
        </div>
        <div style={{ flex: 1, padding: 4, overflow: 'hidden' }}>
          {w.widget_type === 'stat_card' && (
            <StatCardWidget
              title=""
              value={data && typeof (data as Record<string, unknown>).value === 'number'
                ? (data as Record<string, unknown>).value as number : null}
              precision={w.data_binding?.metric === 'avg' ? 2 : 0}
              color={wt?.color}
              animationDuration={400}
            />
          )}
          {w.widget_type === 'table' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {data && (data as Record<string, unknown[]>).items
                  ? `${((data as Record<string, unknown[]>).items).length} rows`
                  : t('workshop.table')}
              </Text>
            </div>
          )}
          {w.widget_type === 'chart' && data && (data as Record<string, unknown>).results ? (
            <ChartWidget
              data={(data as { results: Array<{ key: string; value: number }> }).results}
              chartType={(w.config?.chart_type as 'bar' | 'line' | 'pie') || 'bar'}
              height="100%"
            />
          ) : w.widget_type === 'chart' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <BarChartOutlined style={{ fontSize: 28, color: 'var(--text-quaternary)' }} />
            </div>
          ) : null}
          {w.widget_type === 'action_button' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Button type="primary" size="small" icon={<ThunderboltOutlined />}>{w.title}</Button>
            </div>
          )}
          {w.widget_type === 'filter' && (
            <FilterWidget
              title=""
              options={(data?.options as string[]) || ['Option A', 'Option B']}
              value=""
              onChange={() => {}}
              allLabel={t('workshop.allValues')}
            />
          )}
          {w.widget_type === 'object_list' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Space direction="vertical" align="center" size={4}>
                <UnorderedListOutlined style={{ fontSize: 24, color: 'var(--text-quaternary)' }} />
                <Text style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                  {data && (data as { items?: unknown[] }).items ? `${(data as { items: unknown[] }).items.length} items` : t('workshop.objectList')}
                </Text>
              </Space>
            </div>
          )}
          {w.widget_type === 'agent_chat' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Space direction="vertical" align="center" size={4}>
                <RobotOutlined style={{ fontSize: 24, color: 'var(--text-quaternary)' }} />
                <Text style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{t('workshop.agentChat')}</Text>
              </Space>
            </div>
          )}
          {w.widget_type === 'alert_list' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Space direction="vertical" align="center" size={4}>
                <BellOutlined style={{ fontSize: 24, color: 'var(--text-quaternary)' }} />
                <Text style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                  {data && (data as { alerts?: unknown[] }).alerts ? `${(data as { alerts: unknown[] }).alerts.length} alerts` : t('workshop.alertList')}
                </Text>
              </Space>
            </div>
          )}
        </div>
      </div>
    );
  };

  const selectedOtProps = selectedWidget?.data_binding?.object_type_id
    ? objectTypes.find(ot => ot.id === selectedWidget.data_binding?.object_type_id)?.properties || []
    : [];

  const appVarNames = Object.keys(appVariables);

  const effectiveWidth = gridSize.width > 100 ? gridSize.width : 840;
  const builderRowHeight = Math.max(60, Math.min(80, Math.floor((window.innerHeight - 200) / 12)));

  if (loading) return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '30vh' }} />;

  const renderDataConfig = () => {
    if (!selectedWidget) return null;
    const wt = selectedWidget.widget_type;

    return (
      <Form form={form} layout="vertical" size="small" onFinish={saveConfig}>
        {/* Object Type - for stat_card, table, chart, filter, object_list */}
        {['stat_card', 'table', 'chart', 'filter', 'object_list'].includes(wt) && (
          <Form.Item name="object_type_id" label={t('workshop.objectType')}>
            <Select allowClear placeholder={t('workshop.objectType')}>
              {objectTypes.map(ot => <Select.Option key={ot.id} value={ot.id}>{ot.display_name}</Select.Option>)}
            </Select>
          </Form.Item>
        )}

        {/* Stat Card: metric + property */}
        {wt === 'stat_card' && (
          <>
            <Form.Item name="metric" label={t('workshop.metric')}>
              <Select>
                {(['count', 'sum', 'avg', 'min', 'max'] as const).map(m => (
                  <Select.Option key={m} value={m}>{t(METRIC_I18N_KEY[m])}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="property_name" label={t('workshop.propertyName')}>
              <Select allowClear>
                {selectedOtProps.map(p => <Select.Option key={p.name} value={p.name}>{p.display_name}</Select.Option>)}
              </Select>
            </Form.Item>
          </>
        )}

        {/* Table: page size */}
        {wt === 'table' && (
          <Form.Item name="page_size" label={t('workshop.pageSize')}>
            <InputNumber min={5} max={100} style={{ width: '100%' }} />
          </Form.Item>
        )}

        {/* Chart: metric + group_by + property + chart_type */}
        {wt === 'chart' && (
          <>
            <Form.Item name="metric" label={t('workshop.metric')}>
              <Select>
                {(['count', 'sum', 'avg'] as const).map(m => (
                  <Select.Option key={m} value={m}>{t(METRIC_I18N_KEY[m])}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="group_by" label={t('workshop.groupBy')}>
              <Select allowClear>
                {selectedOtProps.map(p => <Select.Option key={p.name} value={p.name}>{p.display_name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="property_name" label={t('workshop.propertyName')}>
              <Select allowClear>
                {selectedOtProps.map(p => <Select.Option key={p.name} value={p.name}>{p.display_name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="chart_type" label={t('workshop.chartType')}>
              <Select>
                <Select.Option value="bar">{t('workshop.barChart')}</Select.Option>
                <Select.Option value="line">{t('workshop.lineChart')}</Select.Option>
                <Select.Option value="pie">{t('workshop.pieChart')}</Select.Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* Action Button */}
        {wt === 'action_button' && (
          <Form.Item name="action_type_id" label={t('workshop.actionType')}>
            <Select allowClear>
              {actionTypes.map(a => <Select.Option key={a.id} value={a.id}>{a.display_name}</Select.Option>)}
            </Select>
          </Form.Item>
        )}

        {/* Filter: field + variable */}
        {wt === 'filter' && (
          <>
            <Form.Item name="filter_field" label={t('workshop.filterField')}>
              <Select allowClear placeholder={t('workshop.filterField')}>
                {selectedOtProps.map(p => <Select.Option key={p.name} value={p.name}>{p.display_name}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="filter_variable" label={t('workshop.filterVariable')}>
              <Input placeholder="e.g. plant_filter" />
            </Form.Item>
          </>
        )}

        {/* Object List: page_size + display_properties */}
        {wt === 'object_list' && (
          <>
            <Form.Item name="page_size" label={t('workshop.pageSize')}>
              <InputNumber min={5} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="display_properties" label={t('workshop.displayProperties')}>
              <Select mode="multiple" allowClear placeholder={t('workshop.displayProperties')}>
                {selectedOtProps.map(p => <Select.Option key={p.name} value={p.name}>{p.display_name}</Select.Option>)}
              </Select>
            </Form.Item>
          </>
        )}

        {/* Agent Chat: agent selection */}
        {wt === 'agent_chat' && (
          <Form.Item name="agent_id" label={t('workshop.agentId')}>
            <Select allowClear placeholder={t('aip.selectAgent')}>
              {agents.map(a => <Select.Option key={a.id} value={a.id}>{a.name}</Select.Option>)}
            </Select>
          </Form.Item>
        )}

        {/* Alert List: severity + unread */}
        {wt === 'alert_list' && (
          <>
            <Form.Item name="page_size" label={t('workshop.pageSize')}>
              <InputNumber min={5} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="severity_filter" label={t('workshop.severityFilter')}>
              <Select allowClear placeholder={t('workshop.selectAll')}>
                <Select.Option value="critical">Critical</Select.Option>
                <Select.Option value="error">Error</Select.Option>
                <Select.Option value="warning">Warning</Select.Option>
                <Select.Option value="info">Info</Select.Option>
              </Select>
            </Form.Item>
          </>
        )}

        <Button type="primary" htmlType="submit" block icon={<SaveOutlined />} style={{ marginTop: 8 }}>
          {t('common.save')}
        </Button>
      </Form>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
      {/* Header */}
      <div style={{
        padding: '8px 0', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => handleNavigateAway('/workshop')} />
          <Text strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>
            {t('workshop.builder')}: {appName}
          </Text>
          {dirty && (
            <span style={{ fontSize: 11, color: 'var(--color-yellow)', fontWeight: 600 }}>
              (unsaved)
            </span>
          )}
        </Space>
        <Space>
          <Tooltip title="Ctrl+Z">
            <Button icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} />
          </Tooltip>
          <Button icon={<EyeOutlined />} onClick={() => handleNavigateAway(`/workshop/${id}`)}>
            {t('workshop.preview')}
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={saveLayout}>
            {t('workshop.saveLayout')}
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', flex: 1, gap: 12, overflow: 'hidden' }}>
        {/* Left: Component Library */}
        <Card
          size="small"
          title={<Text strong style={{ fontSize: 12 }}>{t('workshop.componentLib')}</Text>}
          style={{ width: 180, flexShrink: 0, overflow: 'auto' }}
          styles={{ body: { padding: 8 } }}
        >
          {WIDGET_TYPES.map(wt => (
            <Tooltip key={wt.key} title={t(WIDGET_I18N_KEY[wt.key] || 'workshop.statCard')} placement="right">
              <div
                draggable
                onDragStart={e => handleDragStart(e, wt.key)}
                onDragEnd={handleDragEnd}
                className={`drag-source ${draggingType === wt.key ? 'dragging' : ''}`}
                style={{ marginBottom: 6 }}
              >
                <Button
                  block
                  style={{ textAlign: 'left', borderColor: wt.color, pointerEvents: 'none' }}
                  icon={<span style={{ color: wt.color }}>{wt.icon}</span>}
                >
                  <span style={{ fontSize: 12 }}>
                    {t(WIDGET_I18N_KEY[wt.key] || 'workshop.statCard')}
                  </span>
                </Button>
              </div>
            </Tooltip>
          ))}
          <div style={{ marginTop: 8, padding: '0 4px' }}>
            <Text style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{t('workshop.dragHint')}</Text>
          </div>
          <Button
            block
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => addWidget('stat_card')}
            style={{ marginTop: 8, fontSize: 11 }}
          >
            {t('workshop.addWidget')}
          </Button>
        </Card>

        {/* Center: Grid Canvas */}
        <div
          ref={gridRef}
          className={`grid-dot-bg ${draggingType ? 'drop-target-active' : ''}`}
          style={{
            flex: 1, overflow: 'auto',
            background: 'var(--bg-surface)', borderRadius: 8,
            border: '1px solid var(--border-subtle)', padding: 8,
            transition: 'outline-color 150ms ease',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          {widgets.length === 0 ? (
            <Empty description={t('workshop.noWidgets')} style={{ marginTop: '20vh' }}>
              <Button icon={<PlusOutlined />} onClick={() => addWidget('stat_card')}>{t('workshop.addWidget')}</Button>
            </Empty>
          ) : (
            <ReactGridLayout
              className="layout"
              layout={gridLayout}
              cols={12}
              rowHeight={builderRowHeight}
              width={effectiveWidth}
              onLayoutChange={onLayoutChange}
              draggableHandle=".widget-drag-handle"
              compactType="vertical"
              margin={[12, 12]}
              resizeHandles={['se', 'e', 's']}
              useCSSTransforms
            >
              {widgets.map(w => (
                <div
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className={`builder-widget ${selectedId === w.id ? 'selected' : ''}`}
                >
                  <div className="widget-drag-handle" style={{ cursor: 'move', height: '100%' }}>
                    {getWidgetPreview(w)}
                  </div>
                </div>
              ))}
            </ReactGridLayout>
          )}
        </div>

        {/* Right: Config Panel */}
        <Card
          size="small"
          title={<Text strong style={{ fontSize: 12 }}>{t('workshop.configPanel')}</Text>}
          style={{ width: 280, flexShrink: 0, overflow: 'auto' }}
          styles={{ body: { padding: 0 } }}
        >
          {!selectedWidget ? (
            <div style={{ padding: 12 }}>
              <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('workshop.dragHint')}
              </Text>
            </div>
          ) : (
            <Tabs
              size="small"
              items={[
                {
                  key: 'basic',
                  label: 'Basic',
                  children: (
                    <div style={{ padding: '4px 12px 12px' }}>
                      <Form form={form} layout="vertical" size="small" onFinish={saveConfig}>
                        <Form.Item name="title" label={t('workshop.widgetTitle')}>
                          <Input />
                        </Form.Item>
                        <Form.Item label={t('workshop.widgetType')}>
                          <Input value={t(WIDGET_I18N_KEY[selectedWidget.widget_type] || 'workshop.statCard')} disabled />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" block icon={<SaveOutlined />} style={{ marginTop: 8 }}>
                          {t('common.save')}
                        </Button>
                      </Form>
                    </div>
                  ),
                },
                {
                  key: 'data',
                  label: 'Data',
                  children: (
                    <div style={{ padding: '4px 12px 12px' }}>
                      {renderDataConfig()}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
