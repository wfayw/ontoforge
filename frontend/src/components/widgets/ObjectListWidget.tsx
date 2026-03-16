import { memo } from 'react';
import { List, Typography, Empty, Skeleton, Tag, Badge } from 'antd';
import { RightOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ObjectItem {
  id: string;
  display_name: string;
  properties: Record<string, unknown>;
}

interface Props {
  items: ObjectItem[];
  loading?: boolean;
  selectedId?: string;
  onSelect?: (item: ObjectItem) => void;
  highlightProperties?: string[];
  compact?: boolean;
}

const ObjectListWidget = memo(function ObjectListWidget({
  items,
  loading = false,
  selectedId,
  onSelect,
  highlightProperties = [],
  compact = false,
}: Props) {
  if (loading) {
    return (
      <div style={{ padding: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} active avatar={false} paragraph={{ rows: 1 }} style={{ marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto', paddingTop: 16 }} />;
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <List
        dataSource={items}
        size="small"
        split
        renderItem={(item) => {
          const isSelected = item.id === selectedId;
          return (
            <List.Item
              onClick={() => onSelect?.(item)}
              style={{
                cursor: onSelect ? 'pointer' : 'default',
                padding: compact ? '6px 12px' : '8px 12px',
                background: isSelected ? 'var(--bg-active)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text strong style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.display_name || item.id.slice(0, 8)}
                  </Text>
                  {onSelect && <RightOutlined style={{ fontSize: 10, color: 'var(--text-quaternary)' }} />}
                </div>
                {highlightProperties.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {highlightProperties.map(prop => {
                      const val = item.properties[prop];
                      if (val === null || val === undefined) return null;
                      return (
                        <Tag key={prop} style={{ margin: 0, fontSize: 11 }}>
                          {prop}: {String(val)}
                        </Tag>
                      );
                    })}
                  </div>
                )}
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
});

export default ObjectListWidget;
