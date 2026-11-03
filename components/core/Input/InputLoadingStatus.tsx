'use client';

import { InputValidationGlyph } from './InputGlyphs';
import { useCoreInputLabels } from './input-labels';
import classes from './Input.module.css';

/** Option lookup status shared by choice fields; it names itself so the field name stays unchanged. */
export function InputLoadingStatus({ label }: { label?: string }) {
  const labels = useCoreInputLabels();
  return (
    <span className={classes.validationStatus} role="status" aria-label={label ?? labels.loading}>
      <InputValidationGlyph status="checking" />
    </span>
  );
}
