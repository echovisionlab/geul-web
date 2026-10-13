'use client';

import { forwardRef, useId, useRef, type ChangeEventHandler, type ChangeEvent, type ReactNode } from 'react';
import { Switch as AriaSwitch } from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { useToolbarInputPresentation } from './InputParts';
export interface SwitchProps extends InputBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onLabel?: ReactNode;
  offLabel?: ReactNode;
}
const SwitchControl = forwardRef<HTMLInputElement, SwitchProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const localRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const id = props.id ?? uid;
  const descriptionId = props.description ? `${id}-description` : undefined;
  const errorId = props.error && typeof props.error !== 'boolean' ? `${id}-error` : undefined;
  const describedBy = [props['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <span
      className={classes.choiceWrapper}
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
      <AriaSwitch
        {...inputAttributes({ ...props, 'aria-required': undefined, 'aria-invalid': undefined })}
        aria-describedby={describedBy}
        // RAC label presses toggle state without a native input change event.
        // Adapt its confirmed value, as the Checkbox adapter does.
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
        className={classes.choice}
        data-geul-input
        data-geul-input-size={presentation.size ?? 'sm'}
        data-geul-input-density={presentation.density}
        data-geul-input-animate={props.animate === false ? 'false' : undefined}
        data-geul-input-grow={props.grow || undefined}
        isDisabled={props.disabled}
        isReadOnly={props.readOnly}
        isSelected={props.checked}
        defaultSelected={props.defaultChecked}
        name={props.name}
        value={props.value}
        inputRef={(input) => {
          localRef.current = input;
          // RAC Switch forwards these field states to its outer label, not its
          // native switch input. Keep semantics on the actual control without
          // enabling a different visual state or native validation UI.
          if (input) {
            const invalid = props.error ? 'true' : props['aria-invalid'];
            if (invalid !== undefined) {
              input.setAttribute('aria-invalid', String(invalid));
            } else {
              input.removeAttribute('aria-invalid');
            }
            const required = props.required ?? props['aria-required'];
            if (required !== undefined) {
              input.setAttribute('aria-required', String(required));
            } else {
              input.removeAttribute('aria-required');
            }
          }
          if (typeof ref === 'function') {
            ref(input);
          } else if (ref) {
            ref.current = input;
          }
        }}
      >
        {({ isSelected }) => (
          <>
            <span className={classes.switchTrack} aria-hidden>
              <span className={classes.switchThumb} />
            </span>
            {(isSelected ? props.onLabel : props.offLabel) ? (
              <span aria-hidden>{isSelected ? props.onLabel : props.offLabel}</span>
            ) : null}
            {props.label}
          </>
        )}
      </AriaSwitch>
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
SwitchControl.displayName = 'Switch';
export const Switch = SwitchControl;
