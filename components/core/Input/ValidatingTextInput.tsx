'use client';

import { TextInput, type TextInputProps } from './TextInput';
import classes from './Input.module.css';
import { InputValidationGlyph } from './InputGlyphs';
export type TextValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';
export interface ValidatingTextInputProps extends TextInputProps {
  status?: TextValidationStatus;
  statusLabel?: string;
}
/** Validation and persistence remain in the Feature controller. */
export function ValidatingTextInput({ status = 'idle', statusLabel, ...props }: ValidatingTextInputProps) {
  return (
    <TextInput
      {...props}
      aria-busy={status === 'checking' || props['aria-busy']}
      rightSection={
        status === 'idle' ? (
          props.rightSection
        ) : (
          <span
            className={classes.validationStatus}
            data-geul-input-status={status}
            role={statusLabel ? 'status' : undefined}
            aria-label={statusLabel}
            aria-hidden={!statusLabel}
          >
            <InputValidationGlyph status={status} />
          </span>
        )
      }
    />
  );
}
