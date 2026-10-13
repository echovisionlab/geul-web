import { visualEscapeProperties, type ClosedVisualProps } from './visual-contract';
/** Form adapters supply data and callbacks; visual configuration stays on the Core component. */
type FieldKey =
  | 'value'
  | 'defaultValue'
  | 'checked'
  | 'defaultChecked'
  | 'onChange'
  | 'onFocus'
  | 'onBlur'
  | 'error'
  | 'required'
  | 'disabled'
  | 'readOnly'
  | 'name'
  | 'id';
const fieldKeys = new Set<FieldKey>([
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'onChange',
  'onFocus',
  'onBlur',
  'error',
  'required',
  'disabled',
  'readOnly',
  'name',
  'id',
]);
export type FieldBindings<T extends object> = Pick<T, FieldKey & keyof T> & ClosedVisualProps;
export function fieldBindings<T extends object>(source: T | null | undefined): FieldBindings<T> {
  return Object.fromEntries(
    Object.entries(source ?? {}).filter(([key]) => fieldKeys.has(key as FieldKey)),
  ) as FieldBindings<T>;
}
type InteractionKey = `aria-${string}` | `on${string}` | 'role' | 'tabIndex' | 'id' | 'title' | 'draggable';
export type InteractionBindings<T extends object> = {
  [K in keyof T as K extends InteractionKey ? K : never]: T[K];
} & ClosedVisualProps;
/** Drag sensors may bind native interaction, never control sizes, styles or internal state markers. */
export function interactionBindings<T extends object>(source: T | null | undefined): InteractionBindings<T> {
  return Object.fromEntries(
    Object.entries(source ?? {}).filter(
      ([key]) =>
        ['role', 'tabIndex', 'id', 'title', 'draggable'].includes(key) ||
        key.startsWith('aria-') ||
        /^on[A-Z]/.test(key),
    ),
  ) as InteractionBindings<T>;
}

const forbiddenVisualKeys: ReadonlySet<string> = new Set(visualEscapeProperties);
/** Forward a closed Core-derived contract without reopening its presentation boundary at runtime. */
export function componentBindings<T extends ClosedVisualProps>(source: T): T {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !forbiddenVisualKeys.has(key) && !key.startsWith('data-geul-') && !key.startsWith('data-core-'),
    ),
  ) as T;
}
