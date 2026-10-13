'use client';

import { forwardRef, useId, useRef, type ChangeEventHandler, type ChangeEvent, type ReactNode } from 'react';
import { Checkbox as AriaCheckbox, CheckboxGroup } from 'react-aria-components';
import { IconCheck, IconMinus } from '@tabler/icons-react';
import { inputAttributes, type InputBaseProps } from './input-contract';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import classes from './Input.module.css';
export interface CheckboxProps extends InputBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}
const CheckboxControl = forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const localRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const id = props.id ?? uid;
  const descriptionId = props.description ? `${id}-description` : undefined;
  const errorId = props.error && typeof props.error !== 'boolean' ? `${id}-error` : undefined;
  const describedBy = [props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const clickRef = useRef<React.MouseEvent<HTMLSpanElement> | null>(null);
  return (
    // Event adapter observes the nested RAC checkbox; it does not create a second interactive target.
    <span
      className={classes.choiceWrapper}
      onClickCapture={(event) => {
        clickRef.current = event;
      }}
      onFocusCapture={(event) =>
        props.onFocus?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
      onBlurCapture={(event) =>
        props.onBlur?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
      onKeyDownCapture={(event) =>
        props.onKeyDown?.({ ...event, currentTarget: event.target } as React.KeyboardEvent<HTMLInputElement>)
      }
      onKeyUpCapture={(event) =>
        props.onKeyUp?.({ ...event, currentTarget: event.target } as React.KeyboardEvent<HTMLInputElement>)
      }
    >
      <AriaCheckbox
        {...inputAttributes(props)}
        aria-describedby={describedBy}
        onClick={() => {
          const event = clickRef.current;
          if (!event || !props.onClick) {
            return;
          }
          const click = new Proxy(event, {
            get(target, key) {
              if (key === 'currentTarget' || key === 'target') {
                return localRef.current;
              }
              const value = Reflect.get(target, key);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
          props.onClick(click as unknown as React.MouseEvent<HTMLInputElement>);
        }}
        onChange={(checked) => {
          const input = localRef.current;
          if (!input || !props.onChange) {
            return;
          }
          input.checked = checked;
          const nativeEvent = new Event('change', { bubbles: true });
          props.onChange({
            target: input,
            currentTarget: input,
            nativeEvent,
            type: 'change',
            preventDefault: () => nativeEvent.preventDefault(),
            stopPropagation: () => nativeEvent.stopPropagation(),
            isDefaultPrevented: () => nativeEvent.defaultPrevented,
            isPropagationStopped: () => nativeEvent.cancelBubble,
            persist() {},
          } as ChangeEvent<HTMLInputElement>);
        }}
        id={props.id}
        className={`${classes.choice} ${classes.checkbox}`}
        data-geul-input
        data-geul-input-size={presentation.size ?? 'sm'}
        data-geul-input-density={presentation.density}
        data-geul-input-grow={props.grow || undefined}
        data-geul-input-labeled={Boolean(props.label) || undefined}
        isDisabled={props.disabled}
        isReadOnly={props.readOnly}
        isRequired={props.required}
        isInvalid={Boolean(props.error)}
        isSelected={props.checked}
        defaultSelected={props.defaultChecked}
        isIndeterminate={props.indeterminate}
        name={props.name}
        value={props.value}
        inputRef={(input) => {
          localRef.current = input;
          if (typeof ref === 'function') {
            ref(input);
          } else if (ref) {
            ref.current = input;
          }
        }}
      >
        <span className={classes.check} aria-hidden>
          {props.indeterminate ? <IconMinus aria-hidden /> : <IconCheck aria-hidden />}
        </span>
        {props.label}
      </AriaCheckbox>
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
    </span>
  );
});
CheckboxControl.displayName = 'Checkbox';

export interface CheckboxGroupProps extends InputBaseProps {
  children: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
}
function Group(props: CheckboxGroupProps) {
  const presentation = useToolbarInputPresentation(props);
  return (
    <CheckboxGroup
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={props.value}
      defaultValue={props.defaultValue}
      onChange={props.onChange}
      onFocus={(event) =>
        props.onFocus?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
      onBlur={(event) =>
        props.onBlur?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
    >
      <InputLabel {...props} />
      {props.children}
      <InputHelp {...props} />
    </CheckboxGroup>
  );
}
export const Checkbox = Object.assign(CheckboxControl, { Group });
