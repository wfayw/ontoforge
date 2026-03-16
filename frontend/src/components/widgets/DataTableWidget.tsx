import { memo, useMemo } from 'react';
import { Table, Empty, Skeleton, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

interface DataItem {
  id: string;
  display_name: string;
  properties: Record<string, unknown>;
  created_at?: string;
}

interface ConditionalFormat {
  field: string;
  operator: '>=' | '>' | '<=' | '<' | '==' | '!=';
  value: number;
  color: string;
}

interface Props {
  items: DataItem[];
  loading?: boolean;
  pageSize?: number;
  maxColumns?: number;
  onRowClick?: (item: DataItem) => void;
  conditionalFormats?: ConditionalFormat[];
  compact?: boolean;
}

function matchCondition(val: unknown, cf: ConditionalFormat): boolean {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return false;
  switch (cf.operator) {
    case '>=': return num >= cf.value;
    case '>': return num > cf.value;
    case '<=': return num <= cf.value;
    case '<': return num < cf.value;
    case '==': return num === cf.value;
    case '!=': return num !== cf.value;
    default: return false;
  }
}

const DataTableWidget = memo(function DataTableWidget({
  items,
  loading = false,
  pageSize = 8,
  maxColumns = 6,
  onRowClick,
  conditionalFormats = [],
  compact = false,
}: Props) {
  const columns = useMemo<ColumnsType<DataItem>>(() => {
    if (!items.length) return [];

    const allKeys = new Set<string>();
    items.forEach(item => Object.keys(item.properties || {}).forEach(k => allKeys.add(k)));

    const propCols: ColumnsType<DataItem> = Array.from(allKeys).slice(0, maxColumns).map(k => ({
      title: k,
      key: k,
      width: 120,
      ellipsis: true,
      sorter: (a: DataItem, b: DataItem) => {
        const va = a.properties?.[k];
        const vb = b.properties?.[k];
        if (typeof va === 'number' && typeof vb === 'number') return va - vb;
        return String(va ?? '').localeCompare(String(vb ?? ''));
      },
      render: (_: unknown, record: DataItem) => {
        const v = record.properties?.[k];
        if (v === null || v === undefined) return <span style={{ color: 'var(--text-quaternary)' }}>—</span>;

        const cf = conditionalFormats.find(c => c.field === k && matchCondition(v, c));
        if (cf) {
          return <Tag color={cf.color} style={{ margin: 0 }}>{String(v)}</Tag>;
        }
        return String(v);
      },
    }));

    return [
      {
        title: 'Name',
        dataIndex: 'display_name',
        key: 'name',
        width: 140,
        ellipsis: true,
        fixed: 'left' as const,
        render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
      },
      ...propCols,
    ];
  }, [items, maxColumns, conditionalFormats]);

  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (!items.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto', paddingTop: 24 }} />;
  }

  return (
    <Table<DataItem>
      dataSource={items}
      columns={columns}
      rowKey="id"
      size="small"
      pagination={{ pageSize, size: 'small', showSizeChanger: false, showTotal: (total) => `${total}` }}
      scroll={{ x: 'max-content' }}
      style={{ fontSize: compact ? 11 : 12 }}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record),
        style: { cursor: onRowClick ? 'pointer' : 'default' },
      })}
    />
  );
});

export default DataTableWidget;
