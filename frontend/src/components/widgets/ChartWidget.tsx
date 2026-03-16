import { memo, useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Empty, Segmented, Skeleton } from 'antd';
import { BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';

interface DataPoint {
  key: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  chartType?: 'bar' | 'line' | 'pie';
  loading?: boolean;
  switchable?: boolean;
  title?: string;
  height?: number | string;
  colors?: string[];
  onSegmentClick?: (key: string, value: number) => void;
}

const DEFAULT_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1',
  '#13c2c2', '#f5222d', '#fa8c16', '#2f54eb', '#a0d911',
];

const CHART_ICONS = {
  bar: <BarChartOutlined />,
  line: <LineChartOutlined />,
  pie: <PieChartOutlined />,
};

const ChartWidget = memo(function ChartWidget({
  data,
  chartType: initialType = 'bar',
  loading = false,
  switchable = false,
  height = '100%',
  colors = DEFAULT_COLORS,
  onSegmentClick,
}: Props) {
  const [currentType, setCurrentType] = useState(initialType);

  const totalValue = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (loading) {
    return (
      <div style={{ padding: 16, height, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <Skeleton.Node active style={{ width: '100%', height: 160 }} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: 'auto' }} />;
  }

  const handleClick = (entry: DataPoint) => {
    if (onSegmentClick) onSegmentClick(entry.key, entry.value);
  };

  const customTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: DataPoint }> }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0].payload;
    const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0';
    return (
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '8px 12px', boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{item.key}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
          {item.value.toLocaleString()} ({pct}%)
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (currentType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="key"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="70%"
                paddingAngle={2}
                onClick={(_, idx) => handleClick(data[idx])}
                style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                label={({ key, percent }) => `${key} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip content={customTooltip as never} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {totalValue > 0 && (
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
                  style={{ fontSize: 18, fontWeight: 700, fill: 'var(--text-primary)' }}>
                  {totalValue.toLocaleString()}
                </text>
              )}
            </PieChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="key" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <Tooltip content={customTooltip as never} />
              <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2.5}
                dot={{ r: 3, fill: colors[0] }} activeDot={{ r: 5, stroke: colors[0], strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        );
      default:
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="key" tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} />
              <Tooltip content={customTooltip as never} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}
                onClick={(_, idx) => handleClick(data[idx])}
                style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}>
                {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {switchable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0' }}>
          <Segmented
            size="small"
            value={currentType}
            onChange={(v) => setCurrentType(v as 'bar' | 'line' | 'pie')}
            options={[
              { value: 'bar', icon: CHART_ICONS.bar },
              { value: 'line', icon: CHART_ICONS.line },
              { value: 'pie', icon: CHART_ICONS.pie },
            ]}
          />
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {renderChart()}
      </div>
    </div>
  );
});

export default ChartWidget;
