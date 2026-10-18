'use client';
import { useId, type ReactNode } from 'react';
import { VisuallyHidden } from 'react-aria-components';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { Table } from '../Display';
import type { OverlayPresentationProps } from '../overlay-contract';
import classes from './Chart.module.css';
export type ChartKind = 'donut' | 'pie' | 'bar-horizontal' | 'bar-vertical' | 'radar' | 'area' | 'line' | 'histogram';
export interface ChartDatum {
  name: string;
  value: number;
}
export interface ChartProps extends OverlayPresentationProps {
  kind: ChartKind;
  data: readonly ChartDatum[];
  label: string;
  labels: { category: string; value: string; percentage: string };
  size?: 'compact' | 'standard' | 'large';
  formatValue?: (value: number) => string;
  formatPercentage?: (fraction: number) => string;
}
const palette = [
  'var(--geul-chart-series-primary)',
  'var(--geul-chart-series-secondary)',
  'var(--geul-chart-series-tertiary)',
];
function ValueTooltip({
  active,
  payload,
  formatValue,
}: {
  active?: boolean;
  payload?: readonly { name?: string; value?: number | string; payload?: ChartDatum }[];
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className={classes.tooltip}>
      {payload.map((item, i) => (
        <div key={i}>
          {item.payload?.name ?? item.name}: {formatValue(Number(item.value ?? 0))}
        </div>
      ))}
    </div>
  );
}
export function Chart({
  kind,
  data,
  label,
  labels,
  size = 'standard',
  formatValue = (value) => String(value),
  formatPercentage = (value) => `${Math.round(value * 100)}%`,
}: ChartProps) {
  const captionId = useId();
  const rows = data.map(({ name, value }) => ({ name, value: Number.isFinite(value) ? value : 0 }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (
    !['donut', 'pie', 'bar-horizontal', 'bar-vertical', 'radar', 'area', 'line', 'histogram'].includes(kind) ||
    !['compact', 'standard', 'large'].includes(size)
  ) {
    throw new RangeError('Core Chart requires supported kind and size variants');
  }
  const tooltip = (
    <Tooltip
      isAnimationActive={false}
      cursor={{ stroke: 'var(--geul-border-default)', fill: 'var(--geul-surface-hover)' }}
      content={<ValueTooltip formatValue={formatValue} />}
    />
  );
  const axes = (horizontal = false) => (
    <>
      {/* Hairline guides run across the value axis only, never through the marks. */}
      <CartesianGrid stroke="var(--geul-border-default)" vertical={horizontal} horizontal={!horizontal} />
      <XAxis
        type={horizontal ? 'number' : 'category'}
        dataKey={horizontal ? undefined : 'name'}
        tick={{ fill: 'var(--geul-text-secondary)', fontSize: 'var(--geul-font-size-xs)' }}
        stroke="var(--geul-border-default)"
        tickLine={false}
        tickFormatter={horizontal ? formatValue : undefined}
      />
      <YAxis
        type={horizontal ? 'category' : 'number'}
        dataKey={horizontal ? 'name' : undefined}
        width={horizontal ? 100 : 60}
        tick={{ fill: 'var(--geul-text-secondary)', fontSize: 'var(--geul-font-size-xs)' }}
        stroke="var(--geul-border-default)"
        axisLine={false}
        tickLine={false}
        tickFormatter={horizontal ? undefined : formatValue}
      />
    </>
  );
  let plot: ReactNode;
  if (kind === 'pie' || kind === 'donut') {
    plot = (
      <PieChart accessibilityLayer={false}>
        {tooltip}
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          rootTabIndex={-1}
          innerRadius={kind === 'donut' ? '45%' : 0}
          outerRadius="70%"
          stroke="var(--geul-surface)"
          isAnimationActive={false}
          label={(entry) => (
            <text x={entry.x} y={entry.y} textAnchor={entry.textAnchor} className={classes.pieLabel}>
              {formatPercentage(entry.percent ?? 0)}
            </text>
          )}
        >
          {rows.map((row, i) => (
            <Cell key={`${row.name}-${i}`} fill={palette[i % palette.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  } else if (kind === 'radar') {
    plot = (
      <RadarChart accessibilityLayer={false} data={rows} outerRadius="70%">
        <PolarGrid stroke="var(--geul-border-default)" />
        <PolarAngleAxis
          stroke="var(--geul-border-default)"
          dataKey="name"
          tick={{ fill: 'var(--geul-text-secondary)', fontSize: 'var(--geul-font-size-xs)' }}
        />
        <PolarRadiusAxis
          stroke="var(--geul-border-default)"
          tickFormatter={formatValue}
          tick={{ fill: 'var(--geul-text-secondary)', fontSize: 'var(--geul-font-size-xs)' }}
        />
        <Radar dataKey="value" name={labels.value} fill="none" stroke={palette[0]} isAnimationActive={false} />
        {tooltip}
      </RadarChart>
    );
  } else if (kind === 'area') {
    plot = (
      <AreaChart accessibilityLayer={false} data={rows}>
        {axes()}
        {tooltip}
        <Area
          dataKey="value"
          name={labels.value}
          type="monotone"
          fill={palette[0]}
          fillOpacity={0.12}
          stroke={palette[0]}
          strokeWidth={1}
          isAnimationActive={false}
        />
      </AreaChart>
    );
  } else if (kind === 'line') {
    plot = (
      <LineChart accessibilityLayer={false} data={rows}>
        {axes()}
        {tooltip}
        <Line
          dataKey="value"
          name={labels.value}
          type="monotone"
          stroke={palette[0]}
          strokeWidth={1}
          dot={{ fill: palette[0], r: 2, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </LineChart>
    );
  } else {
    plot = (
      <BarChart
        accessibilityLayer={false}
        data={rows}
        layout={kind === 'bar-horizontal' ? 'vertical' : 'horizontal'}
        // A histogram's bins touch; categorical bars stay slim, meter-like strokes.
        barCategoryGap={kind === 'histogram' ? 2 : '30%'}
      >
        {axes(kind === 'bar-horizontal')}
        {tooltip}
        <Bar
          dataKey="value"
          name={labels.value}
          fill={palette[0]}
          maxBarSize={kind === 'histogram' ? undefined : 12}
          isAnimationActive={false}
        />
      </BarChart>
    );
  }
  return (
    <figure className={classes.root} data-kind={kind} data-size={size} aria-labelledby={captionId}>
      <VisuallyHidden>
        <figcaption id={captionId}>{label}</figcaption>
      </VisuallyHidden>
      <div
        className={classes.plot}
        aria-hidden="true"
        style={
          kind === 'bar-horizontal'
            ? { height: `max(12.5rem, calc(var(--geul-control-height-md) * ${rows.length}))` }
            : undefined
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          {plot}
        </ResponsiveContainer>
      </div>
      <div className={classes.legend} aria-hidden="true">
        {kind === 'pie' || kind === 'donut'
          ? rows.map((row, i) => (
              <span key={`${row.name}-${i}`}>
                <span className={classes.swatch} style={{ background: palette[i % palette.length] }} />
                {row.name}
              </span>
            ))
          : null}
      </div>
      <VisuallyHidden>
        <Table>
          <caption>{label}</caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{labels.category}</Table.Th>
              <Table.Th>{labels.value}</Table.Th>
              <Table.Th>{labels.percentage}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, i) => (
              <Table.Tr key={`${row.name}-${i}`}>
                <Table.Td>{row.name}</Table.Td>
                <Table.Td>{formatValue(row.value)}</Table.Td>
                <Table.Td>{formatPercentage(total > 0 ? row.value / total : 0)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </VisuallyHidden>
    </figure>
  );
}
