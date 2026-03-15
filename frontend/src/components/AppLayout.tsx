import { ReactNode, CSSProperties, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Avatar, Dropdown, Space, Button, Segmented, Badge, Drawer, List, Tag, Empty } from 'antd';
import {
  DashboardOutlined,
  ApartmentOutlined,
  SearchOutlined,
  ApiOutlined,
  RobotOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  GlobalOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/authStore';
import { useI18n, type Locale } from '@/i18n';
import { useTheme, type ThemeMode } from '@/theme';
import { alertApi } from '@/services/api';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

const menuIconMap: Record<string, React.ReactNode> = {
  '/': <DashboardOutlined />,
  '/ontology': <ApartmentOutlined />,
  '/explorer': <SearchOutlined />,
  '/pipelines': <ApiOutlined />,
  '/aip': <RobotOutlined />,
  '/settings': <SettingOutlined />,
};

function ThemeIcon({ mode }: { mode: 'system' | 'light' | 'dark' }) {
  const size = 14;
  if (mode === 'light') return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>;
  if (mode === 'dark') return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M6.2 1A7 7 0 0015 9.8 5.5 5.5 0 016.2 1z"/></svg>;
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="3" width="12" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/><line x1="5" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.2"/></svg>;
}

interface AlertItem {
  id: string;
  object_id: string;
  severity: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode, isDark } = useTheme();

  const [unreadCount, setUnreadCount] = useState(0);
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const fetchUnread = useCallback(() => {
    alertApi.unreadCount().then(r => setUnreadCount(r.data.unread || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    return () => clearInterval(timer);
  }, [fetchUnread]);

  const openAlerts = async () => {
    setAlertDrawerOpen(true);
    try {
      const { data } = await alertApi.list({ page_size: 50 });
      setAlerts(data);
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    await alertApi.markAllRead();
    setUnreadCount(0);
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
  };

  const menuItems = [
    { key: '/', icon: menuIconMap['/'], label: t('menu.dashboard') },
    { key: '/ontology', icon: menuIconMap['/ontology'], label: t('menu.ontologyBuilder') },
    { key: '/explorer', icon: menuIconMap['/explorer'], label: t('menu.objectExplorer') },
    { key: '/pipelines', icon: menuIconMap['/pipelines'], label: t('menu.pipelineBuilder') },
    { key: '/aip', icon: menuIconMap['/aip'], label: t('menu.aipStudio') },
    { key: '/settings', icon: menuIconMap['/settings'], label: t('menu.settings') },
  ];

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: user?.display_name || user?.username },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: t('layout.logout'), danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') {
        logout();
        navigate('/login');
      }
    },
  };

  const langMenu = {
    items: [
      { key: 'zh', label: '中文' },
      { key: 'en', label: 'English' },
    ],
    selectedKeys: [locale],
    onClick: ({ key }: { key: string }) => setLocale(key as Locale),
  };

  const siderStyle: CSSProperties = {
    background: 'var(--bg-sidebar)',
    transition: 'background var(--transition)',
  };

  const headerStyle: CSSProperties = {
    background: 'var(--bg-header)',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-subtle)',
    height: 48,
    gap: 8,
    transition: 'background var(--transition)',
  };

  const contentStyle: CSSProperties = {
    padding: 24,
    background: 'var(--bg-body)',
    overflow: 'auto',
    transition: 'background var(--transition)',
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={siderStyle} theme={isDark ? 'dark' : 'light'}>
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'linear-gradient(135deg, #0078D4, #50A0E0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0,
          }}>
            OF
          </div>
          <div style={{ minWidth: 0 }}>
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 14, display: 'block', lineHeight: 1.3 }}>OntoForge</Text>
            <Text style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{t('layout.subtitle')}</Text>
          </div>
        </div>
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 'none', marginTop: 4, padding: '0 4px' }}
        />
      </Sider>
      <Layout>
        <Header style={headerStyle}>
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
          <Badge count={unreadCount} size="small" offset={[-4, 4]}>
            <Button type="text" size="small" icon={<BellOutlined />} onClick={openAlerts} style={{ color: 'var(--text-secondary)' }} />
          </Badge>
          <Dropdown menu={langMenu} placement="bottomRight">
            <Button type="text" size="small" icon={<GlobalOutlined />} style={{ color: 'var(--text-secondary)' }}>
              {locale === 'zh' ? '中文' : 'EN'}
            </Button>
          </Dropdown>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size={28} style={{ background: '#0078D4', fontSize: 12 }}>
                {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
              </Avatar>
              <Text style={{ color: 'var(--text-primary)', fontSize: 13 }}>{user?.display_name || user?.username}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={contentStyle}>
          {children}
        </Content>
      </Layout>

      <Drawer
        title={<Space>{t('alerts.title')} {unreadCount > 0 && <Tag color="red">{unreadCount} {t('alerts.unread')}</Tag>}</Space>}
        open={alertDrawerOpen}
        onClose={() => setAlertDrawerOpen(false)}
        width={400}
        extra={unreadCount > 0 ? <Button size="small" onClick={markAllRead}>{t('alerts.markAllRead')}</Button> : null}
      >
        {alerts.length === 0 ? (
          <Empty description={t('alerts.noAlerts')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={alerts}
            renderItem={(a) => {
              const severityColor = a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'orange' : 'blue';
              return (
                <List.Item
                  style={{ opacity: a.is_read ? 0.6 : 1, cursor: 'pointer' }}
                  onClick={() => { setAlertDrawerOpen(false); navigate(`/explorer?highlight=${a.object_id}`); }}
                >
                  <List.Item.Meta
                    avatar={<Tag color={severityColor}>{a.severity}</Tag>}
                    title={<span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: a.is_read ? 400 : 600 }}>{a.message}</span>}
                    description={<span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{new Date(a.created_at).toLocaleString()}</span>}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Drawer>
    </Layout>
  );
}
