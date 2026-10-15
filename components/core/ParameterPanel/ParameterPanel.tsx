'use client';

import { useMemo, type DependencyList } from 'react';
import type { OverlayPresentationProps } from '../overlay-contract';
import { Disclosure } from '../Disclosure';
import { LayoutStack } from '../Layout';
import { SectionCard } from '../Section';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { ColorInput, NumberInput, Select, Checkbox, TextInput } from '../Input';
import { IconCopy } from '@tabler/icons-react';
import classes from './ParameterPanel.module.css';

export interface ParameterRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}
interface FieldBase extends OverlayPresentationProps {
  label?: string;
  disabled?: boolean;
}
export interface NumberParameter extends FieldBase {
  kind: 'number';
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onEditEnd?: (value: number) => void;
}
export interface CheckboxParameter extends FieldBase {
  kind: 'checkbox';
  value: boolean;
  onChange?: (value: boolean) => void;
}
export interface ColorParameter extends FieldBase {
  kind: 'color';
  value: ParameterRgba;
  onChange?: (value: ParameterRgba) => void;
}
export interface SelectParameter extends FieldBase {
  kind: 'select';
  value: string;
  options: Readonly<Record<string, string>>;
  onChange?: (value: string) => void;
}
export interface TextParameter extends FieldBase {
  kind: 'text';
  value: string;
  onChange?: (value: string) => void;
}
export interface ActionParameter extends FieldBase {
  kind: 'action';
  onAction: () => void;
}
export interface GroupParameter extends OverlayPresentationProps {
  kind: 'group';
  fields: ParameterSchema;
  defaultExpanded?: boolean;
}
export type ParameterNode =
  | NumberParameter
  | CheckboxParameter
  | ColorParameter
  | SelectParameter
  | TextParameter
  | ActionParameter
  | GroupParameter;
export type ParameterSchema = Readonly<Record<string, ParameterNode>>;
export function parameterAction(
  onAction: () => void,
  { disabled = false }: { disabled?: boolean } = {},
): ActionParameter {
  return { kind: 'action', onAction, disabled };
}
export function parameterGroup(
  fields: ParameterSchema,
  { collapsed = true }: { collapsed?: boolean } = {},
): GroupParameter {
  return { kind: 'group', fields, defaultExpanded: !collapsed };
}
/** All values remain controlled by the caller. No vendor store can replay stale callbacks on external updates. */
export function useParameterControls(factory: () => ParameterSchema, dependencies: DependencyList): ParameterSchema {
  return useMemo(factory, dependencies);
}
export interface ParameterPanelProps extends OverlayPresentationProps {
  title: string;
  model: ParameterSchema;
  defaultCollapsed?: boolean;
  placement?: 'inline' | 'map-corner';
  copyLabel?: (field: string) => string;
}
export function ParameterPanel({
  title,
  model,
  defaultCollapsed = false,
  placement = 'inline',
  copyLabel,
}: ParameterPanelProps) {
  if (placement !== 'inline' && placement !== 'map-corner') {
    throw new TypeError('Unknown parameter panel placement');
  }
  return (
    <div className={classes.panel} data-geul-parameter-placement={placement}>
      <SectionCard padding="none">
        <Disclosure label={title} density="compact" defaultOpened={!defaultCollapsed}>
          <ParameterFields model={model} copyLabel={copyLabel} />
        </Disclosure>
      </SectionCard>
    </div>
  );
}
function rgbaString(value: ParameterRgba) {
  return `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`;
}
function ParameterFields({ model, copyLabel }: { model: ParameterSchema; copyLabel?: (field: string) => string }) {
  return (
    <LayoutStack gap="sm">
      {Object.entries(model).map(([key, field]) => {
        if (field.kind === 'group') {
          return (
            <Disclosure nested key={key} label={key} density="compact" defaultOpened={field.defaultExpanded}>
              <ParameterFields model={field.fields} copyLabel={copyLabel} />
            </Disclosure>
          );
        }
        const label = field.label ?? key;
        if (field.kind === 'action') {
          return (
            <Button key={key} size="xs" disabled={field.disabled} onClick={field.onAction}>
              {label}
            </Button>
          );
        }
        let control;
        if (field.kind === 'number') {
          control = <ParameterNumber field={field} label={label} />;
        } else if (field.kind === 'checkbox') {
          control = (
            <Checkbox
              label={label}
              size="xs"
              disabled={field.disabled}
              checked={field.value}
              onChange={(event) => field.onChange?.(event.currentTarget.checked)}
            />
          );
        } else if (field.kind === 'color') {
          control = (
            <ColorInput
              label={label}
              size="xs"
              disabled={field.disabled}
              value={rgbaString(field.value)}
              format="rgba"
              onChange={(value) => {
                const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(
                  value,
                );
                if (match) {
                  field.onChange?.({
                    r: Number(match[1]),
                    g: Number(match[2]),
                    b: Number(match[3]),
                    a: match[4] === undefined ? 1 : Number(match[4]),
                  });
                }
              }}
            />
          );
        } else if (field.kind === 'select') {
          control = (
            <Select
              label={label}
              size="xs"
              disabled={field.disabled}
              value={field.value}
              data={Object.entries(field.options).map(([name, value]) => ({ label: name, value }))}
              onChange={(value) => {
                if (value !== null && Object.values(field.options).includes(value)) {
                  field.onChange?.(value);
                }
              }}
            />
          );
        } else if (field.kind === 'text') {
          control = (
            <TextInput
              label={label}
              size="xs"
              disabled={field.disabled}
              value={field.value}
              onChange={(event) => field.onChange?.(event.currentTarget.value)}
            />
          );
        } else {
          throw new TypeError('Unknown parameter kind');
        }
        return (
          <div key={key} className={classes.field}>
            {control}
            {copyLabel ? (
              <IconButton
                size="xs"
                label={copyLabel(label)}
                disabled={field.disabled}
                onClick={() => {
                  const value = field.kind === 'color' ? rgbaString(field.value) : String(field.value);
                  void navigator.clipboard?.writeText(value);
                }}
              >
                <IconCopy size="1em" aria-hidden />
              </IconButton>
            ) : null}
          </div>
        );
      })}
    </LayoutStack>
  );
}

function ParameterNumber({ field, label }: { field: NumberParameter; label: string }) {
  return (
    <NumberInput
      label={label}
      size="xs"
      disabled={field.disabled}
      value={field.value}
      min={field.min}
      max={field.max}
      step={field.step}
      onChange={(value) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          (field.onEditEnd ?? field.onChange)?.(value);
        }
      }}
    />
  );
}
