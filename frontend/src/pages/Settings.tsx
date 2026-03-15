import { Card, Descriptions, Tag } from 'antd';
import { useAuthStore } from '@/stores/authStore';
import { useI18n } from '@/i18n';
import PageHeader from '@/components/PageHeader';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { t } = useI18n();

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Card title={<span style={{ color: 'var(--text-primary)' }}>{t('settings.userProfile')}</span>} style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)', marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('settings.username')}>{user?.username}</Descriptions.Item>
          <Descriptions.Item label={t('settings.email')}>{user?.email}</Descriptions.Item>
          <Descriptions.Item label={t('settings.displayName')}>{user?.display_name}</Descriptions.Item>
          <Descriptions.Item label={t('settings.role')}><Tag color="blue">{user?.role}</Tag></Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<span style={{ color: 'var(--text-primary)' }}>{t('settings.platformInfo')}</span>} style={{ background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label={t('settings.platform')}>OntoForge</Descriptions.Item>
          <Descriptions.Item label={t('settings.version')}>0.1.0 MVP</Descriptions.Item>
          <Descriptions.Item label={t('settings.backend')}>FastAPI + SQLite</Descriptions.Item>
          <Descriptions.Item label={t('settings.frontend')}>React + Ant Design</Descriptions.Item>
          <Descriptions.Item label={t('settings.aiIntegration')}>OpenAI-compatible API</Descriptions.Item>
          <Descriptions.Item label={t('settings.license')}>Open Source</Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
}
