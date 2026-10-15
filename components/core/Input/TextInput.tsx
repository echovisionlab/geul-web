'use client';

import { forwardRef } from 'react';
import { Group, Input, TextField } from 'react-aria-components';
import { useToolbarInputPresentation, InputHelp, InputLabel, inputPresentation, inputState } from './InputParts';
import { inputAttributes, fieldAccessibility, type InputBaseProps, type TextValueProps } from './input-contract';
import classes from './Input.module.css';

export interface TextInputProps extends InputBaseProps, TextValueProps {
  appearance?: 'underline' | 'bare';
  textRole?: 'body' | 'title' | 'code' | 'caption';
  min?: string;
  max?: string;
  step?: number;
  type?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'password' | 'date' | 'time' | 'datetime-local';
}
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  // TextField merges these relationships with its label/help/error slots.
  // Repeating a consumer relationship on Input overrides that merged context.
  const nativeAttributes = Object.fromEntries(
    Object.entries(inputAttributes(props)).filter(
      ([key]) => !['aria-label', 'aria-labelledby', 'aria-describedby'].includes(key),
    ),
  );
  return (
    <TextField
      {...fieldAccessibility(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      data-geul-input-appearance={props.appearance}
      data-geul-input-text-role={props.textRole}
      value={props.value === undefined ? undefined : String(props.value)}
      defaultValue={props.defaultValue === undefined ? undefined : String(props.defaultValue)}
      type={props.type}
      name={props.name}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        {props.leftSection ? <span className={classes.section}>{props.leftSection}</span> : null}
        <Input
          {...nativeAttributes}
          aria-invalid={props.error ? true : props['aria-invalid']}
          id={props.id}
          ref={ref}
          className={classes.input}
          placeholder={props.placeholder}
          autoComplete={props.autoComplete}
          min={props.min}
          max={props.max}
          step={props.step}
          required={props.required}
          inputMode={props.inputMode}
          maxLength={props.maxLength}
          minLength={props.minLength}
          pattern={props.pattern}
          spellCheck={props.spellCheck}
          onChange={props.onChange}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
          onClick={props.onClick}
          onCompositionStart={props.onCompositionStart}
          onCompositionEnd={props.onCompositionEnd}
        />
        {props.rightSection ? <span className={classes.section}>{props.rightSection}</span> : null}
      </Group>
      <InputHelp {...props} />
    </TextField>
  );
});
TextInput.displayName = 'TextInput';
