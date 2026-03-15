import { ReactNode } from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 'var(--space-md)',
      gap: 'var(--space-md)',
    }}>
      <div style={{ minWidth: 0 }}>
        <Title level={4} style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{title}</Title>
        {subtitle && <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{subtitle}</Text>}
      </div>
      {actions && <div style={{ flexShrink: 0, display: 'flex', gap: 'var(--space-sm)' }}>{actions}</div>}
    </div>
  );
}
