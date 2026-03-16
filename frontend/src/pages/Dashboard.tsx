import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Typography, Space, Skeleton, Tag, Timeline } from 'antd';
import {
  ApartmentOutlined, DatabaseOutlined, ApiOutlined, RobotOutlined,
  LinkOutlined, NodeIndexOutlined, BellOutlined, ClockCircleOutlined,
  AppstoreOutlined, RightOutlined, CheckCircleOutlined, WarningOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ontologyApi, instanceApi, dataSourceApi, pipelineApi, aipApi, alertApi, workshopApi } from '@/services/api';
import { useI18n } from '@/i18n';
import { StatCardWidget } from '@/components/widgets';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;

interface Stats {
  objectTypes: number;
  linkTypes: number;
  objects: number;
  dataSources: number;
  pipelines: number;
  agents: number;
  workshopApps: number;
}

interface AggResult { key: string; value: number; color?: string }

const CHART_COLORS = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d', '#fa8c16'];

const STATUS_COLORS: Record<string, string> = {
  '已下单': '#1890ff', '已审批': '#52c41a', '已到货': '#13c2c2',
  '已发货': '#faad14', '生产中': '#722ed1', '已验收': '#2f54eb',
  '已驳回': '#ff4d4f', '已取消': '#999',
};

interface ActivityItem {
  type: 'pipeline' | 'alert' | 'object';
  title: string;
  time: string;
  color: string;
  icon: React.ReactNode;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, tArray } = useI18n();
  const [stats, setStats] = useState<Stats>({ objectTypes: 0, linkTypes: 0, objects: 0, dataSources: 0, pipelines: 0, agents: 0, workshopApps: 0 });
  const [loading, setLoading] = useState(true);
  const [typeBreakdown, setTypeBreakdown] = useState<AggResult[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<AggResult[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [scheduledJobs, setScheduledJobs] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjectTypes(),
      ontologyApi.listLinkTypes(),
      instanceApi.listObjects({ page_size: 1 }),
      dataSourceApi.list(),
      pipelineApi.list(),
      aipApi.listAgents(),
      workshopApi.listApps().catch(() => ({ data: [] })),
    ]).then(([types, links, objects, sources, pipes, agents, apps]) => {
      const ots = types.data as Array<{ id: string; name: string; display_name: string; color: string }>;
      setStats({
        objectTypes: ots.length,
        linkTypes: links.data.length,
        objects: objects.data.total || 0,
        dataSources: sources.data.length,
        pipelines: pipes.data.length,
        agents: agents.data.length,
        workshopApps: apps.data.length,
      });

      const countPromises = ots.map(ot =>
        instanceApi.aggregate({ object_type_id: ot.id, metric: 'count' })
          .then(r => ({ key: ot.display_name, value: r.data.value ?? r.data.results?.[0]?.value ?? 0, color: ot.color }))
          .catch(() => ({ key: ot.display_name, value: 0, color: ot.color }))
      );
      Promise.all(countPromises).then(counts => setTypeBreakdown(counts.filter(c => c.value > 0)));

      const poType = ots.find(ot => ot.name === 'purchase_order');
      if (poType) {
        instanceApi.aggregate({ object_type_id: poType.id, metric: 'count', group_by: 'status' })
          .then(r => setStatusBreakdown(r.data.results || []))
          .catch(() => {});
      }

      const activities: ActivityItem[] = [];
      const pipelinesData = pipes.data as Array<{ name: string; updated_at: string }>;
      pipelinesData.slice(0, 3).forEach(p => {
        activities.push({
          type: 'pipeline',
          title: `${t('dashboard.pipelines')}: ${p.name}`,
          time: p.updated_at?.slice(0, 16).replace('T', ' ') || '',
          color: '#13c2c2',
          icon: <ApiOutlined />,
        });
      });
      setRecentActivity(activities);
    }).catch(() => {}).finally(() => setLoading(false));

    alertApi.unreadCount().then(r => {
      const count = r.data.unread || 0;
      setUnreadAlerts(count);
      if (count > 0) {
        setRecentActivity(prev => [{
          type: 'alert',
          title: `${count} ${t('dashboard.unreadAlerts')}`,
          time: new Date().toISOString().slice(0, 16).replace('T', ' '),
          color: '#ff4d4f',
          icon: <WarningOutlined />,
        }, ...prev]);
      }
    }).catch(() => {});

    pipelineApi.schedulerStatus().then(r => setScheduledJobs(r.data.jobs?.length ?? 0)).catch(() => {});
  }, [t]);

  const cardConfig = [
    { title: t('dashboard.objectTypes'), value: stats.objectTypes, icon: <ApartmentOutlined />, color: 'var(--color-blue)', path: '/ontology' },
    { title: t('dashboard.linkTypes'), value: stats.linkTypes, icon: <LinkOutlined />, color: 'var(--color-green)', path: '/ontology' },
    { title: t('dashboard.objectInstances'), value: stats.objects, icon: <DatabaseOutlined />, color: 'var(--color-yellow)', path: '/explorer' },
    { title: t('dashboard.dataSources'), value: stats.dataSources, icon: <NodeIndexOutlined />, color: 'var(--color-pink)', path: '/pipelines' },
    { title: t('dashboard.pipelines'), value: stats.pipelines, icon: <ApiOutlined />, color: 'var(--color-cyan)', path: '/pipelines' },
    { title: t('dashboard.aiAgents'), value: stats.agents, icon: <RobotOutlined />, color: 'var(--color-purple)', path: '/aip' },
    { title: t('dashboard.unreadAlerts'), value: unreadAlerts, icon: <BellOutlined />, color: unreadAlerts > 0 ? 'var(--color-pink)' : 'var(--text-tertiary)', path: '/pipelines' },
    { title: t('dashboard.scheduledJobs'), value: scheduledJobs, icon: <ClockCircleOutlined />, color: 'var(--color-cyan)', path: '/pipelines' },
  ];

  const archLayers = tArray('dashboard.archLayers');
  const archColors = ['#1a3a5c', '#1a4a3c', '#2a2a5c', '#3a1a5c', '#5c1a3a'];

  const statusTotal = statusBreakdown.reduce((s, d) => s + d.value, 0);

  const renderCustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: AggResult; name: string; value: number }> }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const total = typeBreakdown.reduce((s, d) => s + d.value, 0) || statusTotal;
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '8px 12px', boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{item.key}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
          {item.value.toLocaleString()} ({pct}%)
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      {/* Stat Cards Row */}
      <Row gutter={[16, 16]}>
        {cardConfig.map((c, idx) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <Card
              className={`card-hoverable anim-fade-in anim-stagger-${idx + 1}`}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              styles={{ body: { padding: '16px 20px' } }}
              onClick={() => navigate(c.path)}
            >
              <Skeleton loading={loading} active paragraph={false} title={{ width: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StatCardWidget
                    title={c.title}
                    value={c.value}
                    color={c.color.startsWith('var(') ? undefined : c.color}
                    animationDuration={600}
                  />
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: `${c.color}14`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: c.color, flexShrink: 0,
                  }}>
                    {c.icon}
                  </div>
                </div>
              </Skeleton>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Row */}
      {(typeBreakdown.length > 0 || statusBreakdown.length > 0) && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          {typeBreakdown.length > 0 && (
            <Col xs={24} lg={12}>
              <Card
                className="anim-fade-in anim-stagger-3"
                title={<Space><DatabaseOutlined style={{ color: 'var(--color-blue)' }} /><span style={{ color: 'var(--text-primary)' }}>{t('dashboard.dataDistribution')}</span></Space>}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              >
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeBreakdown}
                        dataKey="value"
                        nameKey="key"
                        cx="50%"
                        cy="50%"
                        innerRadius="35%"
                        outerRadius="65%"
                        paddingAngle={3}
                        label={({ key, percent }) => `${key} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                        style={{ cursor: 'pointer' }}
                        onClick={(_, idx) => {
                          navigate(`/explorer`);
                          void idx;
                        }}
                      >
                        {typeBreakdown.map((d, i) => (
                          <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={renderCustomTooltip as never} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          )}

          {statusBreakdown.length > 0 && (
            <Col xs={24} lg={12}>
              <Card
                className="anim-fade-in anim-stagger-4"
                title={<Space><AppstoreOutlined style={{ color: 'var(--color-pink)' }} /><span style={{ color: 'var(--text-primary)' }}>{t('dashboard.orderStatus')}</span></Space>}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              >
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusBreakdown}
                        dataKey="value"
                        nameKey="key"
                        cx="50%"
                        cy="50%"
                        innerRadius="35%"
                        outerRadius="65%"
                        paddingAngle={3}
                        label={({ key, percent }) => `${key} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statusBreakdown.map((d, i) => (
                          <Cell key={i} fill={STATUS_COLORS[d.key] || CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={renderCustomTooltip as never} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                        style={{ fontSize: 20, fontWeight: 700, fill: 'var(--text-primary)' }}>
                        {statusTotal}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* Activity + Architecture */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            className="anim-fade-in anim-stagger-5"
            title={<Space><ClockCircleOutlined style={{ color: 'var(--color-cyan)' }} /><span style={{ color: 'var(--text-primary)' }}>{t('dashboard.quickStart')}</span></Space>}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
          >
            {recentActivity.length > 0 ? (
              <Timeline
                items={recentActivity.map(a => ({
                  color: a.color,
                  dot: a.icon,
                  children: (
                    <div>
                      <Text style={{ fontSize: 13 }}>{a.title}</Text>
                      <Text style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block' }}>{a.time}</Text>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Timeline
                items={[
                  { dot: <CheckCircleOutlined style={{ color: 'var(--color-green)' }} />, children: <Text onClick={() => navigate('/ontology')} style={{ cursor: 'pointer', fontSize: 13 }}>1. {t('dashboard.quickStep1').replace(/<[^>]*>/g, '')} <RightOutlined style={{ fontSize: 10 }} /></Text> },
                  { dot: <CheckCircleOutlined style={{ color: 'var(--color-blue)' }} />, children: <Text onClick={() => navigate('/pipelines')} style={{ cursor: 'pointer', fontSize: 13 }}>2. {t('dashboard.quickStep2').replace(/<[^>]*>/g, '')} <RightOutlined style={{ fontSize: 10 }} /></Text> },
                  { dot: <CheckCircleOutlined style={{ color: 'var(--color-cyan)' }} />, children: <Text onClick={() => navigate('/explorer')} style={{ cursor: 'pointer', fontSize: 13 }}>3. {t('dashboard.quickStep3').replace(/<[^>]*>/g, '')} <RightOutlined style={{ fontSize: 10 }} /></Text> },
                  { dot: <CheckCircleOutlined style={{ color: 'var(--color-purple)' }} />, children: <Text onClick={() => navigate('/aip')} style={{ cursor: 'pointer', fontSize: 13 }}>4. {t('dashboard.quickStep4').replace(/<[^>]*>/g, '')} <RightOutlined style={{ fontSize: 10 }} /></Text> },
                ]}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="anim-fade-in anim-stagger-6"
            title={<span style={{ color: 'var(--text-primary)' }}>{t('dashboard.architecture')}</span>}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {archLayers.map((layer, i) => (
                  <Tag key={layer} style={{
                    padding: '10px 18px', borderRadius: 8, fontSize: 13,
                    background: `linear-gradient(135deg, ${archColors[i % archColors.length]}, transparent)`,
                    border: '1px solid var(--border)', color: 'var(--text-secondary)',
                  }}>
                    {layer}
                  </Tag>
                ))}
              </div>
              <Text style={{ color: 'var(--text-tertiary)', fontSize: 12, display: 'block', marginTop: 12 }}>
                {t('dashboard.archFooter')}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
