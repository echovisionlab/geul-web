'use client';

import { forwardRef } from 'react';
import { Button, Group, Input, NumberField } from 'react-aria-components';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
export interface NumberInputProps extends InputBaseProps {
  value?: number | string;
  defaultValue?: number | string;
  onChange?: (value: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
  decimalScale?: number;
  allowNegative?: boolean;
  allowDecimal?: boolean;
  hideControls?: boolean;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}
function numberValue(value: number | string | undefined) {
  return value === undefined ? undefined : value === '' ? Number.NaN : Number(value);
}
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  return (
    <NumberField
      {...inputAttributes(props)}
      {...inputState(props)}
      {...inputPresentation(presentation)}
      value={numberValue(props.value)}
      defaultValue={numberValue(props.defaultValue)}
      onChange={(value) => props.onChange?.(Number.isNaN(value) ? '' : value)}
      minValue={props.allowNegative === false ? Math.max(0, props.min ?? 0) : props.min}
      maxValue={props.max}
      step={props.step}
      formatOptions={{ maximumFractionDigits: props.allowDecimal === false ? 0 : (props.decimalScale ?? 20) }}
    >
      <InputLabel {...props} />
      <Group className={classes.wrapper}>
        {props.prefix ? <span className={classes.section}>{props.prefix}</span> : null}
        <Input
          ref={ref}
          id={props.id}
          className={classes.input}
          placeholder={props.placeholder}
          onFocus={props.onFocus}
          onBlur={props.onBlur}
          onKeyDown={props.onKeyDown}
          onKeyUp={props.onKeyUp}
          onClick={props.onClick}
          onCompositionStart={props.onCompositionStart}
          onCompositionEnd={props.onCompositionEnd}
        />
        {props.suffix ? <span className={classes.section}>{props.suffix}</span> : null}
        {!props.hideControls ? (
          <>
            <Button slot="decrement" className={classes.accessory}>
              −
            </Button>
            <Button slot="increment" className={classes.accessory}>
              +
            </Button>
          </>
        ) : null}
      </Group>
      <InputHelp {...props} />
    </NumberField>
  );
});
NumberInput.displayName = 'NumberInput';
