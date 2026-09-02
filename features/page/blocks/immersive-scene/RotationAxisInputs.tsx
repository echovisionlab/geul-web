'use client';

import { Group, Stack, Text } from '@mantine/core';
import { NumberInput } from '@/components/core/Input';

export type RotationAxis = 'x' | 'y' | 'z';

export interface RotationAxisValues {
  x?: string;
  y?: string;
  z?: string;
}

interface RotationAxisInputsProps {
  label: string;
  description?: string;
  values: RotationAxisValues;
  placeholders?: RotationAxisValues;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  testId: string;
  onChange: (axis: RotationAxis, value: string | undefined) => void;
}

const AXES = ['x', 'y', 'z'] as const;

function normalizeValue(value: string | number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : undefined;
  }
  return value.trim() === '' ? undefined : value;
}

export function RotationAxisInputs({
  label,
  description,
  values,
  placeholders,
  min,
  max,
  step,
  suffix,
  testId,
  onChange,
}: RotationAxisInputsProps) {
  return (
    <Stack gap={6} data-testid={testId}>
      <div>
        <Text size="xs" fw={500}>
          {label}
        </Text>
        {description ? (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        ) : null}
      </div>
      <Group grow align="flex-start" gap="xs" wrap="nowrap">
        {AXES.map((axis) => (
          <NumberInput
            key={axis}
            aria-label={`${label} ${axis.toUpperCase()}`}
            label={axis.toUpperCase()}
            value={values[axis] ?? ''}
            placeholder={placeholders?.[axis]}
            min={min}
            max={max}
            step={step}
            decimalScale={2}
            suffix={suffix}
            size="xs"
            onChange={(value) => onChange(axis, normalizeValue(value))}
          />
        ))}
      </Group>
    </Stack>
  );
}
