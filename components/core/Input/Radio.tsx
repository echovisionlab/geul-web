'use client';

import { forwardRef, type ReactNode } from 'react';
import { Radio as AriaRadio, RadioGroup } from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import classes from './Input.module.css';
export interface RadioProps extends InputBaseProps {
  value: string;
}
export interface RadioGroupProps extends InputBaseProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}
const RadioControl = forwardRef<HTMLInputElement, RadioProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  return (
    <AriaRadio
      {...inputAttributes(props)}
      inputRef={ref}
      id={props.id}
      data-geul-input
      data-geul-input-size={presentation.size ?? 'sm'}
      data-geul-input-animate={props.animate === false ? 'false' : undefined}
      className={classes.choice}
      value={props.value}
      isDisabled={props.disabled}
    >
      <span className={classes.radio} aria-hidden />
      {props.label}
    </AriaRadio>
  );
});
RadioControl.displayName = 'Radio';
function Group(props: RadioGroupProps) {
  const presentation = useToolbarInputPresentation(props);
  return (
    <RadioGroup
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={props.value}
      defaultValue={props.defaultValue}
      onChange={props.onChange}
      orientation={props.orientation}
      onFocus={(event) =>
        props.onFocus?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
      onBlur={(event) =>
        props.onBlur?.({ ...event, currentTarget: event.target } as React.FocusEvent<HTMLInputElement>)
      }
    >
      <InputLabel {...props} />
      <div className={classes.choiceGroup} data-geul-input-orientation={props.orientation ?? 'vertical'}>
        {props.children}
      </div>
      <InputHelp {...props} />
    </RadioGroup>
  );
}
export const Radio = Object.assign(RadioControl, { Group });
