import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Row, Col, Tag, Modal, Form, Input, Empty, Skeleton, Popconfirm, Space, message } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import { workshopApi } from '@/services/api';
import { useI18n } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import PageHeader from '@/components/PageHeader';

interface WorkshopApp {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_published: boolean;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export default function Workshop() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { canWrite } = usePermission();
  const [apps, setApps] = useState<WorkshopApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchApps = () => {
    setLoading(true);
    workshopApi.listApps()
      .then(r => setApps(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApps(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const { data } = await workshopApi.createApp(values);
      message.success(t('workshop.appCreated'));
      setCreateOpen(false);
      form.resetFields();
      navigate(`/workshop/${data.id}/edit`);
    } catch { /* validation error */ }
  };

  const handleDelete = async (id: string) => {
    await workshopApi.deleteApp(id);
    message.success(t('workshop.appDeleted'));
    fetchApps();
  };

  const handlePublish = async (id: string) => {
    await workshopApi.publishApp(id);
    fetchApps();
  };

  return (
    <div>
      <PageHeader
        title={t('workshop.title')}
        subtitle={t('workshop.subtitle')}
        actions={canWrite ?
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('workshop.createApp')}
          </Button>
          : undefined
        }
      />

      {loading ? <Skeleton active /> : apps.length === 0 ? (
        <Empty description={t('workshop.noApps')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('workshop.createApp')}
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {apps.map(app => (
            <Col xs={24} sm={12} lg={8} xl={6} key={app.id}>
              <Card
                hoverable
                style={{ borderRadius: 8, height: '100%' }}
                actions={[
                  <EyeOutlined key="view" onClick={() => navigate(`/workshop/${app.id}`)} />,
                  <EditOutlined key="edit" onClick={() => navigate(`/workshop/${app.id}/edit`)} />,
                  <Popconfirm title={t('workshop.deleteConfirm')} onConfirm={() => handleDelete(app.id)} key="del">
                    <DeleteOutlined />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  avatar={
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <AppstoreOutlined style={{ color: '#fff', fontSize: 18 }} />
                    </div>
                  }
                  title={
                    <Space>
                      <span>{app.name}</span>
                      <Tag color={app.is_published ? 'green' : 'default'} style={{ fontSize: 11 }}>
                        {app.is_published ? t('workshop.published') : t('workshop.draft')}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 8, minHeight: 36 }}>
                        {app.description || '—'}
                      </div>
                      <Space size={12}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {app.widget_count} {t('workshop.widgets')}
                        </span>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 12 }}
                          onClick={(e) => { e.stopPropagation(); handlePublish(app.id); }}
                        >
                          {app.is_published ? t('workshop.unpublish') : t('workshop.publish')}
                        </Button>
                      </Space>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title={t('workshop.createApp')}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={handleCreate}
        okText={t('common.create')}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t('workshop.appName')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('workshop.appDesc')}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
