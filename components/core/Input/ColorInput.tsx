'use client';
import { forwardRef, useContext, useState } from 'react';
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorPickerStateContext,
  parseColor,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem,
  ColorThumb,
  Dialog,
  DialogTrigger,
  Group,
  Input,
  Label,
  Popover,
  SliderTrack,
} from 'react-aria-components';
import { InputHelp, InputLabel, inputPresentation, inputState, useToolbarInputPresentation } from './InputParts';
import { inputAttributes, type InputBaseProps } from './input-contract';
import { useCoreInputLabels } from './input-labels';
import classes from './Input.module.css';
export interface ColorInputProps extends InputBaseProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  format?: 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla';
  swatches?: readonly string[];
  withPicker?: boolean;
  withEyeDropper?: boolean;
}
function EyeDropperControl({ label }: { label: string }) {
  const state = useContext(ColorPickerStateContext);
  const [pending, setPending] = useState(false);
  const EyeDropper =
    typeof window === 'undefined'
      ? undefined
      : (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
  return EyeDropper ? (
    <Button
      className={classes.accessory}
      aria-label={label}
      isDisabled={pending}
      onPress={async () => {
        setPending(true);
        try {
          const color = await new EyeDropper().open();
          state?.setColor(parseColor(color.sRGBHex));
        } catch {
          /* Native picker cancellation leaves the existing color intact. */
        } finally {
          setPending(false);
        }
      }}
    >
      ⌖
    </Button>
  ) : null;
}
export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>((props, ref) => {
  const presentation = useToolbarInputPresentation(props);
  const labels = useCoreInputLabels();
  return (
    <ColorPicker
      value={props.value}
      defaultValue={props.defaultValue}
      onChange={(color) => props.onChange?.(color.toString(props.format ?? 'hex'))}
    >
      <ColorField {...inputAttributes(props)} {...inputState(props)} {...inputPresentation(presentation)}>
        <InputLabel {...props} />
        <Group className={classes.wrapper}>
          <Input ref={ref} id={props.id} className={classes.input} placeholder={props.placeholder} />
          {props.withPicker !== false ? (
            <DialogTrigger>
              <Button
                className={classes.accessory}
                isDisabled={props.disabled || props.readOnly}
                aria-label={labels.color}
              >
                <ColorSwatch className={classes.swatch} />
              </Button>
              <Popover className={classes.popover}>
                <Dialog className={classes.colorDialog} aria-label={labels.color}>
                  <ColorArea className={classes.colorArea} colorSpace="hsb" xChannel="saturation" yChannel="brightness">
                    <ColorThumb className={classes.colorThumb} />
                  </ColorArea>
                  <ColorSlider channel="hue" colorSpace="hsb" className={classes.slider}>
                    <Label className={classes.label} />
                    <SliderTrack className={classes.colorTrack}>
                      <ColorThumb className={classes.colorThumb} />
                    </SliderTrack>
                  </ColorSlider>
                  {props.format === 'hexa' || props.format === 'rgba' || props.format === 'hsla' ? (
                    <ColorSlider channel="alpha" className={classes.slider}>
                      <Label className={classes.label} />
                      <SliderTrack className={classes.colorTrack}>
                        <ColorThumb className={classes.colorThumb} />
                      </SliderTrack>
                    </ColorSlider>
                  ) : null}
                  {props.withEyeDropper ? <EyeDropperControl label={labels.color} /> : null}
                  {props.swatches ? (
                    <ColorSwatchPicker className={classes.swatches}>
                      {[...new Set(props.swatches)].map((color) => (
                        <ColorSwatchPickerItem key={color} color={color} className={classes.swatchOption}>
                          <ColorSwatch className={classes.swatch} />
                        </ColorSwatchPickerItem>
                      ))}
                    </ColorSwatchPicker>
                  ) : null}
                </Dialog>
              </Popover>
            </DialogTrigger>
          ) : (
            <ColorSwatch className={classes.swatch} />
          )}
        </Group>
        <InputHelp {...props} />
      </ColorField>
    </ColorPicker>
  );
});
ColorInput.displayName = 'ColorInput';
