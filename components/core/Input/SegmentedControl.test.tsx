// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
it('names each icon-only option on the native radio while preserving its displayed content', () => {
  const change = vi.fn();
  act(() =>
    root.render(
      <SegmentedControl
        aria-label="View mode"
        defaultValue="visual"
        onChange={change}
        data={[
          { value: 'visual', label: <span aria-hidden>▦</span>, accessibleLabel: 'Visual' },
          { value: 'source', label: <span aria-hidden>⌘</span>, accessibleLabel: 'Source' },
          { value: 'locked', label: <span aria-hidden>×</span>, accessibleLabel: 'Locked', disabled: true },
        ]}
      />,
    ),
  );
  const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios).toHaveLength(3);
  expect(radios[0]).toHaveAccessibleName('Visual');
  expect(radios[1]).toHaveAccessibleName('Source');
  expect(radios[2]).toHaveAccessibleName('Locked');
  expect(radios[0]).toBeChecked();
  expect(radios[2]).toBeDisabled();
  expect(container.textContent).toBe('▦⌘×');
  act(() => radios[1].click());
  expect(change).toHaveBeenCalledExactlyOnceWith('source');
  expect(radios[1]).toBeChecked();
});
it('retains visible text as the name when no separate icon label is supplied', () => {
  act(() => root.render(<SegmentedControl aria-label="Layout" data={['Grid', { value: 'list', label: 'List' }]} />));
  const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios[0]).toHaveAccessibleName('Grid');
  expect(radios[1]).toHaveAccessibleName('List');
});
it('owns icon-only options: named radios, hidden glyphs, a hover hint and no extra tab stop', () => {
  act(() =>
    root.render(
      <SegmentedControl
        aria-label="View"
        defaultValue="grid"
        data={[
          { value: 'grid', icon: <svg data-testid="grid-icon" />, accessibleLabel: 'Grid view' },
          { value: 'list', icon: <svg data-testid="list-icon" />, accessibleLabel: 'List view' },
        ]}
      />,
    ),
  );
  const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios[0]).toHaveAccessibleName('Grid view');
  expect(radios[1]).toHaveAccessibleName('List view');
  expect(container.textContent).toBe('');
  const segments = container.querySelectorAll<HTMLElement>('[data-geul-segment-kind="icon"]');
  expect(segments).toHaveLength(2);
  const glyph = container.querySelector('[data-testid="grid-icon"]')!.parentElement!;
  expect(glyph.getAttribute('aria-hidden')).toBe('true');
  expect(glyph.getAttribute('style')).toBeNull();
  expect(container.querySelectorAll('[tabindex="0"]:not(input)')).toHaveLength(0);
});
it('rejects an icon-only option without an accessible label', () => {
  const unnamed = { value: 'grid', icon: <svg />, accessibleLabel: ' ' };
  expect(() => act(() => root.render(<SegmentedControl aria-label="View" data={[unnamed]} />))).toThrow(
    'accessibleLabel',
  );
});
