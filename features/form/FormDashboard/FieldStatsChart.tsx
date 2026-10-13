'use client';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Chart } from '@/components/core/Chart';
import { LayoutInline, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { SupportingText, Text } from '@/components/core/Typography';
import { Table } from '@/components/core/Display';
import { Select } from '@/components/core/Input';
import type { FieldStats } from '@/lib/types/form/model';
import { fieldChartOptions, fieldChartRows, type FieldChartType } from './field-stats-chart-data';
export function FieldStatsChart({ fieldStat }: { fieldStat: FieldStats }) {
  const t = useTranslations('formDashboardPage.charts');
  const formatter = useFormatter();
  const options = fieldChartOptions[fieldStat.fieldType] ?? fieldChartOptions.default;
  const [selection, setSelection] = useState<FieldChartType>(options[0]);
  const kind = options.includes(selection) ? selection : options[0];
  const number = (value: number) => formatter.number(value, { maximumFractionDigits: 0 });
  const decimal = (value: number) => formatter.number(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percent = (value: number) =>
    formatter.number(value, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const data = fieldChartRows(fieldStat, decimal, t('emptyValue'));
  const total = data.reduce((sum, row) => sum + row.value, 0);
  const empty = 'histogram' in fieldStat ? fieldStat.count === 0 : data.length === 0;
  const labels = {
    category: t('histogram' in fieldStat ? 'range' : 'dateDistribution' in fieldStat ? 'date' : 'value'),
    value: t('count'),
    percentage: '%',
  };
  return (
    <LayoutStack gap="md">
      <LayoutInline justify="between" align="center" gap="sm">
        <Text id={`chart-field-${fieldStat.fieldId}`} size="sm" weight="strong">
          {fieldStat.fieldName}
        </Text>
        <Select
          id={`chart-type-${fieldStat.fieldId}`}
          size="xs"
          aria-label={t('chartType')}
          aria-describedby={`chart-field-${fieldStat.fieldId}`}

          value={kind}
          onChange={(value) => {
            if (options.includes(value as FieldChartType)) {
              setSelection(value as FieldChartType);
            }
          }}
          data={options.map((value) => ({ value, label: t(value) }))}
        />
      </LayoutInline>
      {empty ? (
        <LayoutInset block="xl">
          <SupportingText tone="muted" align="center">
            {t('noResponses')}
          </SupportingText>
        </LayoutInset>
      ) : (
        <LayoutStack gap="xs">
          {'histogram' in fieldStat ? (
            <LayoutInline gap="lg" justify="center">
              {(['min', 'max', 'avg', 'count'] as const).map((key) => (
                <Text key={key} size="sm" tone="muted">
                  {t(key)}:{' '}
                  <Text as="span" size="sm" weight="medium" numeric="tabular">
                    {key === 'count'
                      ? number(fieldStat[key])
                      : formatter.number(fieldStat[key], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </Text>
              ))}
            </LayoutInline>
          ) : null}
          {kind === 'table' ? (
            <Table>
              <caption>{fieldStat.fieldName}</caption>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{labels.category}</Table.Th>
                  <Table.Th align="end">{labels.value}</Table.Th>
                  <Table.Th align="end">{labels.percentage}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((row, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td align="end">{number(row.value)}</Table.Td>
                    <Table.Td align="end">{percent(total > 0 ? row.value / total : 0)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Chart
              kind={kind}
              data={data}
              label={fieldStat.fieldName}
              labels={labels}
              formatValue={number}
              formatPercentage={percent}
            />
          )}
        </LayoutStack>
      )}
    </LayoutStack>
  );
}
