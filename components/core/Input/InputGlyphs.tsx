import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconX,
  type Icon,
} from '@tabler/icons-react';
import spinnerClasses from '../Spinner.module.css';
import classes from './Input.module.css';

/**
 * Input accessory glyphs: one 16px size and one 1.5 stroke, so every affordance inside a field
 * matches the 1px field line. Accessory buttons own the accessible names.
 */
function InputGlyph({ icon: Glyph, kind }: { icon: Icon; kind: string }) {
  return <Glyph className={classes.glyph} stroke={1.5} data-geul-input-glyph={kind} aria-hidden focusable="false" />;
}

/** Opening affordance for select-like inputs; it turns while the input's popover is open. */
export function InputOpenGlyph() {
  return <InputGlyph icon={IconChevronDown} kind="open" />;
}

/** Clear and remove affordance. */
export function InputClearGlyph() {
  return <InputGlyph icon={IconX} kind="clear" />;
}

/** Date picker affordance. */
export function InputCalendarGlyph() {
  return <InputGlyph icon={IconCalendar} kind="calendar" />;
}

/** Password visibility affordance; `visible` shows the "hide" glyph. */
export function InputVisibilityGlyph({ visible }: { visible: boolean }) {
  return <InputGlyph icon={visible ? IconEyeOff : IconEye} kind="visibility" />;
}

/** Asynchronous validation state: a calm spinner, a check, or an alert mark. */
export function InputValidationGlyph({ status }: { status: 'checking' | 'valid' | 'invalid' | 'error' }) {
  if (status === 'checking') {
    return (
      <span className={`${spinnerClasses.spinner} ${classes.glyph}`} data-geul-input-glyph="checking" aria-hidden />
    );
  }
  return <InputGlyph icon={status === 'valid' ? IconCheck : IconAlertCircle} kind={status} />;
}
