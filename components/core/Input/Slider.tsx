'use client';

import type { ReactNode, CSSProperties } from 'react';
import { Label, Slider as AriaSlider, SliderOutput, SliderThumb, SliderTrack } from 'react-aria-components';
import { inputAttributes, type InputBaseProps } from './input-contract';
import classes from './Input.module.css';
import { useToolbarInputPresentation } from './InputParts';
export interface SliderProps extends Omit<InputBaseProps, 'label'> {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  thumbLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  marks?: readonly { value: number; label?: ReactNode }[];
  label?: ReactNode | ((value: number) => ReactNode);
  showLabelOnHover?: boolean;
  labelAlwaysOn?: boolean;
}
export function Slider(props: SliderProps) {
  const presentation = useToolbarInputPresentation(props);
  return (
    <AriaSlider
      {...inputAttributes(props)}
      className={classes.slider}
      data-geul-input
      data-geul-input-density={presentation.density}
      data-geul-input-grow={props.grow || undefined}
      data-geul-input-size={presentation.size ?? 'sm'}
      data-geul-input-value-hint={props.showLabelOnHover || undefined}
      value={props.value}
      defaultValue={props.defaultValue}
      minValue={props.min}
      maxValue={props.max}
      step={props.step}
      onChange={props.onChange}
      onChangeEnd={props.onChangeEnd}
      isDisabled={props.disabled || props.readOnly}
      aria-label={
        props['aria-label'] ?? props.thumbLabel ?? (typeof props.label === 'string' ? props.label : undefined)
      }
    >
      {props.label && typeof props.label !== 'function' ? <Label className={classes.label}>{props.label}</Label> : null}
      <SliderTrack className={classes.sliderTrack}>
        <SliderThumb className={classes.sliderThumb} />
      </SliderTrack>
      {props.labelAlwaysOn || props.showLabelOnHover ? (
        <SliderOutput className={props.labelAlwaysOn ? classes.description : classes.sliderHint}>
          {({ state }) =>
            typeof props.label === 'function' ? props.label(state.values[0]) : state.getThumbValueLabel(0)
          }
        </SliderOutput>
      ) : null}
      {props.marks ? (
        <div className={classes.marks}>
          {props.marks.map((mark) => (
            <span
              key={mark.value}
              style={
                {
                  insetInlineStart: `${Math.max(0, Math.min(100, ((mark.value - (props.min ?? 0)) / ((props.max ?? 100) - (props.min ?? 0) || 1)) * 100))}%`,
                } as CSSProperties
              }
            >
              {mark.label ?? mark.value}
            </span>
          ))}
        </div>
      ) : null}
    </AriaSlider>
  );
}
