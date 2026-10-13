'use client';

import { forwardRef, type ChangeEventHandler, type FocusEventHandler, type KeyboardEventHandler } from 'react';
import { Group, TextArea, TextField } from 'react-aria-components';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { inputAttributes, type InputBaseProps, type TextValueProps } from './input-contract';
import classes from './Input.module.css';
export interface TextareaProps
  extends Omit<InputBaseProps, 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'>, Omit<TextValueProps, 'onChange'> {
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  onKeyUp?: KeyboardEventHandler<HTMLTextAreaElement>;
  textRole?: 'body' | 'code';
  rows?: number;
  autosize?: boolean;
  minRows?: number;
  maxRows?: number;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  return (
    <TextField
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      data-geul-input-text-role={props.textRole}
      value={props.value === undefined ? undefined : String(props.value)}
      defaultValue={props.defaultValue === undefined ? undefined : String(props.defaultValue)}
      name={props.name}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        <TextArea
          id={props.id}
          ref={ref}
          className={`${classes.input} ${classes.textarea}`}
          rows={props.rows ?? props.minRows ?? 3}
          data-geul-input-autosize={props.autosize || undefined}
          style={
            props.autosize
              ? {
                  minHeight: `${props.minRows ?? props.rows ?? 3}lh`,
                  maxHeight: props.maxRows ? `${props.maxRows}lh` : undefined,
                }
              : undefined
          }
          placeholder={props.placeholder}
          maxLength={props.maxLength}
          minLength={props.minLength}
          autoComplete={props.autoComplete}
          spellCheck={props.spellCheck}
          onChange={props.onChange}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
        />
      </Group>
      <InputHelp {...props} />
    </TextField>
  );
});
Textarea.displayName = 'Textarea';
