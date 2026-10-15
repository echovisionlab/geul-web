'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useId } from 'react';

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
  const labelId = useId();
  const descriptionId = useId();
  return (
    <DsLayoutStack gap="xxs" data-testid={testId} role="group" aria-labelledby={labelId}>
      <div>
        <DsText id={labelId} size="xs" weight="medium">
          {label}
        </DsText>
        {description ? (
          <DsText id={descriptionId} size="xs" tone="secondary">
            {description}
          </DsText>
        ) : null}
      </div>
      <DsLayoutInline grow align="start" gap="xs" wrap="nowrap">
        {AXES.map((axis) => (
          <NumberInput
            key={axis}
            aria-label={`${label} ${axis.toUpperCase()}`}
            aria-describedby={description ? descriptionId : undefined}
            label={axis.toUpperCase()}
            value={values[axis] ?? ''}
            placeholder={placeholders?.[axis]}
            min={min}
            max={max}
            step={step}
            decimalScale={2}
            suffix={suffix}
            onChange={(value) => onChange(axis, normalizeValue(value))}
          />
        ))}
      </DsLayoutInline>
    </DsLayoutStack>
  );
}
