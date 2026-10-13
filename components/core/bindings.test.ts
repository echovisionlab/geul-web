import { expect, it, vi } from 'vitest';
import { fieldBindings, interactionBindings, componentBindings } from './bindings';
it('projects values and form callbacks while rejecting every consumer skin and state marker', () => {
  const onChange = vi.fn();
  expect(
    fieldBindings({
      value: 'Draft',
      onChange,
      error: 'Required',
      style: { color: 'pink' },
      className: 'private',
      size: 99,
      'data-geul-input': 'fake',
    }),
  ).toEqual({ value: 'Draft', onChange, error: 'Required' });
});
it('keeps drag keyboard and pointer sensors without presentation or internal state', () => {
  const onPointerDown = vi.fn(),
    onKeyDown = vi.fn();
  expect(
    interactionBindings({
      role: 'button',
      tabIndex: 0,
      'aria-roledescription': 'sortable',
      onPointerDown,
      onKeyDown,
      className: 'private',
      style: { cursor: 'grab' },
      size: 9,
      'data-tone': 'danger',
      'data-core-control': 'fake',
    }),
  ).toEqual({ role: 'button', tabIndex: 0, 'aria-roledescription': 'sortable', onPointerDown, onKeyDown });
  expect(interactionBindings(undefined)).toEqual({});
});

it('filters JS-only skins from an otherwise closed component forwarder', () => {
  const props = {
    value: 'Draft',
    style: { color: 'red' },
    'data-core-control': 'fake',
  } as unknown as import('./Input').TextInputProps;
  expect(componentBindings(props)).toEqual({ value: 'Draft' });
});
it('retains native email and keyboard affordances in typed component forwarding', () => {
  const onKeyDown = vi.fn();
  const props = { value: '', onKeyDown, inputMode: 'email' as const, spellCheck: false, 'data-1p-ignore': 'true' };
  expect(componentBindings(props as import('./Input').TextInputProps)).toEqual(props);
});
