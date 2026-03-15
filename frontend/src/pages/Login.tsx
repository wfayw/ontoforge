import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Tabs, Dropdown, Segmented } from 'antd';
import { LockOutlined, UserOutlined, MailOutlined, GlobalOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useI18n, type Locale } from '@/i18n';
import { useTheme, type ThemeMode } from '@/theme';

const { Title, Text } = Typography;

function ThemeIcon({ mode }: { mode: 'system' | 'light' | 'dark' }) {
  const size = 14;
  if (mode === 'light') return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>;
  if (mode === 'dark') return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M6.2 1A7 7 0 0015 9.8 5.5 5.5 0 016.2 1z"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.2"/></svg>;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success(t('login.loginSuccess'));
      navigate('/');
    } catch {
      message.error(t('login.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: { username: string; email: string; password: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.email, values.password);
      message.success(t('login.registerSuccess'));
      setActiveTab('login');
    } catch {
      message.error(t('login.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const langMenu = {
    items: [
      { key: 'zh', label: '中文' },
      { key: 'en', label: 'English' },
    ],
    selectedKeys: [locale],
    onClick: ({ key }: { key: string }) => setLocale(key as Locale),
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-body)', position: 'relative',
      transition: 'background var(--transition)',
    }}>
      <div style={{ position: 'absolute', top: 16, right: 24, display: 'flex', gap: 8, alignItems: 'center' }}>
        <Segmented
          size="small"
          value={mode}
          onChange={(val) => setMode(val as ThemeMode)}
          options={[
            { value: 'system', icon: <ThemeIcon mode="system" />, title: t('layout.themeSystem') },
            { value: 'light', icon: <ThemeIcon mode="light" />, title: t('layout.themeLight') },
            { value: 'dark', icon: <ThemeIcon mode="dark" />, title: t('layout.themeDark') },
          ]}
        />
        <Dropdown menu={langMenu} placement="bottomRight">
          <Button type="text" size="small" icon={<GlobalOutlined />} style={{ color: 'var(--text-secondary)' }}>
            {locale === 'zh' ? '中文' : 'EN'}
          </Button>
        </Dropdown>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 400, width: '100%', padding: '0 24px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #0078D4, #50A0E0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 20, color: '#fff',
          boxShadow: '0 4px 16px rgba(0,120,212,0.3)',
        }}>
          OF
        </div>
        <Title level={2} style={{ color: 'var(--text-primary)', marginBottom: 4 }}>{t('login.title')}</Title>
        <Text style={{ color: 'var(--text-tertiary)', display: 'block', marginBottom: 28 }}>
          {t('login.subtitle')}
        </Text>
        <Card style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--card-border)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} centered items={[
            {
              key: 'login',
              label: t('login.loginTab'),
              children: (
                <Form onFinish={onLogin} layout="vertical" size="large">
                  <Form.Item name="username" rules={[{ required: true, message: t('login.usernameRequired') }]}>
                    <Input prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder={t('login.usernamePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: t('login.passwordRequired') }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder={t('login.passwordPlaceholder')} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 42 }}>{t('login.loginButton')}</Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'register',
              label: t('login.registerTab'),
              children: (
                <Form onFinish={onRegister} layout="vertical" size="large">
                  <Form.Item name="username" rules={[{ required: true, message: t('login.usernameRequired') }]}>
                    <Input prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder={t('login.usernamePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="email" rules={[{ required: true, type: 'email', message: t('login.emailRequired') }]}>
                    <Input prefix={<MailOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder={t('login.emailPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, min: 6, message: t('login.passwordMin') }]}>
                    <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />} placeholder={t('login.passwordPlaceholder')} />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 42 }}>{t('login.registerButton')}</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]} />
        </Card>
      </div>
    </div>
  );
}
