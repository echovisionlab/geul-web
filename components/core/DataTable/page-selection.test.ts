import { expect, it } from 'vitest';
import { nextPageSelection } from './selection';

it.each([
  [true, ['off-page', 'disabled', 'folder', 'one', 'two']],
  [false, ['off-page', 'disabled', 'folder']],
])('changes only selectable current-page keys when checked=%s', (checked, expected) => {
  const selected = ['off-page', 'disabled', 'folder', 'one'];
  const selectable = ['one', 'two'];

  expect(nextPageSelection(selected, selectable, checked)).toEqual(expected);
  expect(selected).toEqual(['off-page', 'disabled', 'folder', 'one']);
  expect(selectable).toEqual(['one', 'two']);
});

it.each([true, false])('preserves selection when no current-page rows are selectable and checked=%s', (checked) => {
  expect(nextPageSelection(['off-page', 'disabled'], [], checked)).toEqual(['off-page', 'disabled']);
});
