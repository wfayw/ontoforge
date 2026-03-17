import { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Tabs, Table, Select, message, Space, Switch, Button, Input, Tooltip, Modal, Form } from 'antd';
import { UserOutlined, AuditOutlined, SettingOutlined, ReloadOutlined, SearchOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/i18n';
import { usePermission } from '@/hooks/usePermission';
import { authApi, auditApi } from '@/services/api';
import PageHeader from '@/components/PageHeader';
import type { User, AuditLog } from '@/types';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', color: 'red' },
  { value: 'editor', label: 'Editor', color: 'blue' },
  { value: 'viewer', label: 'Viewer', color: 'green' },
];

function roleColor(role: string) {
  return ROLE_OPTIONS.find(r => r.value === role)?.color || 'default';
}

function UserManagement() {
  const { t } = useI18n();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await authApi.listUsers();
      setUsers(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await authApi.updateUserRole(userId, role);
      message.success(t('settings.roleUpdated'));
      loadUsers();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const handleToggleActive = async (userId: string, active: boolean) => {
    try {
      await authApi.updateUser(userId, { is_active: active });
      message.success(t('common.success'));
      loadUsers();
    } catch {
      message.error(t('common.failed'));
    }
  };

  const createUser = async (values: Record<string, unknown>) => {
    try {
      await authApi.register(values as { username: string; email: string; password: string });
      message.success(t('settings.userCreated'));
      setCreateOpen(false);
      createForm.resetFields();
      loadUsers();
    } catch { message.error(t('settings.userCreateFailed')); }
  };

  const columns = [
    { title: t('settings.username'), dataIndex: 'username', key: 'username', width: 140 },
    { title: t('settings.email'), dataIndex: 'email', key: 'email', width: 200 },
    { title: t('settings.displayName'), dataIndex: 'display_name', key: 'display_name', width: 140 },
    {
      title: t('settings.role'), dataIndex: 'role', key: 'role', width: 140,
      render: (role: string, record: User) => (
        record.id === currentUser?.id
          ? <Tag color={roleColor(role)}>{role}</Tag>
          : <Select size="small" value={role} style={{ width: 110 }}
              options={ROLE_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
              onChange={(v) => handleRoleChange(record.id, v)} />
      ),
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active', width: 100,
      render: (active: boolean, record: User) => (
        record.id === currentUser?.id
          ? <Tag color="green">{t('settings.active')}</Tag>
          : <Switch size="small" checked={active} onChange={(v) => handleToggleActive(record.id, v)} />
      ),
    },
    {
      title: t('settings.createdAt'), dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <>
    <Card
      title={<span style={{ color: 'var(--text-primary)' }}><UserOutlined style={{ marginRight: 8 }} />{t('settings.userManagement')}</span>}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', marginBottom: 16 }}
      extra={<Space><Button size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('settings.createUser')}</Button><Button size="small" icon={<ReloadOutlined />} onClick={loadUsers}>{t('settings.refresh')}</Button></Space>}
    >
      <Table
        dataSource={users} columns={columns} rowKey="id" loading={loading}
        size="small" pagination={false}
        style={{ background: 'transparent' }}
      />
    </Card>
    <Modal title={t('settings.createUser')} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createForm.submit()} okText={t('common.create')}>
      <Form form={createForm} onFinish={createUser} layout="vertical">
        <Form.Item name="username" label={t('settings.username')} rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="email" label={t('settings.email')} rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        <Form.Item name="password" label={t('login.password')} rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
      </Form>
    </Modal>
    </>
  );
}

function AuditLogViewer() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>();
  const [resourceFilter, setResourceFilter] = useState<string>();
  const [usernameFilter, setUsernameFilter] = useState<string>();
  const [actions, setActions] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  const loadLogs = async (p = page) => {
    setLoading(true);
    try {
      const { data } = await auditApi.listLogs({
        page: p, page_size: 15,
        action: actionFilter, resource_type: resourceFilter, username: usernameFilter,
      });
      setLogs(data.items);
      setTotal(data.total);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const loadFilters = async () => {
    try {
      const [a, r] = await Promise.all([auditApi.listActions(), auditApi.listResourceTypes()]);
      setActions(a.data);
      setResourceTypes(r.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { loadLogs(1); setPage(1); }, [actionFilter, resourceFilter, usernameFilter]);

  const actionColors: Record<string, string> = {
    create: 'green', delete: 'red', update: 'blue', execute: 'orange',
    run: 'purple', login: 'cyan', update_role: 'magenta', publish: 'gold',
  };

  const columns = [
    {
      title: t('settings.auditTime'), dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    { title: t('settings.auditUser'), dataIndex: 'username', key: 'username', width: 120 },
    {
      title: t('settings.auditAction'), dataIndex: 'action', key: 'action', width: 120,
      render: (v: string) => <Tag color={actionColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: t('settings.auditResource'), dataIndex: 'resource_type', key: 'resource_type', width: 140,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: t('settings.auditResourceId'), dataIndex: 'resource_id', key: 'resource_id', width: 130,
      render: (v: string | null) => v ? <Tooltip title={v}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(0, 8)}...</span></Tooltip> : '—',
    },
    {
      title: t('settings.auditDetails'), dataIndex: 'details', key: 'details',
      render: (v: Record<string, unknown>) => {
        const str = JSON.stringify(v);
        return str.length > 60
          ? <Tooltip title={str}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{str.slice(0, 60)}...</span></Tooltip>
          : <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{str}</span>;
      },
    },
  ];

  return (
    <Card
      title={<span style={{ color: 'var(--text-primary)' }}><AuditOutlined style={{ marginRight: 8 }} />{t('settings.auditLog')}</span>}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', marginBottom: 16 }}
    >
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear placeholder={t('settings.auditAction')} style={{ width: 140 }}
          options={actions.map(a => ({ value: a, label: a }))}
          value={actionFilter} onChange={setActionFilter} size="small"
        />
        <Select
          allowClear placeholder={t('settings.auditResource')} style={{ width: 160 }}
          options={resourceTypes.map(r => ({ value: r, label: r }))}
          value={resourceFilter} onChange={setResourceFilter} size="small"
        />
        <Input
          allowClear placeholder={t('settings.auditUser')} style={{ width: 140 }}
          prefix={<SearchOutlined />} value={usernameFilter}
          onChange={e => setUsernameFilter(e.target.value || undefined)} size="small"
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={() => loadLogs(page)} />
      </Space>
      <Table
        dataSource={logs} columns={columns} rowKey="id" loading={loading}
        size="small" style={{ background: 'transparent' }}
        pagination={{ current: page, total, pageSize: 15, size: 'small',
          onChange: (p) => { setPage(p); loadLogs(p); }
        }}
      />
    </Card>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const { isAdmin } = usePermission();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm] = Form.useForm();

  const openEditProfile = () => {
    profileForm.setFieldsValue({ display_name: user?.display_name || '' });
    setEditProfileOpen(true);
  };

  const saveProfile = async (values: Record<string, unknown>) => {
    if (!user) return;
    try {
      await authApi.updateUser(user.id, { display_name: values.display_name as string });
      message.success(t('settings.profileUpdated'));
      setEditProfileOpen(false);
    } catch { message.error(t('settings.profileUpdateFailed')); }
  };

  const items = [
    {
      key: 'profile',
      label: <span><SettingOutlined style={{ marginRight: 4 }} />{t('settings.userProfile')}</span>,
      children: (
        <>
          <Card title={<span style={{ color: 'var(--text-primary)' }}>{t('settings.userProfile')}</span>} style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', marginBottom: 16 }}
            extra={<Button size="small" icon={<EditOutlined />} onClick={openEditProfile}>{t('settings.editProfile')}</Button>}
          >
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('settings.username')}>{user?.username}</Descriptions.Item>
              <Descriptions.Item label={t('settings.email')}>{user?.email}</Descriptions.Item>
              <Descriptions.Item label={t('settings.displayName')}>{user?.display_name}</Descriptions.Item>
              <Descriptions.Item label={t('settings.role')}><Tag color={roleColor(user?.role || '')}>{user?.role}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title={<span style={{ color: 'var(--text-primary)' }}>{t('settings.platformInfo')}</span>} style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label={t('settings.platform')}>OntoForge</Descriptions.Item>
              <Descriptions.Item label={t('settings.version')}>1.0.0</Descriptions.Item>
              <Descriptions.Item label={t('settings.backend')}>FastAPI + SQLite</Descriptions.Item>
              <Descriptions.Item label={t('settings.frontend')}>React + Ant Design</Descriptions.Item>
              <Descriptions.Item label={t('settings.aiIntegration')}>OpenAI-compatible API</Descriptions.Item>
              <Descriptions.Item label={t('settings.license')}>Enterprise</Descriptions.Item>
            </Descriptions>
          </Card>
        </>
      ),
    },
    ...(isAdmin ? [{
      key: 'users',
      label: <span><UserOutlined style={{ marginRight: 4 }} />{t('settings.userManagement')}</span>,
      children: <UserManagement />,
    }] : []),
    ...(isAdmin ? [{
      key: 'audit',
      label: <span><AuditOutlined style={{ marginRight: 4 }} />{t('settings.auditLog')}</span>,
      children: <AuditLogViewer />,
    }] : []),
  ];

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Tabs items={items} style={{ marginTop: -8 }} />
      <Modal title={t('settings.editProfile')} open={editProfileOpen} onCancel={() => setEditProfileOpen(false)} onOk={() => profileForm.submit()} okText={t('common.save')}>
        <Form form={profileForm} onFinish={saveProfile} layout="vertical">
          <Form.Item name="display_name" label={t('settings.displayName')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
