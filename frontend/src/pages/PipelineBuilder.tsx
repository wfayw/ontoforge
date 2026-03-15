import { useEffect, useState } from 'react';
import { Card, Button, Modal, Form, Input, Select, Table, Tag, Space, Typography, message, Tabs, Upload, Popconfirm, Empty, InputNumber, Switch } from 'antd';
import { PlusOutlined, UploadOutlined, PlayCircleOutlined, DeleteOutlined, CloudServerOutlined, ApiOutlined, FileTextOutlined, ClockCircleOutlined, BellOutlined } from '@ant-design/icons';
import { dataSourceApi, pipelineApi, ontologyApi, alertApi } from '@/services/api';
import { useI18n } from '@/i18n';
import PageHeader from '@/components/PageHeader';
import type { DataSource, Pipeline, PipelineRun, ObjectType, DataPreview } from '@/types';

const { Text } = Typography;

export default function PipelineBuilder() {
  const { t } = useI18n();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [objectTypes, setObjectTypes] = useState<ObjectType[]>([]);
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [plModalOpen, setPlModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<DataPreview | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [runsOpen, setRunsOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [mappingFields, setMappingFields] = useState<string[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulePipeline, setSchedulePipeline] = useState<Pipeline | null>(null);
  const [alertRules, setAlertRules] = useState<{ id: string; name: string; object_type_id: string; condition: Record<string, unknown>; severity: string; is_active: boolean }[]>([]);
  const [alertRuleModalOpen, setAlertRuleModalOpen] = useState(false);
  const [dsForm] = Form.useForm();
  const [plForm] = Form.useForm();
  const [scheduleForm] = Form.useForm();
  const [alertRuleForm] = Form.useForm();

  const fetchAll = async () => {
    const [ds, pl, ot, ar] = await Promise.all([
      dataSourceApi.list(), pipelineApi.list(), ontologyApi.listObjectTypes(),
      alertApi.listRules().catch(() => ({ data: [] })),
    ]);
    setDataSources(ds.data);
    setPipelines(pl.data);
    setObjectTypes(ot.data);
    setAlertRules(ar.data);
  };

  useEffect(() => { fetchAll(); }, []);

  const sourceTypeIcons: Record<string, React.ReactNode> = {
    csv: <FileTextOutlined />,
    postgres: <CloudServerOutlined />,
    rest_api: <ApiOutlined />,
  };

  const createDataSource = async (values: Record<string, unknown>) => {
    try {
      const { name, description, source_type, ...config } = values;
      await dataSourceApi.create({ name, description, source_type, connection_config: config });
      message.success(t('pipeline.sourceCreated'));
      setDsModalOpen(false);
      dsForm.resetFields();
      fetchAll();
    } catch { message.error(t('pipeline.sourceCreateFailed')); }
  };

  const handleCsvUpload = async (file: File) => {
    try {
      await dataSourceApi.uploadCsv(file);
      message.success(t('pipeline.csvUploaded'));
      fetchAll();
    } catch { message.error(t('pipeline.uploadFailed')); }
    return false;
  };

  const testConnection = async (id: string) => {
    try {
      const { data } = await dataSourceApi.test(id);
      if (data.success) message.success(data.message);
      else message.error(data.message);
      fetchAll();
    } catch { message.error(t('pipeline.testFailed')); }
  };

  const showPreview = async (id: string) => {
    try {
      const { data } = await dataSourceApi.preview(id);
      setPreviewData(data);
      setPreviewOpen(true);
    } catch { message.error(t('pipeline.previewFailed')); }
  };

  const handleSourceSelect = async (sourceId: string) => {
    const ds = dataSources.find((d) => d.id === sourceId);
    if (ds) {
      try {
        const { data } = await dataSourceApi.preview(sourceId, 1);
        setMappingFields(data.columns);
      } catch { setMappingFields([]); }
    }
  };

  const createPipeline = async (values: Record<string, unknown>) => {
    try {
      const { name, description, source_id, target_object_type_id, sync_mode, primary_key_property, ...mappings } = values;
      const field_mappings: Record<string, string> = {};
      for (const [k, v] of Object.entries(mappings)) {
        if (v && typeof v === 'string') field_mappings[k] = v;
      }
      await pipelineApi.create({ name, description, source_id, target_object_type_id, field_mappings, sync_mode: sync_mode || 'full', primary_key_property: primary_key_property || null });
      message.success(t('pipeline.pipelineCreated'));
      setPlModalOpen(false);
      plForm.resetFields();
      setMappingFields([]);
      fetchAll();
    } catch { message.error(t('pipeline.pipelineCreateFailed')); }
  };

  const runPipeline = async (id: string) => {
    try {
      const { data } = await pipelineApi.run(id);
      message.success(t('pipeline.runSuccess', { status: data.status, count: data.rows_processed }));
      fetchAll();
    } catch { message.error(t('pipeline.runFailed')); }
  };

  const showRuns = async (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    const { data } = await pipelineApi.listRuns(pipeline.id);
    setRuns(data);
    setRunsOpen(true);
  };

  const openSchedule = (pipeline: Pipeline) => {
    setSchedulePipeline(pipeline);
    const config = pipeline.schedule_config as Record<string, unknown> | null;
    scheduleForm.setFieldsValue({
      type: config?.type || 'cron',
      cron: config?.cron || '0 * * * *',
      minutes: config?.minutes || 60,
    });
    setScheduleOpen(true);
  };

  const saveSchedule = async (values: Record<string, unknown>) => {
    if (!schedulePipeline) return;
    try {
      const config = values.type === 'cron'
        ? { type: 'cron', cron: values.cron }
        : { type: 'interval', minutes: values.minutes };
      await pipelineApi.setSchedule(schedulePipeline.id, config);
      message.success(t('pipeline.scheduleSet'));
      setScheduleOpen(false);
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const removeSchedule = async (pipelineId: string) => {
    try {
      await pipelineApi.removeSchedule(pipelineId);
      message.success(t('pipeline.scheduleRemoved'));
      fetchAll();
    } catch { /* ignore */ }
  };

  const createAlertRule = async (values: Record<string, unknown>) => {
    try {
      await alertApi.createRule({
        name: values.name,
        object_type_id: values.object_type_id,
        condition: { field: values.field, operator: values.operator, value: values.threshold },
        severity: values.severity || 'warning',
      });
      message.success(t('alerts.ruleCreated'));
      setAlertRuleModalOpen(false);
      alertRuleForm.resetFields();
      fetchAll();
    } catch { message.error(t('aip.operationFailed')); }
  };

  const alertRuleColumns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong style={{ color: 'var(--text-primary)' }}>{v}</Text> },
    { title: t('common.type'), dataIndex: 'object_type_id', key: 'type', render: (id: string) => <Tag>{objectTypes.find(o => o.id === id)?.display_name || id}</Tag> },
    { title: t('alerts.condition'), dataIndex: 'condition', key: 'cond',
      render: (c: Record<string, unknown>) => <code>{String(c.field)} {String(c.operator)} {String(c.value)}</code>,
    },
    { title: t('alerts.severity'), dataIndex: 'severity', key: 'sev',
      render: (v: string) => <Tag color={v === 'critical' ? 'red' : v === 'warning' ? 'orange' : 'blue'}>{v}</Tag>,
    },
    { title: '', key: 'actions', width: 80,
      render: (_: unknown, r: { id: string }) => (
        <Popconfirm title={t('pipeline.deleteConfirm')} onConfirm={async () => { await alertApi.deleteRule(r.id); fetchAll(); }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const dsColumns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name', render: (v: string, r: DataSource) => <Space>{sourceTypeIcons[r.source_type]}<Text strong style={{ color: 'var(--text-primary)' }}>{v}</Text></Space> },
    { title: t('common.type'), dataIndex: 'source_type', key: 'type', render: (v: string) => <Tag>{v.toUpperCase()}</Tag> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : v === 'error' ? 'red' : 'default'}>{v}</Tag> },
    {
      title: '', key: 'actions', width: 200,
      render: (_: unknown, record: DataSource) => (
        <Space>
          <Button size="small" onClick={() => testConnection(record.id)}>{t('common.test')}</Button>
          <Button size="small" onClick={() => showPreview(record.id)}>{t('common.preview')}</Button>
          <Popconfirm title={t('pipeline.deleteConfirm')} onConfirm={async () => { await dataSourceApi.delete(record.id); fetchAll(); }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const plColumns = [
    { title: t('common.name'), dataIndex: 'name', key: 'name', render: (v: string) => <Text strong style={{ color: 'var(--text-primary)' }}>{v}</Text> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'active' ? 'green' : v === 'error' ? 'red' : v === 'draft' ? 'blue' : 'default'}>{v}</Tag> },
    { title: t('pipeline.syncMode'), dataIndex: 'sync_mode', key: 'sync', render: (v: string) => <Tag color={v === 'incremental' ? 'cyan' : 'default'}>{v === 'incremental' ? t('pipeline.syncIncremental') : t('pipeline.syncFull')}</Tag> },
    { title: t('pipeline.source'), dataIndex: 'source_id', key: 'source', render: (id: string) => dataSources.find((d) => d.id === id)?.name || id },
    { title: t('pipeline.target'), dataIndex: 'target_object_type_id', key: 'target', render: (id: string) => objectTypes.find((ot) => ot.id === id)?.display_name || id },
    { title: t('pipeline.schedule'), dataIndex: 'schedule_config', key: 'schedule',
      render: (config: Record<string, unknown> | null) => config
        ? <Tag color="blue" icon={<ClockCircleOutlined />}>{config.type === 'cron' ? String(config.cron) : `${config.minutes}min`}</Tag>
        : <Tag>—</Tag>,
    },
    {
      title: '', key: 'actions', width: 300,
      render: (_: unknown, record: Pipeline) => (
        <Space>
          <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => runPipeline(record.id)}>{t('common.run')}</Button>
          <Button size="small" icon={<ClockCircleOutlined />} onClick={() => openSchedule(record)}>{t('pipeline.schedule')}</Button>
          <Button size="small" onClick={() => showRuns(record)}>{t('pipeline.runs')}</Button>
          <Popconfirm title={t('pipeline.deleteConfirm')} onConfirm={async () => { await pipelineApi.delete(record.id); fetchAll(); }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('pipeline.title')}
        subtitle={t('pipeline.subtitle')}
        actions={
          <Space>
            <Upload beforeUpload={handleCsvUpload} showUploadList={false} accept=".csv">
              <Button icon={<UploadOutlined />}>{t('pipeline.uploadCsv')}</Button>
            </Upload>
            <Button icon={<PlusOutlined />} onClick={() => setDsModalOpen(true)}>{t('pipeline.dataSource')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPlModalOpen(true)}>{t('pipeline.pipeline')}</Button>
          </Space>
        }
      />

      <Tabs items={[
        {
          key: 'sources',
          label: t('pipeline.dataSources'),
          children: <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}><Table dataSource={dataSources} columns={dsColumns} rowKey="id" pagination={false} size="small" locale={{ emptyText: <Empty description={t('pipeline.sourceEmptyText')} /> }} /></Card>,
        },
        {
          key: 'pipelines',
          label: t('pipeline.pipelines'),
          children: <Card style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}><Table dataSource={pipelines} columns={plColumns} rowKey="id" pagination={false} size="small" locale={{ emptyText: <Empty description={t('pipeline.pipelineEmptyText')} /> }} /></Card>,
        },
        {
          key: 'alerts',
          label: <><BellOutlined /> {t('alerts.rules')}</>,
          children: (
            <Card
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}
              extra={<Button icon={<PlusOutlined />} onClick={() => setAlertRuleModalOpen(true)}>{t('alerts.createRule')}</Button>}
            >
              <Table dataSource={alertRules} columns={alertRuleColumns} rowKey="id" pagination={false} size="small" locale={{ emptyText: <Empty description={t('alerts.noRules')} /> }} />
            </Card>
          ),
        },
      ]} />

      <Modal title={t('pipeline.createDataSource')} open={dsModalOpen} onCancel={() => setDsModalOpen(false)} onOk={() => dsForm.submit()} okText={t('common.create')} width={500}>
        <Form form={dsForm} onFinish={createDataSource} layout="vertical">
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input /></Form.Item>
          <Form.Item name="source_type" label={t('common.type')} rules={[{ required: true }]}>
            <Select options={[{ value: 'postgres', label: 'PostgreSQL' }, { value: 'rest_api', label: 'REST API' }, { value: 'csv', label: 'CSV' }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.source_type !== cur.source_type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('source_type');
              if (type === 'postgres') return (
                <>
                  <Form.Item name="host" label={t('pipeline.host')}><Input placeholder="localhost" /></Form.Item>
                  <Form.Item name="port" label={t('pipeline.port')}><Input placeholder="5432" /></Form.Item>
                  <Form.Item name="user" label={t('pipeline.user')}><Input /></Form.Item>
                  <Form.Item name="password" label={t('login.password')}><Input.Password /></Form.Item>
                  <Form.Item name="database" label={t('pipeline.database')}><Input /></Form.Item>
                  <Form.Item name="table" label={t('pipeline.table')}><Input /></Form.Item>
                </>
              );
              if (type === 'rest_api') return <Form.Item name="url" label={t('pipeline.apiUrl')}><Input placeholder="https://api.example.com/data" /></Form.Item>;
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('pipeline.createPipeline')} open={plModalOpen} onCancel={() => { setPlModalOpen(false); setMappingFields([]); }} onOk={() => plForm.submit()} okText={t('common.create')} width={600}>
        <Form form={plForm} onFinish={createPipeline} layout="vertical">
          <Form.Item name="name" label={t('pipeline.pipelineName')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('common.description')}><Input /></Form.Item>
          <Form.Item name="source_id" label={t('pipeline.dataSource')} rules={[{ required: true }]}>
            <Select options={dataSources.map((d) => ({ value: d.id, label: `${d.name} (${d.source_type})` }))} onChange={handleSourceSelect} />
          </Form.Item>
          <Form.Item name="target_object_type_id" label={t('pipeline.targetObjectType')} rules={[{ required: true }]}>
            <Select options={objectTypes.map((ot) => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item name="sync_mode" label={t('pipeline.syncMode')} initialValue="full">
            <Select options={[{ value: 'full', label: t('pipeline.syncFull') }, { value: 'incremental', label: t('pipeline.syncIncremental') }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.sync_mode !== cur.sync_mode}>
            {({ getFieldValue }) => getFieldValue('sync_mode') === 'incremental' ? (
              <Form.Item name="primary_key_property" label={t('pipeline.primaryKey')}>
                <Input placeholder="e.g. po_number" />
              </Form.Item>
            ) : null}
          </Form.Item>
          {mappingFields.length > 0 && (
            <>
              <Text strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>{t('pipeline.fieldMappings')}</Text>
              {mappingFields.map((col) => (
                <Form.Item key={col} name={col} label={<code>{col}</code>}>
                  <Input placeholder={t('pipeline.mapPlaceholder', { field: col })} />
                </Form.Item>
              ))}
            </>
          )}
        </Form>
      </Modal>

      <Modal title={t('pipeline.dataPreview')} open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={800}>
        {previewData && (
          <>
            <Text style={{ color: 'var(--text-secondary)' }}>{t('pipeline.totalRows', { count: previewData.total_count })}</Text>
            <Table
              dataSource={previewData.rows.map((r, i) => ({ ...r, _key: i }))}
              columns={previewData.columns.map((c) => ({ title: c, dataIndex: c, key: c, ellipsis: true }))}
              rowKey="_key"
              scroll={{ x: true }}
              size="small"
              pagination={false}
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </Modal>

      <Modal title={t('pipeline.pipelineRuns', { name: selectedPipeline?.name || '' })} open={runsOpen} onCancel={() => setRunsOpen(false)} footer={null} width={800}>
        <Table
          dataSource={runs}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: t('common.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'failed' ? 'red' : 'blue'}>{v}</Tag> },
            { title: t('pipeline.rowsProcessed'), dataIndex: 'rows_processed', key: 'rows' },
            { title: t('pipeline.rowsCreated'), dataIndex: 'rows_created', key: 'created', render: (v: number) => v > 0 ? <Tag color="green">+{v}</Tag> : v },
            { title: t('pipeline.rowsUpdated'), dataIndex: 'rows_updated', key: 'updated', render: (v: number) => v > 0 ? <Tag color="blue">↑{v}</Tag> : v },
            { title: t('pipeline.rowsSkipped'), dataIndex: 'rows_skipped', key: 'skipped', render: (v: number) => v > 0 ? <Tag>={v}</Tag> : v },
            { title: t('pipeline.rowsFailed'), dataIndex: 'rows_failed', key: 'failed' },
            { title: t('pipeline.started'), dataIndex: 'started_at', key: 'start', render: (v: string) => v ? new Date(v).toLocaleString() : '—' },
            { title: t('pipeline.finished'), dataIndex: 'finished_at', key: 'end', render: (v: string) => v ? new Date(v).toLocaleString() : '—' },
          ]}
          locale={{ emptyText: <Empty description={t('pipeline.noRunsYet')} /> }}
        />
      </Modal>

      <Modal title={t('pipeline.schedule')} open={scheduleOpen} onCancel={() => setScheduleOpen(false)} onOk={() => scheduleForm.submit()} okText={t('common.save')}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space>
            {schedulePipeline?.schedule_config && <Button danger onClick={() => { removeSchedule(schedulePipeline!.id); setScheduleOpen(false); }}>{t('common.delete')}</Button>}
            <CancelBtn />
            <OkBtn />
          </Space>
        )}
      >
        <Form form={scheduleForm} onFinish={saveSchedule} layout="vertical">
          <Form.Item name="type" label={t('pipeline.scheduleType')} rules={[{ required: true }]}>
            <Select options={[{ value: 'cron', label: 'Cron' }, { value: 'interval', label: 'Interval' }]} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => getFieldValue('type') === 'cron'
              ? <Form.Item name="cron" label={t('pipeline.cronExpression')} rules={[{ required: true }]}><Input placeholder="0 */6 * * *" /></Form.Item>
              : <Form.Item name="minutes" label={t('pipeline.intervalMinutes')} rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('alerts.createRule')} open={alertRuleModalOpen} onCancel={() => setAlertRuleModalOpen(false)} onOk={() => alertRuleForm.submit()} okText={t('common.create')} width={500}>
        <Form form={alertRuleForm} onFinish={createAlertRule} layout="vertical">
          <Form.Item name="name" label={t('common.name')} rules={[{ required: true }]}><Input placeholder={t('alerts.ruleNamePlaceholder')} /></Form.Item>
          <Form.Item name="object_type_id" label={t('pipeline.targetObjectType')} rules={[{ required: true }]}>
            <Select options={objectTypes.map(ot => ({ value: ot.id, label: ot.display_name }))} />
          </Form.Item>
          <Form.Item label={t('alerts.condition')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="field" noStyle rules={[{ required: true }]}><Input style={{ width: '40%' }} placeholder="property" /></Form.Item>
              <Form.Item name="operator" noStyle rules={[{ required: true }]}>
                <Select style={{ width: '25%' }} options={['==', '!=', '>', '>=', '<', '<=', 'contains'].map(o => ({ value: o, label: o }))} />
              </Form.Item>
              <Form.Item name="threshold" noStyle rules={[{ required: true }]}><Input style={{ width: '35%' }} placeholder="value" /></Form.Item>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="severity" label={t('alerts.severity')} initialValue="warning">
            <Select options={[{ value: 'info', label: 'Info' }, { value: 'warning', label: 'Warning' }, { value: 'critical', label: 'Critical' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
