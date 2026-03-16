import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Space, Typography, Empty, Drawer, message, Tag, Switch, Skeleton } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, ReloadOutlined,
  FullscreenOutlined, FullscreenExitOutlined, SyncOutlined,
} from '@ant-design/icons';
import { workshopApi, ontologyApi, instanceApi, aipApi, alertApi } from '@/services/api';
import { useI18n } from '@/i18n';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useWorkshopEvents } from '@/hooks/useWorkshopEvents';
import {
  StatCardWidget, ChartWidget, DataTableWidget, ActionButtonWidget,
  FilterWidget, ObjectListWidget, AgentChatWidget, AlertListWidget,
} from '@/components/widgets';
import type { ActionType } from '@/types';

const { Text } = Typography;

const METRIC_COLORS: Record<string, string> = {
  count: '#1890ff', sum: '#52c41a', avg: '#fa8c16', min: '#13c2c2', max: '#722ed1',
};

interface Widget {
  id: string;
  widget_type: string;
  title: string;
  config: Record<string, unknown> | null;
  position: Record<string, unknown> | null;
  data_binding: Record<string, unknown> | null;
  order: number;
}

function getRowHeight() {
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  return Math.max(60, Math.min(90, Math.floor((vh - 140) / 12)));
}

export default function WorkshopView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>({});
  const [appName, setAppName] = useState('');
  const [appVariables, setAppVariables] = useState<Record<string, unknown>>({});
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [resolvedData, setResolvedData] = useState<Record<string, unknown>>({});
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drillDrawer, setDrillDrawer] = useState<{ open: boolean; title: string; items: unknown[] }>({ open: false, title: '', items: [] });
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(getRowHeight);

  const eventBus = useWorkshopEvents();

  useEffect(() => {
    const handler = () => setRowHeight(getRowHeight());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const resolveWidgets = useCallback(async (ws: Widget[], vars: Record<string, string>) => {
    const bindable = ws.filter(w => w.data_binding && Object.keys(w.data_binding).length > 0);
    if (bindable.length === 0) return;

    const loadingMap: Record<string, boolean> = {};
    bindable.forEach(w => { loadingMap[w.id] = true; });
    setWidgetLoading(loadingMap);

    try {
      const resolveRes = await workshopApi.resolve(
        bindable.map(w => ({ id: w.id, widget_type: w.widget_type, data_binding: w.data_binding })),
        vars,
      );
      setResolvedData(resolveRes.data);
    } catch { /* ignore */ }

    const doneMap: Record<string, boolean> = {};
    bindable.forEach(w => { doneMap[w.id] = false; });
    setWidgetLoading(doneMap);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [appRes, widgetRes, atRes] = await Promise.all([
        workshopApi.getApp(id),
        workshopApi.listWidgets(id),
        ontologyApi.listActionTypes(),
      ]);
      setAppName(appRes.data.name);
      setWidgets(widgetRes.data);
      setActionTypes(atRes.data);

      const vars = appRes.data.variables || {};
      setAppVariables(vars);

      const defaults: Record<string, string> = {};
      Object.entries(vars).forEach(([k, v]) => {
        defaults[k] = (v as { default?: string })?.default || '';
      });
      eventBus.resetVariables(defaults);

      await resolveWidgets(widgetRes.data, eventBus.variables);
    } catch { /* ignore */ }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, resolveWidgets]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (widgets.length === 0) return;
    const nonFilterWidgets = widgets.filter(w => w.widget_type !== 'filter');
    if (nonFilterWidgets.length === 0) return;
    resolveWidgets(nonFilterWidgets, eventBus.variables);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBus.version]);

  const { secondsLeft, isAutoRefresh, setAutoRefresh, manualRefresh } = useAutoRefresh(fetchData, 30_000);

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  const executeAction = async (actionTypeId: string) => {
    await ontologyApi.executeActionType(actionTypeId, {});
    message.success(t('workshop.executeSuccess'));
    fetchData();
  };

  const handleDrillDown = async (key: string, _value: number, widget: Widget) => {
    const objectTypeId = widget.data_binding?.object_type_id as string;
    if (!objectTypeId) return;
    try {
      const groupBy = widget.data_binding?.group_by as string;
      const res = await instanceApi.listObjects({ object_type_id: objectTypeId, page_size: 100 });
      const all = res.data?.items || [];
      const filtered = groupBy
        ? all.filter((o: { properties: Record<string, unknown> }) => String(o.properties?.[groupBy]) === key)
        : all;
      setDrillDrawer({ open: true, title: `${key} (${filtered.length})`, items: filtered });
    } catch { /* ignore */ }
  };

  const handleFilterChange = (widget: Widget, value: string) => {
    const varName = (widget.config?.variable as string) || '';
    if (varName) eventBus.setVariable(varName, value);
  };

  const renderWidget = (w: Widget) => {
    const data = resolvedData[w.id] as Record<string, unknown> | undefined;
    const isWLoading = widgetLoading[w.id] ?? false;

    switch (w.widget_type) {
      case 'stat_card': {
        const value = data?.value as number ?? 0;
        const metric = (w.data_binding?.metric as string) || 'count';
        return (
          <StatCardWidget
            title={w.title}
            value={value}
            precision={metric === 'avg' ? 2 : 0}
            loading={isWLoading}
            color={METRIC_COLORS[metric] || '#1890ff'}
            prefix={metric === 'sum' ? '¥' : ''}
          />
        );
      }
      case 'table': {
        const items = (data?.items as Array<{ id: string; display_name: string; properties: Record<string, unknown>; created_at: string }>) || [];
        return (
          <DataTableWidget
            items={items}
            loading={isWLoading}
            pageSize={8}
            onRowClick={(item) => navigate(`/explorer?highlight=${item.id}`)}
            conditionalFormats={[
              { field: 'defect_count', operator: '>=', value: 3, color: 'red' },
              { field: 'result', operator: '==', value: 0, color: 'red' },
            ]}
            compact
          />
        );
      }
      case 'chart': {
        const results = (data?.results as Array<{ key: string; value: number }>) || [];
        const chartType = (w.config?.chart_type as 'bar' | 'line' | 'pie') || 'bar';
        return (
          <ChartWidget
            data={results}
            chartType={chartType}
            loading={isWLoading}
            switchable
            onSegmentClick={(key, value) => handleDrillDown(key, value, w)}
          />
        );
      }
      case 'action_button': {
        const actionTypeId = w.data_binding?.action_type_id as string;
        const action = actionTypes.find(a => a.id === actionTypeId);
        return (
          <ActionButtonWidget
            label={action?.display_name || w.title}
            actionTypeId={actionTypeId}
            onExecute={executeAction}
            loading={isWLoading}
            confirmTitle={t('workshop.confirmExecute')}
          />
        );
      }
      case 'filter': {
        const options = (data?.options as string[]) || [];
        const varName = (w.config?.variable as string) || '';
        const currentValue = eventBus.variables[varName] || '';
        return (
          <FilterWidget
            title={w.title}
            options={options}
            value={currentValue}
            onChange={(v) => handleFilterChange(w, v)}
            loading={isWLoading}
            allLabel={t('workshop.allValues')}
          />
        );
      }
      case 'object_list': {
        const items = (data?.items as Array<{ id: string; display_name: string; properties: Record<string, unknown> }>) || [];
        const displayProps = (w.data_binding?.display_properties as string[]) || [];
        return (
          <ObjectListWidget
            items={items}
            loading={isWLoading}
            onSelect={(item) => navigate(`/explorer?highlight=${item.id}`)}
            highlightProperties={displayProps}
            compact
          />
        );
      }
      case 'agent_chat': {
        const agentId = w.data_binding?.agent_id as string;
        return (
          <AgentChatWidget
            agentId={agentId}
            loading={isWLoading}
            placeholder={t('aip.chatPlaceholder')}
          />
        );
      }
      case 'alert_list': {
        const alerts = (data?.alerts as Array<{ id: string; severity: string; message: string; is_read: boolean; object_id: string; created_at: string }>) || [];
        const unread = (data?.unread as number) || 0;
        return (
          <AlertListWidget
            alerts={alerts}
            unread={unread}
            loading={isWLoading}
            onAlertClick={(alert) => navigate(`/explorer?highlight=${alert.object_id}`)}
            compact
          />
        );
      }
      default:
        return <Text>Unknown widget</Text>;
    }
  };

  const gap = 16;

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}><Skeleton active paragraph={{ rows: 3 }} /></Card>
          ))}
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div style={{
        padding: '8px 0', marginBottom: 12,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Space>
          {!isFullscreen && <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/workshop')} />}
          <Text strong style={{ fontSize: 16, color: 'var(--text-primary)' }}>{appName}</Text>
          <Tag color="blue">{t('workshop.preview')}</Tag>
          {Object.values(eventBus.variables).some(v => v !== '') && (
            <Tag color="green">Filtered</Tag>
          )}
        </Space>
        <Space size="middle">
          <span className="refresh-countdown">
            <SyncOutlined spin={isAutoRefresh} style={{ fontSize: 11 }} />
            {isAutoRefresh ? `${secondsLeft}s` : 'paused'}
          </span>
          <Switch
            size="small"
            checked={isAutoRefresh}
            onChange={setAutoRefresh}
            checkedChildren="Auto"
            unCheckedChildren="Off"
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={manualRefresh} />
          <Button size="small" icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} onClick={toggleFullscreen} />
          {!isFullscreen && (
            <Button icon={<EditOutlined />} onClick={() => navigate(`/workshop/${id}/edit`)}>
              {t('common.edit')}
            </Button>
          )}
        </Space>
      </div>

      {widgets.length === 0 ? (
        <Empty description={t('workshop.noWidgets')}>
          <Button type="primary" onClick={() => navigate(`/workshop/${id}/edit`)}>
            {t('workshop.builder')}
          </Button>
        </Empty>
      ) : (
        <div
          className="workshop-grid-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gridAutoRows: rowHeight,
            gap,
          }}
        >
          {widgets.map((w, idx) => {
            const pos = w.position || { x: 0, y: 0, w: 6, h: 4 };
            const col = Number(pos.x ?? 0) + 1;
            const row = Number(pos.y ?? 0) + 1;
            const colSpan = Number(pos.w ?? 6);
            const rowSpan = Number(pos.h ?? 4);

            return (
              <div
                key={w.id}
                className={`anim-fade-in anim-stagger-${Math.min(idx + 1, 8)}`}
                style={{
                  gridColumn: `${col} / span ${colSpan}`,
                  gridRow: `${row} / span ${rowSpan}`,
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                <Card
                  size="small"
                  className="widget-card"
                  title={<Text strong style={{ fontSize: 13 }}>{w.title}</Text>}
                  styles={{
                    body: {
                      padding: ['table', 'object_list', 'alert_list', 'agent_chat'].includes(w.widget_type) ? 0 : 12,
                      flex: 1,
                      minHeight: 0,
                      overflow: ['table', 'object_list', 'alert_list'].includes(w.widget_type) ? 'auto' : 'hidden',
                    },
                    header: { padding: '0 12px', minHeight: 40, flexShrink: 0 },
                  }}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                >
                  {renderWidget(w)}
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Drawer
        title={drillDrawer.title}
        open={drillDrawer.open}
        onClose={() => setDrillDrawer({ open: false, title: '', items: [] })}
        width={600}
      >
        <DataTableWidget
          items={drillDrawer.items as Array<{ id: string; display_name: string; properties: Record<string, unknown> }>}
          pageSize={20}
          maxColumns={8}
          onRowClick={(item) => {
            setDrillDrawer(prev => ({ ...prev, open: false }));
            navigate(`/explorer?highlight=${item.id}`);
          }}
        />
      </Drawer>
    </>
  );

  if (isFullscreen) {
    return (
      <div className="workshop-fullscreen" ref={containerRef}>
        {content}
      </div>
    );
  }

  return <div>{content}</div>;
}
