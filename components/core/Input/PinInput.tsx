'use client';

import { useId, useRef, useState } from 'react';
import { Group, Input, TextField } from 'react-aria-components';
import { inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
export interface PinInputProps extends InputBaseProps {
  align?: 'start' | 'center' | 'end';
  value?: string;
  defaultValue?: string;
  length?: 4 | 6 | 8;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  mask?: boolean;
  type?: 'number' | 'alphanumeric';
  ariaLabel?: string;
  oneTimeCode?: boolean;
  inputMode?: 'numeric' | 'text';
}
export function PinInput(props: PinInputProps) {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const uid = useId();
  const id = props.id ?? uid;
  const labelId = props.label ? `${id}-label` : undefined;
  const labelledBy = props['aria-labelledby'] ?? labelId;
  const descriptionId = props.description ? `${id}-description` : undefined;
  const errorId = props.error && typeof props.error !== 'boolean' ? `${id}-error` : undefined;
  const describedBy = [props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const accessibleLabel = props.ariaLabel ?? props['aria-label'] ?? labels.code;
  const align = props.align ?? 'start';
  if (!['start', 'center', 'end'].includes(align)) {
    throw new RangeError('Invalid PIN input alignment');
  }
  const length = props.length ?? 4;
  if (![4, 6, 8].includes(length)) {
    throw new RangeError('Invalid PIN input length');
  }
  const [uncontrolled, setValue] = useState(props.defaultValue ?? '');
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const value = props.value ?? uncontrolled;
  const update = (next: string) => {
    setValue(next);
    props.onChange?.(next);
    if (next.length === length && !next.includes(' ')) {
      props.onComplete?.(next);
    }
  };
  return (
    <div
      {...inputAttributes(props)}
      {...inputPresentation(presentation)}
      data-geul-pin-align={align}
      data-geul-pin-length={length}
      data-invalid={Boolean(props.error) || undefined}
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : accessibleLabel}
      aria-describedby={describedBy}
    >
      {props.label ? (
        <label id={labelId} className={classes.label} htmlFor={id}>
          {props.label}
        </label>
      ) : null}
      <Group className={classes.pinGroup}>
        {Array.from({ length }, (_, index) => (
          <TextField
            key={index}
            className={classes.pinCell}
            {...inputState(props)}
            value={value[index]?.trim() ?? ''}
            aria-label={labelledBy ? undefined : `${accessibleLabel} ${index + 1}`}
            aria-labelledby={labelledBy ? `${labelledBy} ${id}-position-${index}` : undefined}
            aria-describedby={describedBy}
          >
            {labelledBy ? (
              <span id={`${id}-position-${index}`} hidden>
                {index + 1}
              </span>
            ) : null}
            <Input
              ref={(input) => {
                inputs.current[index] = input;
              }}
              id={index === 0 ? id : undefined}
              autoFocus={index === 0 && props.autoFocus}
              className={classes.pin}
              aria-invalid={Boolean(props.error) || props['aria-invalid'] || undefined}
              type={props.mask ? 'password' : 'text'}
              inputMode={props.inputMode ?? (props.type === 'alphanumeric' ? 'text' : 'numeric')}
              autoComplete={index === 0 && props.oneTimeCode !== false ? 'one-time-code' : 'off'}
              maxLength={length}
              onFocus={(event) => event.currentTarget.select()}
              onPaste={(event) => {
                const text = event.clipboardData
                  .getData('text')
                  .replace(props.type === 'alphanumeric' ? /[^a-z0-9]/gi : /\D/g, '')
                  .slice(0, length - index);
                if (!text || props.disabled || props.readOnly) {
                  return;
                }
                event.preventDefault();
                const chars = value.padEnd(length, ' ').split('');
                [...text].forEach((char, offset) => {
                  chars[index + offset] = char;
                });
                update(chars.join('').trimEnd());
                inputs.current[Math.min(length - 1, index + text.length)]?.focus();
              }}
              onChange={(event) => {
                if (props.disabled || props.readOnly) {
                  return;
                }
                const text = event.currentTarget.value.replace(
                  props.type === 'alphanumeric' ? /[^a-z0-9]/gi : /\D/g,
                  '',
                );
                const chars = value.padEnd(length, ' ').split('');
                text
                  .split('')
                  .slice(0, length - index)
                  .forEach((char, offset) => {
                    chars[index + offset] = char;
                  });
                if (!text) {
                  chars[index] = ' ';
                }
                update(chars.join('').trimEnd());
                inputs.current[Math.min(length - 1, index + text.length)]?.focus();
              }}
              onKeyDown={(event) => {
                if (props.disabled || props.readOnly) {
                  return;
                }
                if (event.key === 'Backspace' || event.key === 'Delete') {
                  event.preventDefault();
                  const target = event.key === 'Backspace' && !value[index]?.trim() ? Math.max(0, index - 1) : index;
                  const chars = value.padEnd(length, ' ').split('');
                  chars[target] = ' ';
                  update(chars.join('').trimEnd());
                  inputs.current[target]?.focus();
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  inputs.current[Math.max(0, index - 1)]?.focus();
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  inputs.current[Math.min(length - 1, index + 1)]?.focus();
                }
              }}
            />
          </TextField>
        ))}
      </Group>
      {props.description ? (
        <span id={descriptionId} className={classes.description}>
          {props.description}
        </span>
      ) : null}
      {props.error && typeof props.error !== 'boolean' ? (
        <span id={errorId} className={classes.error}>
          {props.error}
        </span>
      ) : null}
    </div>
  );
}
