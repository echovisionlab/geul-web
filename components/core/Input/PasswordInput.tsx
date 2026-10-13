'use client';

import { forwardRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { TextInput, type TextInputProps } from './TextInput';
import classes from './Input.module.css';
import { useCoreInputLabels } from './input-labels';
import { InputVisibilityGlyph } from './InputGlyphs';
export interface PasswordInputProps extends Omit<TextInputProps, 'type' | 'rightSection'> {
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  visibilityToggleLabel?: string;
}
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>((props, ref) => {
  const labels = useCoreInputLabels();
  const [visible, setVisible] = useState(props.defaultVisible ?? false);
  const current = props.visible ?? visible;
  return (
    <TextInput
      {...props}
      ref={ref}
      type={current ? 'text' : 'password'}
      rightSection={
        <Button
          className={classes.accessory}
          isDisabled={props.disabled}
          aria-label={props.visibilityToggleLabel ?? (current ? labels.hidePassword : labels.showPassword)}
          aria-pressed={current}
          onPress={() => {
            setVisible(!current);
            props.onVisibilityChange?.(!current);
          }}
        >
          <InputVisibilityGlyph visible={current} />
        </Button>
      }
    />
  );
});
PasswordInput.displayName = 'PasswordInput';
