'use client';

import { forwardRef, useId, useState, type RefAttributes, type ReactElement } from 'react';
import { Button, FileTrigger } from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { inputPresentation, useToolbarInputPresentation } from './InputParts';
import { useCoreInputLabels } from './input-labels';
import { InputClearGlyph } from './InputGlyphs';
export interface FileInputProps<Multiple extends boolean = boolean> extends InputBaseProps {
  value?: Multiple extends true ? File[] : File | null;
  defaultValue?: Multiple extends true ? File[] : File | null;
  onChange?: (value: Multiple extends true ? File[] : File | null) => void;
  multiple?: Multiple;
  accept?: string;
  placeholder?: string;
  clearable?: boolean;
}
const FileInputControl = forwardRef<HTMLButtonElement, FileInputProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  const uid = useId();
  const id = props.id ?? uid;
  const labelId = props.label ? `${id}-label` : props['aria-label'] ? `${id}-name` : undefined;
  const descriptionId = props.description ? `${id}-description` : undefined;
  const errorId = props.error && typeof props.error !== 'boolean' ? `${id}-error` : undefined;
  const describedBy = [props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const [selected, setSelected] = useState<File | File[] | null>(props.defaultValue ?? null);
  const current = props.value === undefined ? selected : props.value;
  const update = (files: FileList | null) => {
    const value = props.multiple ? Array.from(files ?? []) : (files?.[0] ?? null);
    setSelected(value);
    props.onChange?.(value);
  };
  return (
    <div
      {...inputPresentation(presentation)}
      role="group"
      aria-labelledby={props['aria-labelledby'] ?? labelId}
      aria-describedby={describedBy}
      data-disabled={props.disabled || undefined}
      data-invalid={Boolean(props.error) || undefined}
    >
      {props.label ? (
        <label id={`${id}-label`} className={classes.label} htmlFor={id}>
          {props.label}
        </label>
      ) : null}
      {!props.label && props['aria-label'] ? (
        <span id={labelId} hidden>
          {props['aria-label']}
        </span>
      ) : null}
      <div className={classes.wrapper}>
        <FileTrigger
          acceptedFileTypes={props.accept?.split(',').map((value) => value.trim())}
          allowsMultiple={props.multiple}
          onSelect={update}
        >
          <Button
            {...inputAttributes(props)}
            ref={ref}
            id={id}
            className={`${classes.input} ${classes.fileButton}`}
            isDisabled={props.disabled || props.readOnly}
            aria-labelledby={
              [
                props['aria-labelledby'] ?? labelId,
                current || props.placeholder || !labelId ? `${id}-value` : undefined,
              ]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-describedby={describedBy}
          >
            <span id={`${id}-value`}>
              {current
                ? Array.isArray(current)
                  ? current.map((file) => file.name).join(', ')
                  : current.name
                : (props.placeholder ?? props.label)}
            </span>
          </Button>
        </FileTrigger>
        {props.clearable && current ? (
          <Button
            className={classes.accessory}
            isDisabled={props.disabled || props.readOnly}
            aria-label={labels.clear}
            onPress={() => update(null)}
          >
            <InputClearGlyph />
          </Button>
        ) : null}
      </div>
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
});
FileInputControl.displayName = 'FileInput';
export const FileInput = FileInputControl as <Multiple extends boolean = false>(
  props: FileInputProps<Multiple> & RefAttributes<HTMLButtonElement>,
) => ReactElement;
