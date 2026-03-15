import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Space, Skeleton, Tag, Empty, Progress } from 'antd';
import {
  ApartmentOutlined,
  DatabaseOutlined,
  ApiOutlined,
  RobotOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PieChartOutlined,
  BarChartOutlined,
  BellOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { ontologyApi, instanceApi, dataSourceApi, pipelineApi, aipApi, alertApi } from '@/services/api';
import { useI18n } from '@/i18n';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;

interface Stats {
  objectTypes: number;
  linkTypes: number;
  objects: number;
  dataSources: number;
  pipelines: number;
  agents: number;
}

interface AggResult { key: string; value: number; period?: string }
interface ObjectType { id: string; name: string; display_name: string; color: string }

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, tArray } = useI18n();
  const [stats, setStats] = useState<Stats>({ objectTypes: 0, linkTypes: 0, objects: 0, dataSources: 0, pipelines: 0, agents: 0 });
  const [loading, setLoading] = useState(true);
  const [allTypes, setAllTypes] = useState<ObjectType[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<AggResult[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<AggResult[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [scheduledJobs, setScheduledJobs] = useState(0);

  useEffect(() => {
    Promise.all([
      ontologyApi.listObjectTypes(),
      ontologyApi.listLinkTypes(),
      instanceApi.listObjects({ page_size: 1 }),
      dataSourceApi.list(),
      pipelineApi.list(),
      aipApi.listAgents(),
    ]).then(([types, links, objects, sources, pipes, agents]) => {
      const ots: ObjectType[] = types.data;
      setAllTypes(ots);
      setStats({
        objectTypes: ots.length,
        linkTypes: links.data.length,
        objects: objects.data.total || 0,
        dataSources: sources.data.length,
        pipelines: pipes.data.length,
        agents: agents.data.length,
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
    }).catch(() => {}).finally(() => setLoading(false));

    alertApi.unreadCount().then(r => setUnreadAlerts(r.data.unread || 0)).catch(() => {});
    pipelineApi.schedulerStatus().then(r => setScheduledJobs(r.data.jobs?.length ?? 0)).catch(() => {});
  }, []);

  const cards = [
    { title: t('dashboard.objectTypes'), value: stats.objectTypes, icon: <ApartmentOutlined style={{ fontSize: 28, color: 'var(--color-blue)' }} />, path: '/ontology' },
    { title: t('dashboard.linkTypes'), value: stats.linkTypes, icon: <LinkOutlined style={{ fontSize: 28, color: 'var(--color-green)' }} />, path: '/ontology' },
    { title: t('dashboard.objectInstances'), value: stats.objects, icon: <DatabaseOutlined style={{ fontSize: 28, color: 'var(--color-yellow)' }} />, path: '/explorer' },
    { title: t('dashboard.dataSources'), value: stats.dataSources, icon: <NodeIndexOutlined style={{ fontSize: 28, color: 'var(--color-pink)' }} />, path: '/pipelines' },
    { title: t('dashboard.pipelines'), value: stats.pipelines, icon: <ApiOutlined style={{ fontSize: 28, color: 'var(--color-cyan)' }} />, path: '/pipelines' },
    { title: t('dashboard.aiAgents'), value: stats.agents, icon: <RobotOutlined style={{ fontSize: 28, color: 'var(--color-purple)' }} />, path: '/aip' },
    { title: t('dashboard.unreadAlerts'), value: unreadAlerts, icon: <BellOutlined style={{ fontSize: 28, color: unreadAlerts > 0 ? 'var(--color-pink)' : 'var(--text-tertiary)' }} />, path: '/pipelines' },
    { title: t('dashboard.scheduledJobs'), value: scheduledJobs, icon: <ClockCircleOutlined style={{ fontSize: 28, color: 'var(--color-cyan)' }} />, path: '/pipelines' },
  ];

  const archLayers = tArray('dashboard.archLayers');
  const archColors = ['#1a3a5c', '#1a4a3c', '#2a2a5c', '#3a1a5c', '#5c1a3a'];

  return (
    <div>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <Card
              hoverable
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              onClick={() => navigate(c.path)}
            >
              <Skeleton loading={loading} active paragraph={false} title={{ width: 80 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Statistic title={<span style={{ color: 'var(--text-secondary)' }}>{c.title}</span>} value={c.value} valueStyle={{ color: 'var(--stat-value)' }} />
                  {c.icon}
                </div>
              </Skeleton>
            </Card>
          </Col>
        ))}
      </Row>

      {(typeBreakdown.length > 0 || statusBreakdown.length > 0) && (
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          {typeBreakdown.length > 0 && (
            <Col xs={24} lg={12}>
              <Card
                title={<Space><PieChartOutlined style={{ color: 'var(--color-blue)' }} /><span style={{ color: 'var(--text-primary)' }}>{t('dashboard.dataDistribution')}</span></Space>}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              >
                {(() => {
                  const maxVal = Math.max(...typeBreakdown.map(d => d.value), 1);
                  return typeBreakdown.map(d => (
                    <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Text style={{ color: 'var(--text-secondary)', width: 120, fontSize: 13, flexShrink: 0, textAlign: 'right' }}>{d.key}</Text>
                      <Progress
                        percent={Math.round((d.value / maxVal) * 100)}
                        strokeColor={(d as AggResult & { color?: string }).color || 'var(--primary)'}
                        showInfo={false}
                        style={{ flex: 1, margin: 0 }}
                        size="small"
                      />
                      <Text strong style={{ color: 'var(--text-primary)', width: 40, textAlign: 'right', fontSize: 13 }}>{d.value}</Text>
                    </div>
                  ));
                })()}
              </Card>
            </Col>
          )}
          {statusBreakdown.length > 0 && (
            <Col xs={24} lg={12}>
              <Card
                title={<Space><BarChartOutlined style={{ color: 'var(--color-pink)' }} /><span style={{ color: 'var(--text-primary)' }}>{t('dashboard.orderStatus')}</span></Space>}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              >
                {(() => {
                  const total = statusBreakdown.reduce((s, d) => s + d.value, 0);
                  const statusColors: Record<string, string> = {
                    '已下单': 'var(--color-blue)', '已审批': 'var(--color-green)', '已到货': 'var(--color-cyan)',
                    '已驳回': 'var(--color-pink)', '已取消': 'var(--text-tertiary)',
                  };
                  return statusBreakdown.map(d => (
                    <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Tag color={statusColors[d.key] || 'default'} style={{ width: 72, textAlign: 'center', margin: 0 }}>{d.key}</Tag>
                      <Progress
                        percent={Math.round((d.value / total) * 100)}
                        strokeColor={statusColors[d.key] || 'var(--primary)'}
                        format={() => `${d.value} (${Math.round((d.value / total) * 100)}%)`}
                        style={{ flex: 1, margin: 0 }}
                        size="small"
                      />
                    </div>
                  ));
                })()}
              </Card>
            </Col>
          )}
        </Row>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<span style={{ color: 'var(--text-primary)' }}>{t('dashboard.quickStart')}</span>} style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
            <Space direction="vertical" size={12}>
              <Text style={{ color: 'var(--text-secondary)' }}><span dangerouslySetInnerHTML={{ __html: t('dashboard.quickStep1') }} /></Text>
              <Text style={{ color: 'var(--text-secondary)' }}><span dangerouslySetInnerHTML={{ __html: t('dashboard.quickStep2') }} /></Text>
              <Text style={{ color: 'var(--text-secondary)' }}><span dangerouslySetInnerHTML={{ __html: t('dashboard.quickStep3') }} /></Text>
              <Text style={{ color: 'var(--text-secondary)' }}><span dangerouslySetInnerHTML={{ __html: t('dashboard.quickStep4') }} /></Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<span style={{ color: 'var(--text-primary)' }}>{t('dashboard.architecture')}</span>}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
          >
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {archLayers.map((layer, i) => (
                  <div key={layer} style={{
                    padding: '10px 18px', borderRadius: 8,
                    background: `linear-gradient(135deg, ${archColors[i]}, transparent)`,
                    border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)',
                  }}>
                    {layer}
                  </div>
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
