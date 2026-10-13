// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Field } from '../Field';
import { SegmentedControl } from './SegmentedControl';
import classes from './Input.module.css';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(node: ReactNode) {
  act(() => root.render(node));
}
function expectResolvedDescriptions(element: Element) {
  const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) {
    expect(document.getElementById(id)).not.toBeNull();
  }
}
it('connects standalone required, description and error outside the bordered option area', () => {
  render(
    <>
      <span id="external">Existing guidance</span>
      <SegmentedControl
        id="mode"
        label="View"
        data={['Grid', 'List']}
        required
        description="Choose a layout"
        error="Layout unavailable"
        aria-describedby="external"
      />
    </>,
  );
  const group = host.querySelector('[role="radiogroup"]')!;
  const selection = group.querySelector(`.${classes.segments}`)!;
  expect(group).toHaveAttribute('id', 'mode');
  expect(group).toHaveAttribute('aria-required', 'true');
  expect(group).toHaveAttribute('aria-invalid', 'true');
  expect(group).toHaveAccessibleDescription(/Existing guidance/);
  expect(group).toHaveAccessibleDescription(/Choose a layout/);
  expect(group).toHaveAccessibleDescription(/Layout unavailable/);
  expectResolvedDescriptions(group);
  expect(selection.textContent).toBe('GridList');
  expect(group.textContent).toBe('GridListChoose a layoutLayout unavailable');
  for (const input of group.querySelectorAll('input')) {
    expectResolvedDescriptions(input);
    expect(input).toHaveAccessibleDescription(/Existing guidance/);
    expect(input).toHaveAccessibleDescription(/Choose a layout/);
    expect(input).toHaveAccessibleDescription(/Layout unavailable/);
  }
});
it('consumes parent Field state and relationships without repeating its visible guidance or error', () => {
  render(
    <Field label="View" description="Choose a layout" error="Layout unavailable" required>
      <SegmentedControl aria-label="View" data={['Grid', 'List']} />
    </Field>,
  );
  const group = host.querySelector('[role="radiogroup"]')!;
  expect(group).toHaveAccessibleName('View');
  expect(group).toHaveAttribute('aria-required', 'true');
  expect(group).toHaveAttribute('aria-invalid', 'true');
  expect(group).toHaveAccessibleDescription('Choose a layout Layout unavailable');
  expectResolvedDescriptions(group);
  expect(group).toHaveClass(classes.segments);
  expect(group.textContent).toBe('GridList');
  expect(host.textContent?.split('Choose a layout')).toHaveLength(2);
  expect(host.textContent?.split('Layout unavailable')).toHaveLength(2);
  for (const input of group.querySelectorAll('input')) {
    expectResolvedDescriptions(input);
    expect(input).toHaveAccessibleDescription(/Choose a layout/);
    expect(input).toHaveAccessibleDescription(/Layout unavailable/);
  }
});
it('removes invalid state and obsolete local help relationships when the owner clears them', () => {
  render(
    <SegmentedControl
      label="View"
      data={['Grid', 'List']}
      description="Choose a layout"
      error="Layout unavailable"
      required
    />,
  );
  render(<SegmentedControl label="View" data={['Grid', 'List']} />);
  const group = host.querySelector('[role="radiogroup"]')!;
  expect(group).not.toHaveAttribute('aria-invalid');
  expect(group).not.toHaveAttribute('aria-required');
  expect(group).toHaveAccessibleDescription('');
  expect(group).toHaveClass(classes.segments);
  expect(group.querySelector(`.${classes.segments}`)).toBeNull();
  expect(group.querySelectorAll(':scope > label')).toHaveLength(2);
});
it('keeps boolean Core error authoritative without inventing error copy or changing the option structure', () => {
  render(<SegmentedControl label="View" data={['Grid', 'List']} error aria-invalid={false} />);
  const group = host.querySelector('[role="radiogroup"]')!;
  expect(group).toHaveAttribute('aria-invalid', 'true');
  expect(group).toHaveClass(classes.segments);
  expect(group.textContent).toBe('GridList');
});
it.each(['disabled', 'readOnly'] as const)(
  'keeps %s selection and full-width vertical options intact when help is rendered',
  (state) => {
    const change = vi.fn();
    render(
      <SegmentedControl
        label="View"
        data={['Grid', 'List']}
        description="Choose a layout"
        defaultValue="Grid"
        fullWidth
        orientation="vertical"
        onChange={change}
        {...{ [state]: true }}
      />,
    );
    const group = host.querySelector('[role="radiogroup"]')!;
    const selection = group.querySelector(`.${classes.segments}`)!;
    expect(selection).toHaveAttribute('data-geul-input-full', 'true');
    expect(selection).toHaveAttribute('data-geul-input-orientation', 'vertical');
    expect(selection.hasAttribute('data-disabled')).toBe(state === 'disabled');
    const inputs = group.querySelectorAll<HTMLInputElement>('input');
    act(() => inputs[1].click());
    expect(change).not.toHaveBeenCalled();
    expect(inputs[0]).toBeChecked();
  },
);
