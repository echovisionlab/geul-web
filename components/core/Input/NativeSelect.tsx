'use client';

import { forwardRef, useId, type ChangeEventHandler } from 'react';
import { inputAttributes, type InputBaseProps, type InputOptions } from './input-contract';
import classes from './Input.module.css';
import { useToolbarInputPresentation, inputPresentation } from './InputParts';
import { InputOpenGlyph } from './InputGlyphs';
export interface NativeSelectProps extends InputBaseProps {
  data?: InputOptions;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  children?: React.ReactNode;
}
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const uid = useId();
  const id = props.id ?? uid;
  const help = props.description ? `${id}-description` : undefined;
  const error = props.error && typeof props.error !== 'boolean' ? `${id}-error` : undefined;
  return (
    <div
      {...inputPresentation(presentation)}
      data-invalid={Boolean(props.error) || undefined}
      data-disabled={props.disabled || undefined}
    >
      {props.label ? (
        <label className={classes.label} htmlFor={id}>
          {props.label}
          {props.required ? (
            <span className={classes.required} aria-hidden>
              {' '}
              *
            </span>
          ) : null}
        </label>
      ) : null}
      <div className={classes.wrapper}>
        {props.leftSection ? (
          <span className={classes.section} aria-hidden>
            {props.leftSection}
          </span>
        ) : null}
        <select
          {...inputAttributes(props)}
          ref={ref}
          id={id}
          className={`${classes.input} ${classes.nativeSelect}`}
          name={props.name}
          value={props.value}
          defaultValue={props.defaultValue}
          required={props.required}
          disabled={props.disabled || props.readOnly}
          aria-invalid={props.error ? true : props['aria-invalid']}
          aria-describedby={[props['aria-describedby'], help, error].filter(Boolean).join(' ') || undefined}
          onChange={props.onChange}
        >
          {props.children ??
            props.data?.map((item) =>
              typeof item === 'object' && 'group' in item ? (
                <optgroup key={item.group} label={item.group}>
                  {item.items.map((option) => {
                    const value = typeof option === 'string' ? { value: option, label: option } : option;
                    return (
                      <option key={value.value} value={value.value} disabled={value.disabled}>
                        {value.label}
                      </option>
                    );
                  })}
                </optgroup>
              ) : (
                (() => {
                  const value = typeof item === 'string' ? { value: item, label: item } : item;
                  return (
                    <option key={value.value} value={value.value} disabled={value.disabled}>
                      {value.label}
                    </option>
                  );
                })()
              ),
            )}
        </select>
        <span className={classes.nativeSelectIndicator} aria-hidden>
          {props.rightSection ?? <InputOpenGlyph />}
        </span>
      </div>
      {props.description ? (
        <div id={help} className={classes.description}>
          {props.description}
        </div>
      ) : null}
      {props.error && typeof props.error !== 'boolean' ? (
        <div id={error} className={classes.error}>
          {props.error}
        </div>
      ) : null}
    </div>
  );
});
NativeSelect.displayName = 'NativeSelect';
