import { useEffect, useRef, useState, memo } from 'react';
import { Typography, Skeleton } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  title: string;
  value: number | null | undefined;
  precision?: number;
  loading?: boolean;
  prefix?: string;
  suffix?: string;
  trend?: number;
  color?: string;
  sparkline?: number[];
  onClick?: () => void;
  animationDuration?: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function AnimatedNumber({ value, precision = 0, duration = 800, prefix = '', suffix = '' }: {
  value: number; precision?: number; duration?: number; prefix?: string; suffix?: string;
}) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const delta = value - start;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + delta * eased;
      setDisplayed(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = precision > 0
    ? displayed.toLocaleString(undefined, { minimumFractionDigits: precision, maximumFractionDigits: precision })
    : Math.round(displayed).toLocaleString();

  return <>{prefix}{formatted}{suffix}</>;
}

function MiniSparkline({ data, color = '#1890ff' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const h = 28;
  const w = 80;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} style={{ display: 'block', margin: '4px auto 0' }}>
      <polyline points={areaPoints} fill={color} fillOpacity={0.08} stroke="none" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const METRIC_COLORS: Record<string, string> = {
  count: '#1890ff',
  sum: '#52c41a',
  avg: '#fa8c16',
  min: '#13c2c2',
  max: '#722ed1',
};

const StatCardWidget = memo(function StatCardWidget({
  title,
  value,
  precision = 0,
  loading = false,
  prefix = '',
  suffix = '',
  trend,
  color,
  sparkline,
  onClick,
  animationDuration = 800,
}: Props) {
  const effectiveColor = color || METRIC_COLORS.count;

  if (loading) {
    return (
      <div className="stat-card-widget" style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} />
        <Skeleton.Input active size="large" style={{ width: 120 }} />
      </div>
    );
  }

  return (
    <div
      className="stat-card-widget"
      onClick={onClick}
      style={{
        padding: '12px 16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
    >
      <Text style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, lineHeight: 1.2 }}>{title}</Text>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: effectiveColor, lineHeight: 1.1 }}>
          <AnimatedNumber value={value ?? 0} precision={precision} duration={animationDuration} prefix={prefix} suffix={suffix} />
        </span>
        {trend !== undefined && trend !== 0 && (
          <span style={{
            fontSize: 12,
            color: trend > 0 ? '#52c41a' : '#ff4d4f',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}>
            {trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 1 && (
        <MiniSparkline data={sparkline} color={effectiveColor} />
      )}
    </div>
  );
});

export default StatCardWidget;
