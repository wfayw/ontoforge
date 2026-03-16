import { memo, useMemo } from 'react';
import { Select, Skeleton, Typography } from 'antd';
import { FilterOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  allLabel?: string;
  placeholder?: string;
}

const FilterWidget = memo(function FilterWidget({
  title,
  options,
  value,
  onChange,
  loading = false,
  allLabel = 'All',
  placeholder,
}: Props) {
  const selectOptions = useMemo(
    () => [
      { label: allLabel, value: '' },
      ...options.map(o => ({ label: o, value: o })),
    ],
    [options, allLabel],
  );

  if (loading) {
    return (
      <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} />
        <Skeleton.Input active size="large" style={{ width: '100%' }} />
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px 16px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <FilterOutlined style={{ fontSize: 12, color: 'var(--text-tertiary)' }} />
        <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{title}</Text>
      </div>
      <Select
        value={value || ''}
        onChange={onChange}
        options={selectOptions}
        style={{ width: '100%' }}
        placeholder={placeholder}
        showSearch
        filterOption={(input, option) =>
          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
      />
      {value && (
        <Text style={{ fontSize: 11, color: 'var(--primary)' }}>
          {value}
        </Text>
      )}
    </div>
  );
});

export default FilterWidget;
