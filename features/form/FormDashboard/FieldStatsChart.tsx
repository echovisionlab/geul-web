'use client';

import { useState } from 'react';
import { AreaChart, BarChart, DonutChart, LineChart, PieChart, RadarChart } from '@mantine/charts';
import { Group, Stack, Table, Text } from '@mantine/core';
import { Select } from '@/components/core/Input';
import type { FieldStats, FieldStatsDate, FieldStatsDistribution, FieldStatsNumber } from '@/lib/types/form/model';

type ChartType =
  'donut' | 'pie' | 'bar-horizontal' | 'bar-vertical' | 'radar' | 'table' | 'area' | 'line' | 'histogram';

interface FieldStatsChartProps {
  fieldStat: FieldStats;
}

function isDistributionStats(stat: FieldStats): stat is FieldStatsDistribution {
  return 'distribution' in stat;
}

function isDateStats(stat: FieldStats): stat is FieldStatsDate {
  return 'dateDistribution' in stat;
}

function isNumberStats(stat: FieldStats): stat is FieldStatsNumber {
  return 'histogram' in stat;
}

const CHART_OPTIONS: Record<string, { value: ChartType; label: string }[]> = {
  select: [
    { value: 'donut', label: 'Donut' },
    { value: 'pie', label: 'Pie' },
    { value: 'bar-horizontal', label: 'Bar (Horizontal)' },
    { value: 'bar-vertical', label: 'Bar (Vertical)' },
    { value: 'radar', label: 'Radar' },
    { value: 'table', label: 'Table' },
  ],
  multiselect: [
    { value: 'bar-horizontal', label: 'Bar (Horizontal)' },
    { value: 'bar-vertical', label: 'Bar (Vertical)' },
    { value: 'radar', label: 'Radar' },
    { value: 'table', label: 'Table' },
  ],
  checkbox: [
    { value: 'donut', label: 'Donut' },
    { value: 'pie', label: 'Pie' },
    { value: 'bar-horizontal', label: 'Bar (Horizontal)' },
    { value: 'table', label: 'Table' },
  ],
  switch: [
    { value: 'donut', label: 'Donut' },
    { value: 'pie', label: 'Pie' },
    { value: 'bar-horizontal', label: 'Bar (Horizontal)' },
    { value: 'table', label: 'Table' },
  ],
  date: [
    { value: 'area', label: 'Area' },
    { value: 'line', label: 'Line' },
    { value: 'bar-vertical', label: 'Bar' },
    { value: 'table', label: 'Table' },
  ],
  number: [
    { value: 'histogram', label: 'Histogram' },
    { value: 'bar-vertical', label: 'Bar' },
    { value: 'table', label: 'Table' },
  ],
  default: [
    { value: 'bar-horizontal', label: 'Bar (Horizontal)' },
    { value: 'table', label: 'Table' },
  ],
};

const DEFAULT_CHART: Record<string, ChartType> = {
  select: 'donut',
  multiselect: 'bar-horizontal',
  checkbox: 'donut',
  switch: 'donut',
  date: 'area',
  number: 'histogram',
  default: 'bar-horizontal',
};

const COLORS = [
  'blue.6',
  'teal.6',
  'violet.6',
  'orange.6',
  'pink.6',
  'cyan.6',
  'grape.6',
  'lime.6',
  'indigo.6',
  'yellow.6',
];

