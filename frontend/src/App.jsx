import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const COLORS = {
  primary: '#3B5998',
  secondary: '#6B8DD6',
  navy: '#1a365d',
  lightBlue: '#93B5E1',
  background: '#f8fafc',
  text: '#1a365d',
  muted: '#64748b',
  positive: '#16a34a',
  negative: '#dc2626',
  white: '#ffffff',
};

const REGION_COLORS = { West: '#3B5998', South: '#6B8DD6', East: '#93B5E1', Central: '#1a365d' };
const SEGMENT_COLORS = { Consumer: '#93B5E1', Corporate: '#6B8DD6', 'Home Office': '#3B5998' };
const SHIP_MODE_COLORS = { 'Standard Class': '#3B5998', 'Second Class': '#6B8DD6', 'First Class': '#93B5E1', 'Same Day': '#1a365d' };


const ChartIconClock = ({ size = 18, color = COLORS.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12,7 12,12 16,15" />
  </svg>
);

const ChartIconPerson = ({ size = 18, color = COLORS.muted }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="10" cy="8" r="4" />
  </svg>
);

const AVAILABLE_MONTHS = Array.from({ length: 48 }, (_, i) => {
  const year = 2023 + Math.floor(i / 12);
  const month = String((i % 12) + 1).padStart(2, '0');
  return `${year}-${month}`;
});

const N = (value) => (value == null ? 0 : Number(value));
const pctChange = (current, prior) => (prior === 0 ? 0 : ((current - prior) / prior) * 100);
const formatCurrency = (value) => value >= 1000000 ? `$${(value / 1000000).toFixed(2)}M` : value >= 1000 ? `$${(value / 1000).toFixed(1)}K` : `$${value.toFixed(0)}`;
const formatNumber = (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString();
const formatPercent = (value) => `${N(value).toFixed(1)}%`;

function Card({ children, style }) {
  return <div style={{ background: COLORS.white, borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.08)', ...style }}>{children}</div>;
}

function Sparkline({ data, dataKey, height = 40 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={COLORS.primary} strokeWidth={2} fill={`url(#spark-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KPICard({ title, currentValue, priorValue, sparklineData, sparklineKey, format = 'currency' }) {
  const delta = pctChange(N(currentValue), N(priorValue));
  const isPositive = delta >= 0;
  const display = format === 'currency' ? formatCurrency : format === 'percent' ? formatPercent : formatNumber;

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.navy, marginTop: 6 }}>{display(N(currentValue))}</div>
      <div style={{ height: 44, margin: '8px 0' }}>
        <Sparkline data={sparklineData} dataKey={sparklineKey} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: COLORS.muted }}>Last: <span style={{ color: COLORS.text, fontWeight: 700 }}>{display(N(priorValue))}</span></div>
        <div style={{ padding: '3px 8px', borderRadius: 999, background: isPositive ? '#dcfce7' : '#fee2e2', color: isPositive ? COLORS.positive : COLORS.negative, fontSize: 11, fontWeight: 700 }}>
          {isPositive ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
        </div>
      </div>
    </Card>
  );
}

function GaugeChart({ value, target, maxValue = 5000 }) {
  const percentage = Math.min(N(value) / maxValue, 1);
  const targetPercentage = Math.min(N(target) / maxValue, 1);
  const cx = 152, cy = 132, outerRadius = 112, innerRadius = 78;
  const polarToCartesian = (angleDeg, radius) => ({ x: cx + radius * Math.cos((angleDeg * Math.PI) / 180), y: cy - radius * Math.sin((angleDeg * Math.PI) / 180) });
  const describeArc = (startAngle, endAngle, outerR, innerR) => {
    const startOuter = polarToCartesian(startAngle, outerR);
    const endOuter = polarToCartesian(endAngle, outerR);
    const startInner = polarToCartesian(endAngle, innerR);
    const endInner = polarToCartesian(startAngle, innerR);
    return `M ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${Math.abs(endAngle - startAngle) > 180 ? 1 : 0} 1 ${endOuter.x} ${endOuter.y} L ${startInner.x} ${startInner.y} A ${innerR} ${innerR} 0 ${Math.abs(endAngle - startAngle) > 180 ? 1 : 0} 0 ${endInner.x} ${endInner.y} Z`;
  };
  const valueAngle = 180 - percentage * 180;
  const targetAngle = 180 - targetPercentage * 180;
  const needleEnd = polarToCartesian(valueAngle, innerRadius - 15);
  const targetPos = polarToCartesian(targetAngle, outerRadius + 12);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 304 190" style={{ width: '100%', maxWidth: 336 }}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="50%" stopColor="#6B8DD6" />
            <stop offset="100%" stopColor="#3B5998" />
          </linearGradient>
        </defs>
        <path d={describeArc(180, 0, outerRadius, innerRadius)} fill="#e2e8f0" />
        <path d={describeArc(180, valueAngle, outerRadius, innerRadius)} fill="url(#gaugeGradient)" />
        <circle cx={targetPos.x} cy={targetPos.y} r="6" fill={COLORS.negative} />
        <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke={COLORS.navy} strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="10" fill={COLORS.navy} />
        <circle cx={cx} cy={cy} r="5" fill="white" />
        <text x={cx} y={cy + 30} fontSize="24" fontWeight="700" fill={COLORS.navy} textAnchor="middle">${N(value).toFixed(0)}</text>
        <text x={cx} y={cy + 48} fontSize="11" fill={COLORS.muted} textAnchor="middle">Target: ${N(target).toFixed(0)}</text>
      </svg>
      <div style={{ marginTop: 4, padding: '6px 16px', borderRadius: 14, background: N(value) >= N(target) ? '#dcfce7' : '#fee2e2', color: N(value) >= N(target) ? COLORS.positive : COLORS.negative, fontSize: 12, fontWeight: 700 }}>
        {N(value) >= N(target) ? 'Target Achieved' : 'Target Not Achieved'}
      </div>
    </div>
  );
}

function CircularVoronoiTreemap({ data, size = 260 }) {
  const cx = size / 2, cy = size / 2, radius = size / 2 - 5;
  const colorPalette = ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#7c3aed', '#8b5cf6', '#a78bfa', '#93c5fd', '#c4b5fd', '#bfdbfe', '#ddd6fe', '#e0e7ff'];
  const cells = useMemo(() => {
    const sorted = [...data].sort((a, b) => N(b.value) - N(a.value));
    const total = sorted.reduce((sum, d) => sum + N(d.value), 0) || 1;
    let currentAngle = -Math.PI / 2;
    return sorted.map((item, index) => {
      const proportion = N(item.value) / total;
      const arcAngle = proportion * Math.PI * 2;
      const midAngle = currentAngle + arcAngle / 2;
      const innerR = radius * 0.15;
      const outerR = radius * (0.6 + proportion * 0.8);
      const points = [];
      for (let j = 0; j <= 8; j += 1) {
        const t = j / 8;
        const angle = currentAngle + t * arcAngle;
        const noise = Math.sin(index * 7 + j * 3) * 0.08;
        points.push({ x: cx + Math.cos(angle) * outerR * (1 + noise), y: cy + Math.sin(angle) * outerR * (1 + noise) });
      }
      for (let j = 8; j >= 0; j -= 1) {
        const t = j / 8;
        const angle = currentAngle + t * arcAngle;
        const noise = Math.sin(index * 5 + j * 2) * 0.1;
        points.push({ x: cx + Math.cos(angle) * innerR * (1 + noise), y: cy + Math.sin(angle) * innerR * (1 + noise) });
      }
      let path = `M ${points[0].x} ${points[0].y}`;
      for (let j = 1; j < points.length; j += 1) {
        const prev = points[j - 1];
        const curr = points[j];
        path += ` Q ${prev.x} ${prev.y} ${(prev.x + curr.x) / 2} ${(prev.y + curr.y) / 2}`;
      }
      path += ' Z';
      const cell = {
        ...item,
        path,
        labelX: cx + Math.cos(midAngle) * ((innerR + outerR) / 2),
        labelY: cy + Math.sin(midAngle) * ((innerR + outerR) / 2),
        color: colorPalette[index % colorPalette.length],
        proportion,
      };
      currentAngle += arcAngle;
      return cell;
    });
  }, [data, size]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs><clipPath id="circleClip"><circle cx={cx} cy={cy} r={radius} /></clipPath></defs>
      <g clipPath="url(#circleClip)">
        {cells.map((cell) => (
          <g key={cell.name}>
            <path d={cell.path} fill={cell.color} stroke="#ffffff" strokeWidth={2} opacity={0.9} />
            {cell.proportion > 0.04 && (
              <text x={cell.labelX} y={cell.labelY} textAnchor="middle" dominantBaseline="middle" fill="#ffffff" fontSize={cell.proportion > 0.12 ? 10 : 8} fontWeight="500">
                {cell.name.length > 10 ? `${cell.name.slice(0, 8)}...` : cell.name}
              </text>
            )}
          </g>
        ))}
      </g>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={2} />
    </svg>
  );
}

function ChordDiagram({ data, size = 240 }) {
  const cx = size / 2, cy = size / 2, outerRadius = size / 2 - 30, innerRadius = outerRadius - 22;
  const segments = ['Consumer', 'Corporate', 'Home Office'];
  const shipModes = ['Standard Class', 'Second Class', 'First Class', 'Same Day'];

  const arcs = useMemo(() => {
    const totalOrders = data.reduce((sum, d) => sum + N(d.orders), 0) || 1;
    const segmentTotals = Object.fromEntries(segments.map((s) => [s, 0]));
    const shipModeTotals = Object.fromEntries(shipModes.map((s) => [s, 0]));
    data.forEach((d) => {
      if (segmentTotals[d.segment] != null) segmentTotals[d.segment] += N(d.orders);
      if (shipModeTotals[d.shipMode] != null) shipModeTotals[d.shipMode] += N(d.orders);
    });
    const leftArcs = [];
    const rightArcs = [];
    let leftAngle = Math.PI * 0.55;
    let rightAngle = -Math.PI * 0.45;
    const gap = 0.12;
    const leftTotal = Math.PI * 0.85;
    const rightTotal = Math.PI * 0.85;
    segments.forEach((segment) => {
      const arcAngle = (segmentTotals[segment] / totalOrders) * leftTotal;
      leftArcs.push({ name: segment, startAngle: leftAngle, endAngle: leftAngle + arcAngle, midAngle: leftAngle + arcAngle / 2, color: SEGMENT_COLORS[segment] });
      leftAngle += arcAngle + gap;
    });
    shipModes.forEach((mode) => {
      const arcAngle = (shipModeTotals[mode] / totalOrders) * rightTotal;
      rightArcs.push({ name: mode, startAngle: rightAngle, endAngle: rightAngle + arcAngle, midAngle: rightAngle + arcAngle / 2, color: SHIP_MODE_COLORS[mode] });
      rightAngle += arcAngle + gap;
    });
    return { leftArcs, rightArcs };
  }, [data]);

  const describeArc = (startAngle, endAngle, radius) => {
    const start = { x: cx + Math.cos(startAngle) * radius, y: cy + Math.sin(startAngle) * radius };
    const end = { x: cx + Math.cos(endAngle) * radius, y: cy + Math.sin(endAngle) * radius };
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${endAngle - startAngle > Math.PI ? 1 : 0} 1 ${end.x} ${end.y}`;
  };

  const chords = useMemo(() => data.map((d) => {
    const leftArc = arcs.leftArcs.find((a) => a.name === d.segment);
    const rightArc = arcs.rightArcs.find((a) => a.name === d.shipMode);
    if (!leftArc || !rightArc) return null;
    const x1 = cx + Math.cos(leftArc.midAngle) * innerRadius;
    const y1 = cy + Math.sin(leftArc.midAngle) * innerRadius;
    const x2 = cx + Math.cos(rightArc.midAngle) * innerRadius;
    const y2 = cy + Math.sin(rightArc.midAngle) * innerRadius;
    return {
      ...d,
      path: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
      color: leftArc.color,
      opacity: 0.25 + (N(d.orders) / 25) * 0.5,
    };
  }).filter(Boolean), [data, arcs, innerRadius]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {chords.map((chord, index) => <path key={index} d={chord.path} fill="none" stroke={chord.color} strokeWidth={Math.max(2, N(chord.orders) / 2)} opacity={Math.min(chord.opacity, 1)} strokeLinecap="round" />)}
      {arcs.leftArcs.map((arc) => (
        <g key={arc.name}>
          <path d={describeArc(arc.startAngle, arc.endAngle, outerRadius)} fill="none" stroke={arc.color} strokeWidth={20} strokeLinecap="round" />
          <text x={cx + Math.cos(arc.midAngle) * (outerRadius + 20)} y={cy + Math.sin(arc.midAngle) * (outerRadius + 20)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill={COLORS.muted}>{arc.name}</text>
        </g>
      ))}
      {arcs.rightArcs.map((arc) => (
        <g key={arc.name}>
          <path d={describeArc(arc.startAngle, arc.endAngle, outerRadius)} fill="none" stroke={arc.color} strokeWidth={20} strokeLinecap="round" />
          <text x={cx + Math.cos(arc.midAngle) * (outerRadius + 20)} y={cy + Math.sin(arc.midAngle) * (outerRadius + 20)} textAnchor="start" dominantBaseline="middle" fontSize="8" fill={COLORS.muted}>{arc.name.replace(' Class', '')}</text>
        </g>
      ))}
    </svg>
  );
}

function ScoreSlider({ label, score, maxScore = 5 }) {
  const percentage = (N(score) / maxScore) * 100;
  const wavePoints = [];
  for (let i = 0; i <= 100; i += 2) wavePoints.push(`${i * 2},${12 + Math.sin(i * 0.3) * 4}`);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.navy }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: COLORS.primary }}>{N(score).toFixed(1)}<span style={{ fontSize: 12, color: COLORS.muted }}>/5</span></span>
      </div>
      <div style={{ position: 'relative', height: 24 }}>
        <svg width="100%" height="24" viewBox="0 0 200 24" preserveAspectRatio="none">
          <polyline points={wavePoints.join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="2" />
          <polyline points={wavePoints.slice(0, Math.floor(wavePoints.length * percentage / 100)).join(' ')} fill="none" stroke={COLORS.primary} strokeWidth="2" />
        </svg>
        <div style={{ position: 'absolute', left: `${percentage}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 12, height: 12, borderRadius: '50%', background: COLORS.primary, border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  );
}

function OrderBarsStacked({ segmentData, shipModeData }) {
  const maxSegment = Math.max(...segmentData.map((d) => N(d.orders)), 1);
  const maxShip = Math.max(...shipModeData.map((d) => N(d.orders)), 1);
  const barBlock = (title, rows, colors, maxValue) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, marginBottom: 10 }}>{title}</div>
      {rows.map((item) => (
        <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 96, textAlign: 'right', fontSize: 11, color: COLORS.muted }}>{item.name}</div>
          <div style={{ flex: 1, height: 20, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ width: `${(N(item.orders) / maxValue) * 100}%`, height: '100%', background: colors[item.name] ?? COLORS.primary }} />
          </div>
          <div style={{ width: 36, fontSize: 12, fontWeight: 800, color: COLORS.navy }}>{N(item.orders)}</div>
        </div>
      ))}
    </div>
  );
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>{barBlock('Orders by Segment', segmentData, SEGMENT_COLORS, maxSegment)}{barBlock('Orders by Ship Mode', shipModeData, SHIP_MODE_COLORS, maxShip)}</div>;
}

function SubCategoryKPICard({ metrics, trendData }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 18, padding: 28, border: '1px solid #dbe5f2', minHeight: 520, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: COLORS.primary }}>Appliances</span>
        <span style={{ color: COLORS.muted }}>◌</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: COLORS.muted }}>Sales</span><span style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>{formatCurrency(N(metrics.sales))}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: COLORS.muted }}>Profit</span><span style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>{formatCurrency(N(metrics.profit))} <span style={{ fontSize: 10, color: COLORS.muted }}>({N(metrics.profitMargin).toFixed(1)}%)</span></span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: COLORS.muted }}>Orders</span><span style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy }}>{formatNumber(N(metrics.orders))}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: COLORS.muted }}>Customers</span><span style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy }}>{formatNumber(N(metrics.customers))}</span></div>
      </div>
      <div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>Sales Trend</div>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="appliancesTrend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="sales" stroke={COLORS.primary} strokeWidth={2} fill="url(#appliancesTrend)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SubCategoryLineChart({ data, compact = false }) {
  const otherSubCategories = ['Accessories', 'Binders', 'Bookcases', 'Chairs', 'Copiers', 'Furnishings', 'Machines', 'Paper', 'Phones', 'Storage', 'Tables'];
  return (
    <div style={{ position: 'relative', height: compact ? 472 : '100%', minHeight: compact ? 472 : 280, overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}>
        <defs>
          <pattern id="wavePattern" x="0" y="0" width="40" height="100%" patternUnits="userSpaceOnUse">
            <path d="M0,15 Q10,0 20,15 T40,15" fill="none" stroke={COLORS.secondary} strokeWidth="1" opacity="0.5" />
            <path d="M0,35 Q10,20 20,35 T40,35" fill="none" stroke={COLORS.secondary} strokeWidth="1" opacity="0.4" />
            <path d="M0,55 Q10,40 20,55 T40,55" fill="none" stroke={COLORS.secondary} strokeWidth="1" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wavePattern)" />
      </svg>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 28, right: 22, left: 10, bottom: 32 }}>
          <XAxis dataKey="month" fontSize={10} tick={{ fill: COLORS.muted }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
          <YAxis hide />
          <Tooltip formatter={(value, name) => [`$${N(value).toLocaleString()}`, name]} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0', background: 'white' }} />
          {otherSubCategories.map((subCat) => <Line key={subCat} type="monotone" dataKey={subCat} stroke={COLORS.lightBlue} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: COLORS.lightBlue }} opacity={0.5} />)}
          <Line type="monotone" dataKey="Appliances" stroke={COLORS.primary} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: COLORS.primary }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Header({ selectedMonth, setSelectedMonth }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.navy})`, display: 'grid', placeItems: 'center', color: 'white', fontWeight: 900, boxShadow: '0 8px 20px rgba(59,89,152,0.22)' }}>RB</div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: COLORS.navy }}>Superstore KPI Dashboard</div>
          <div style={{ fontSize: 13, color: COLORS.muted }}>Royal Blue Analytics</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label htmlFor="month" style={{ fontSize: 13, color: COLORS.muted, fontWeight: 700 }}>Month</label>
        <select id="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: COLORS.navy, background: 'white' }}>
          {AVAILABLE_MONTHS.map((month) => <option key={month} value={month}>{month}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/dashboard?month=${selectedMonth}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setDashboard(data);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedMonth]);

  const fallbackCustomerSegmentation = Array.isArray(dashboard?.customerSegmentation) ? dashboard.customerSegmentation : [];
  const fallbackRadarData = [
    { segment: 'Recency', currentYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Recency')?.current), priorYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Recency')?.prior) },
    { segment: 'Frequency', currentYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Frequency')?.current), priorYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Frequency')?.prior) },
    { segment: 'Monetary', currentYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Monetary')?.current), priorYear: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Monetary')?.prior) },
  ];

  const fallbackRfmScores = {
    recency: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Recency')?.current),
    frequency: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Frequency')?.current),
    monetary: N(fallbackCustomerSegmentation.find((d) => d.metric === 'Monetary')?.current),
  };

  const content = {
    sparklineData: [],
    current: {},
    prior: {},
    salesPerCustomer: {},
    regionalData: [],
    stateData: [],
    segmentData: [],
    shipModeData: [],
    chordData: [],
    radarData: [],
    rfmScores: {},
    appliancesMetrics: {},
    appliancesTrend: [],
    subCategoryTrend: [],
    ...(dashboard ?? {}),
    radarData: Array.isArray(dashboard?.radarData) && dashboard.radarData.length ? dashboard.radarData : fallbackRadarData,
    rfmScores: dashboard?.rfmScores ?? fallbackRfmScores,
  };

  return (
    <div style={{ minHeight: '100%', background: COLORS.background, color: COLORS.text }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: 24 }}>
        <Header selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} />

        {error && <div style={{ marginTop: 16, background: '#fee2e2', color: '#991b1b', padding: 14, borderRadius: 12 }}>Failed to load data: {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, marginTop: 20 }}>
          <KPICard title="Sales" currentValue={content.current.sales} priorValue={content.prior.sales} sparklineData={content.sparklineData} sparklineKey="sales" format="currency" />
          <KPICard title="Profit" currentValue={content.current.profit} priorValue={content.prior.profit} sparklineData={content.sparklineData} sparklineKey="profit" format="currency" />
          <KPICard title="Quantity" currentValue={content.current.quantity} priorValue={content.prior.quantity} sparklineData={content.sparklineData} sparklineKey="quantity" format="number" />
          <KPICard title="Avg Discount" currentValue={content.current.discount} priorValue={content.prior.discount} sparklineData={content.sparklineData} sparklineKey="discount" format="percent" />
          <KPICard title="Profit Ratio" currentValue={content.current.profitRatio} priorValue={content.prior.profitRatio} sparklineData={content.sparklineData} sparklineKey="profitRatio" format="percent" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1fr', gap: 16, marginTop: 16 }}>
          <Card style={{ minHeight: 420, padding: 26, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChartIconClock />
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>Sales per Customer</div>
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Gauge vs target</div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <GaugeChart value={content.salesPerCustomer.spc} target={content.salesPerCustomer.target} />
            </div>
          </Card>

          <Card style={{ padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>Regional Sales</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                {Object.entries(REGION_COLORS).map(([region, color]) => (
                  <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: COLORS.muted, fontWeight: 600 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: color, display: 'inline-block' }} />
                    {region}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={content.regionalData} margin={{ top: 8, right: 10, left: 8, bottom: 0 }}>
                  <defs>
                    {Object.entries(REGION_COLORS).map(([name, color]) => (
                      <linearGradient key={name} id={`region-${name}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#d7e2f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${Math.round(N(value) / 1000)}K`}
                    tick={{ fontSize: 12, fill: COLORS.muted }}
                    tickLine={false}
                    axisLine={false}
                    width={58}
                  />
                  <Tooltip formatter={(value) => formatCurrency(N(value))} />
                  {Object.entries(REGION_COLORS).map(([region, color]) => (
                    <Area
                      key={region}
                      type="monotone"
                      dataKey={region}
                      stackId="1"
                      stroke={color}
                      fill={`url(#region-${region})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card style={{ minHeight: 420, padding: 26, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <ChartIconPerson />
              <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>State-wise Sales</div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <CircularVoronoiTreemap data={content.stateData} size={270} />
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Card>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy, marginBottom: 14 }}>Order Distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'center' }}>
              <OrderBarsStacked segmentData={content.segmentData} shipModeData={content.shipModeData} />
              <div style={{ display: 'grid', placeItems: 'center' }}><ChordDiagram data={content.chordData} /></div>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy, marginBottom: 14 }}>Customer Segmentation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16, alignItems: 'center' }}>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={content.radarData} outerRadius="70%">
                    <PolarGrid />
                    <PolarAngleAxis dataKey="segment" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
                    <Radar name="Current Year" dataKey="currentYear" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.25} />
                    <Radar name="Prior Year" dataKey="priorYear" stroke={COLORS.secondary} fill={COLORS.secondary} fillOpacity={0.15} />
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <ScoreSlider label="Recency" score={content.rfmScores.recency} />
                <ScoreSlider label="Frequency" score={content.rfmScores.frequency} />
                <ScoreSlider label="Monetary" score={content.rfmScores.monetary} />
              </div>
            </div>
          </Card>
        </div>

        <Card style={{ marginTop: 16, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ color: COLORS.muted, fontSize: 20, lineHeight: 1 }}>◫</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.navy }}>Sub Category Analysis & Monthly Rankings</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <SubCategoryKPICard metrics={content.appliancesMetrics} trendData={content.appliancesTrend} />
            </div>

            <div
              style={{
                minWidth: 0,
                position: 'relative',
                height: 520,
                background: 'linear-gradient(180deg, #f0f4ff 0%, #e8efff 100%)',
                borderRadius: 18,
                overflow: 'hidden',
                border: '1px solid #dfe8f7',
                padding: '14px 18px 12px 18px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, position: 'relative', zIndex: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.navy }}>All Sub-Categories</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Appliances highlighted</div>
              </div>
              <SubCategoryLineChart data={content.subCategoryTrend} compact />
            </div>
          </div>
        </Card>

        {loading && <div style={{ marginTop: 16, color: COLORS.muted, fontSize: 13 }}>Loading dashboard data…</div>}
      </div>
    </div>
  );
}
