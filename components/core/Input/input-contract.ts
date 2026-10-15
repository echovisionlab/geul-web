import type {
  AriaAttributes,
  ChangeEventHandler,
  CompositionEventHandler,
  MouseEventHandler,
  FocusEventHandler,
  KeyboardEventHandler,
  ReactNode,
} from 'react';
import type { ClosedVisualProps } from '../visual-contract';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type InputDensity = 'comfortable' | 'compact';
export interface InputBaseProps extends AriaAttributes, ClosedVisualProps {
  id?: string;
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: InputSize;
  density?: InputDensity;
  animate?: boolean;
  grow?: boolean;
  autoFocus?: boolean;
  form?: string;
  hidden?: boolean;
  title?: string;
  tabIndex?: number;
  onClick?: MouseEventHandler<HTMLInputElement>;
  onCompositionStart?: CompositionEventHandler<HTMLInputElement>;
  onCompositionEnd?: CompositionEventHandler<HTMLInputElement>;
  onFocus?: FocusEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: KeyboardEventHandler<HTMLInputElement>;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  style?: never;
  styles?: never;
  className?: never;
  classNames?: never;
  vars?: never;
  unstyled?: never;
  radius?: never;
  variant?: never;
  [key: `data-${string}`]: string | number | boolean | undefined;
  [key: `data-geul-${string}`]: undefined;
  [key: `data-core-${string}`]: undefined;
}
export interface TextValueProps {
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  spellCheck?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}
export interface InputOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface InputOptionGroup {
  group: string;
  items: readonly (string | InputOption)[];
}
export type InputOptions = readonly (string | InputOption | InputOptionGroup)[];
export function flattenOptions(data: InputOptions = []): InputOption[] {
  return data.flatMap((item) =>
    typeof item === 'string'
      ? [{ value: item, label: item }]
      : 'group' in item
        ? item.items.map((option) => (typeof option === 'string' ? { value: option, label: option } : option))
        : [item],
  );
}
const safeKeys = new Set(['name', 'title', 'form', 'hidden', 'tabIndex', 'autoFocus']);
/** Project external attributes; no external presentation props or reserved state attributes survive a JS spread. */
export function inputAttributes(props: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(props).filter(
      ([key, value]) =>
        !key.startsWith('data-geul-') &&
        !key.startsWith('data-core-') &&
        (safeKeys.has(key) || key.startsWith('aria-') || key.startsWith('data-')) &&
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === undefined),
    ),
  );
}

export function fieldAccessibility(props: InputBaseProps) {
  return {
    'aria-label': props['aria-label'],
    'aria-labelledby': props['aria-labelledby'],
    'aria-describedby': props['aria-describedby'],
  };
}