export function FieldStatsChart({ fieldStat }: FieldStatsChartProps) {
  const fieldType = fieldStat.fieldType || 'default';
  const options = CHART_OPTIONS[fieldType] || CHART_OPTIONS.default;
  const defaultChart = DEFAULT_CHART[fieldType] || DEFAULT_CHART.default;

  const [chartType, setChartType] = useState<ChartType>(defaultChart);

  const renderDistributionChart = (stat: FieldStatsDistribution) => {
    if (stat.distribution.length === 0) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No responses yet
        </Text>
      );
    }

    const total = stat.distribution.reduce((sum, d) => sum + d.count, 0);

    const pieData = stat.distribution.map((item, index) => ({
      name: item.value || '(empty)',
      value: item.count,
      color: COLORS[index % COLORS.length],
    }));

    const barData = stat.distribution.map((item) => ({
      name: item.value || '(empty)',
      count: item.count,
    }));

    switch (chartType) {
      case 'donut':
        return (
          <DonutChart
            data={pieData}
            withLabelsLine
            labelsType="percent"
            withTooltip
            tooltipDataSource="segment"
            size={200}
            thickness={30}
          />
        );

      case 'pie':
        return (
          <PieChart
            data={pieData}
            withLabelsLine
            labelsType="percent"
            withTooltip
            tooltipDataSource="segment"
            size={200}
          />
        );

      case 'bar-horizontal':
        return (
          <BarChart
            h={Math.max(200, stat.distribution.length * 40)}
            data={barData}
            dataKey="name"
            series={[{ name: 'count', color: 'blue.6' }]}
            orientation="vertical"
            yAxisProps={{ width: 100 }}
            withTooltip
          />
        );

      case 'bar-vertical':
        return (
          <BarChart h={300} data={barData} dataKey="name" series={[{ name: 'count', color: 'blue.6' }]} withTooltip />
        );

      case 'radar':
        return (
          <RadarChart
            h={300}
            data={barData}
            dataKey="name"
            series={[{ name: 'count', color: 'blue.6' }]}
            withPolarRadiusAxis
          />
        );

      case 'table':
        return (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Value</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stat.distribution.map((item) => {
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <Table.Tr key={item.value}>
                    <Table.Td>{item.value || '(empty)'}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{item.count}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{percentage.toFixed(1)}%</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        );

      default:
        return null;
    }
  };

  const renderDateChart = (stat: FieldStatsDate) => {
    if (stat.dateDistribution.length === 0) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No responses yet
        </Text>
      );
    }

    const total = stat.dateDistribution.reduce((sum, d) => sum + d.count, 0);

    const chartData = stat.dateDistribution.map((item) => ({
      date: item.date,
      count: item.count,
    }));

    switch (chartType) {
      case 'area':
        return (
          <AreaChart
            h={300}
            data={chartData}
            dataKey="date"
            series={[{ name: 'count', color: 'blue.6' }]}
            curveType="monotone"
            withTooltip
            withDots={false}
          />
        );

      case 'line':
        return (
          <LineChart
            h={300}
            data={chartData}
            dataKey="date"
            series={[{ name: 'count', color: 'blue.6' }]}
            curveType="monotone"
            withTooltip
            withDots
          />
        );

      case 'bar-vertical':
        return (
          <BarChart h={300} data={chartData} dataKey="date" series={[{ name: 'count', color: 'blue.6' }]} withTooltip />
        );

      case 'table':
        return (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Date</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stat.dateDistribution.map((item) => {
                const percentage = total > 0 ? (item.count / total) * 100 : 0;
                return (
                  <Table.Tr key={item.date}>
                    <Table.Td>{item.date}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{item.count}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>{percentage.toFixed(1)}%</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        );

      default:
        return null;
    }
  };

  const renderNumberChart = (stat: FieldStatsNumber) => {
    if (stat.count === 0) {
      return (
        <Text size="sm" c="dimmed" ta="center" py="xl">
          No responses yet
        </Text>
      );
    }

    const total = stat.histogram.reduce((sum, d) => sum + d.count, 0);
    const bucketSize = stat.histogram.length > 1 ? stat.histogram[1].bucket - stat.histogram[0].bucket : 1;

    const chartData = stat.histogram.map((item) => ({
      range: `${item.bucket.toFixed(1)}-${(item.bucket + bucketSize).toFixed(1)}`,
      count: item.count,
    }));

    switch (chartType) {
      case 'histogram':
      case 'bar-vertical':
        return (
          <Stack gap="xs">
            <Group gap="lg" justify="center">
              <Text size="sm" c="dimmed">
                Min:{' '}
                <Text span fw={500}>
                  {stat.min.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Max:{' '}
                <Text span fw={500}>
                  {stat.max.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Avg:{' '}
                <Text span fw={500}>
                  {stat.avg.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Count:{' '}
                <Text span fw={500}>
                  {stat.count}
                </Text>
              </Text>
            </Group>
            <BarChart
              h={300}
              data={chartData}
              dataKey="range"
              series={[{ name: 'count', color: 'blue.6' }]}
              withTooltip
            />
          </Stack>
        );

      case 'table':
        return (
          <Stack gap="xs">
            <Group gap="lg" justify="center">
              <Text size="sm" c="dimmed">
                Min:{' '}
                <Text span fw={500}>
                  {stat.min.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Max:{' '}
                <Text span fw={500}>
                  {stat.max.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Avg:{' '}
                <Text span fw={500}>
                  {stat.avg.toFixed(2)}
                </Text>
              </Text>
              <Text size="sm" c="dimmed">
                Count:{' '}
                <Text span fw={500}>
                  {stat.count}
                </Text>
              </Text>
            </Group>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Range</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Count</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {stat.histogram.map((item) => {
                  const percentage = total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <Table.Tr key={item.bucket}>
                      <Table.Td>
                        {item.bucket.toFixed(1)} - {(item.bucket + bucketSize).toFixed(1)}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{item.count}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{percentage.toFixed(1)}%</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>
        );

      default:
        return null;
    }
  };

  const renderChart = () => {
    if (isDistributionStats(fieldStat)) {
      return renderDistributionChart(fieldStat);
    }
    if (isDateStats(fieldStat)) {
      return renderDateChart(fieldStat);
    }
    if (isNumberStats(fieldStat)) {
      return renderNumberChart(fieldStat);
    }
    return null;
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={500}>{fieldStat.fieldName}</Text>
        <Select
          id={`chart-type-${fieldStat.fieldId}`}
          size="xs"
          w={160}
          value={chartType}
          onChange={(value) => value && setChartType(value as ChartType)}
          data={options}
        />
      </Group>
      {renderChart()}
    </Stack>
  );
}
