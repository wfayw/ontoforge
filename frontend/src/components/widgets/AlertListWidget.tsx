import { memo } from 'react';
import { List, Tag, Typography, Empty, Skeleton, Badge } from 'antd';
import { BellOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface AlertItem {
  id: string;
  severity: string;
  message: string;
  is_read: boolean;
  object_id: string;
  created_at: string;
}

interface Props {
  alerts: AlertItem[];
  unread: number;
  loading?: boolean;
  onAlertClick?: (alert: AlertItem) => void;
  compact?: boolean;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  critical: { color: 'red', icon: <ExclamationCircleOutlined /> },
  error: { color: 'red', icon: <ExclamationCircleOutlined /> },
  warning: { color: 'orange', icon: <WarningOutlined /> },
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
};

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return dateStr;
  }
}

const AlertListWidget = memo(function AlertListWidget({
  alerts,
  unread,
  loading = false,
  onAlertClick,
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} active paragraph={{ rows: 1 }} style={{ marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (!alerts.length) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No alerts" />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {unread > 0 && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge count={unread} size="small">
            <BellOutlined style={{ fontSize: 14, color: 'var(--text-secondary)' }} />
          </Badge>
          <Text style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{unread} unread</Text>
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <List
          dataSource={alerts}
          size="small"
          split
          renderItem={(alert) => {
            const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.warning;
            return (
              <List.Item
                onClick={() => onAlertClick?.(alert)}
                style={{
                  cursor: onAlertClick ? 'pointer' : 'default',
                  padding: compact ? '4px 12px' : '6px 12px',
                  opacity: alert.is_read ? 0.6 : 1,
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-start' }}>
                  <span style={{ color: cfg.color, fontSize: 14, marginTop: 2 }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Tag color={cfg.color} style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
                        {alert.severity.toUpperCase()}
                      </Tag>
                      <Text style={{ fontSize: 10, color: 'var(--text-quaternary)' }}>
                        {formatTime(alert.created_at)}
                      </Text>
                      {!alert.is_read && (
                        <Badge status="processing" />
                      )}
                    </div>
                    <Text style={{
                      fontSize: 12, color: 'var(--text-primary)',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {alert.message}
                    </Text>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      </div>
    </div>
  );
});

export default AlertListWidget;
