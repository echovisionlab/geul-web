'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { FieldError, Label, Text } from 'react-aria-components';
import { useToolbarDensity } from '../control-context';
import { InputValidationGlyph } from './InputGlyphs';
import { useCoreInputLabels } from './input-labels';
import type { InputBaseProps, InputSize } from './input-contract';
import classes from './Input.module.css';

const InputSizeContext = createContext<InputSize | undefined>(undefined);

/**
 * Declares one input size for a region such as a settings panel, so every Core input inside it shares
 * the same label, text and control scale without per-field `size` props. An explicit `size` still wins.
 */
export function InputSizeProvider({ size, children }: { size: InputSize; children: ReactNode }) {
  return <InputSizeContext.Provider value={size}>{children}</InputSizeContext.Provider>;
}

/**
 * The single size path for Core inputs: explicit size, then the region's InputSizeProvider, then the
 * compact toolbar's control and text scale.
 */
export function useToolbarInputPresentation<
  Props extends Pick<InputBaseProps, 'size' | 'density' | 'animate' | 'grow'>,
>(props: Props): Props {
  const toolbarDensity = useToolbarDensity();
  const regionSize = useContext(InputSizeContext);
  if (toolbarDensity === 'compact') {
    return { ...props, size: 'xs' as const, density: 'compact' as const };
  }
  return props.size === undefined && regionSize !== undefined ? { ...props, size: regionSize } : props;
}

export function InputLabel({ label, required }: Pick<InputBaseProps, 'label' | 'required'>) {
  return label ? (
    <Label className={classes.label}>
      {label}
      {required ? (
        <span className={classes.required} aria-hidden>
          {' '}
          *
        </span>
      ) : null}
    </Label>
  ) : null;
}
export function InputHelp({ description, error }: Pick<InputBaseProps, 'description' | 'error'>) {
  return (
    <>
      {description ? (
        <Text slot="description" className={classes.description}>
          {description}
        </Text>
      ) : null}
      {error && typeof error !== 'boolean' ? <FieldError className={classes.error}>{error}</FieldError> : null}
    </>
  );
}
/** Option lookup status shared by choice fields; it names itself so the field name stays unchanged. */
export function InputLoadingStatus({ label }: { label?: string }) {
  const labels = useCoreInputLabels();
  return (
    <span className={classes.validationStatus} role="status" aria-label={label ?? labels.loading}>
      <InputValidationGlyph status="checking" />
    </span>
  );
}

export function inputState(props: Pick<InputBaseProps, 'disabled' | 'readOnly' | 'required' | 'error'>) {
  return {
    isDisabled: props.disabled,
    isReadOnly: props.readOnly,
    isRequired: props.required,
    isInvalid: Boolean(props.error),
    validationBehavior: 'aria' as const,
  };
}
export function inputPresentation(props: Pick<InputBaseProps, 'size' | 'density' | 'animate' | 'grow'>) {
  return {
    className: classes.root,
    'data-geul-input': true,
    'data-geul-input-grow': props.grow || undefined,
    'data-geul-input-size': props.size ?? 'sm',
    'data-geul-input-density': props.density ?? 'comfortable',
    'data-geul-input-animate': props.animate !== false,
  };
}

/** Portalled option lists retain the trigger's size and density. */
export function inputPopoverPresentation(props: Pick<InputBaseProps, 'size' | 'density'>) {
  return {
    className: classes.popover,
    'data-geul-input-size': props.size ?? 'sm',
    'data-geul-input-density': props.density ?? 'comfortable',
  };
}
