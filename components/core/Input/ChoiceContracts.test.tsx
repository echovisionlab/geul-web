// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';
import { Radio } from './Radio';
import { Switch } from './Switch';
import { SegmentedControl } from './SegmentedControl';

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
function render(node: ReactNode, locale = 'en-US') {
  act(() => root.render(<I18nProvider locale={locale}>{node}</I18nProvider>));
}
function key(input: HTMLInputElement, value: string) {
  act(() => {
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: value, bubbles: true }));
  });
}
describe('choice input contracts', () => {
  it.each(['checkbox', 'radio'] as const)('connects %s group guidance and error to its children', (type) => {
    const props = {
      label: 'Visibility',
      description: 'Choose who can read',
      error: 'Choose an option',
      required: true,
    };
    render(
      type === 'checkbox' ? (
        <Checkbox.Group {...props}>
          <Checkbox value="public" label="Public" />
          <Checkbox value="private" label="Private" />
        </Checkbox.Group>
      ) : (
        <Radio.Group {...props}>
          <Radio value="public" label="Public" />
          <Radio value="private" label="Private" />
        </Radio.Group>
      ),
    );
    const group = host.querySelector(type === 'checkbox' ? '[role="group"]' : '[role="radiogroup"]')!;
    expect(group).toHaveAccessibleName('Visibility');
    expect(group).toHaveAccessibleDescription('Choose who can read Choose an option');
    if (type === 'radio') {
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(group).toHaveAttribute('aria-required', 'true');
    }
    for (const input of host.querySelectorAll('input')) {
      if (type === 'checkbox') {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      }
      expect(input).toHaveAccessibleDescription(/Choose who can read/);
      expect(input).toHaveAccessibleDescription(/Choose an option/);
    }
  });
  it.each(['checkbox', 'radio'] as const)('keeps a read-only %s group focusable without changing its value', (type) => {
    const changed = vi.fn();
    render(
      type === 'checkbox' ? (
        <Checkbox.Group label="Visibility" readOnly defaultValue={['public']} onChange={changed}>
          <Checkbox value="public" label="Public" />
          <Checkbox value="private" label="Private" />
        </Checkbox.Group>
      ) : (
        <Radio.Group label="Visibility" readOnly defaultValue="public" onChange={changed}>
          <Radio value="public" label="Public" />
          <Radio value="private" label="Private" />
        </Radio.Group>
      ),
    );
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    act(() => inputs[0].focus());
    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0]).not.toBeDisabled();
    key(inputs[0], type === 'radio' ? 'ArrowDown' : ' ');
    act(() => inputs[1].click());
    expect(changed).not.toHaveBeenCalled();
    expect(inputs[0]).toBeChecked();
    expect(inputs[1]).not.toBeChecked();
  });
  it('keeps a standalone checkbox name, mixed state and external guidance', () => {
    render(
      <>
        <span id="choice-help">Restricted to reviewers</span>
        <Checkbox
          label="Approve"
          checked
          indeterminate
          description="Review each change"
          error="Approval required"
          aria-describedby="choice-help"
          required
        />
      </>,
    );
    const input = host.querySelector('input')!;
    expect(input).toHaveAccessibleName('Approve');
    expect(input.indeterminate).toBe(true);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Restricted to reviewers Review each change Approval required');
  });
  it.each(['radio', 'segmented'] as const)('%s arrows skip disabled options and wrap selection', (type) => {
    const changed = vi.fn();
    render(
      type === 'radio' ? (
        <Radio.Group label="View" defaultValue="grid" onChange={changed}>
          <Radio value="grid" label="Grid" />
          <Radio value="locked" label="Locked" disabled />
          <Radio value="list" label="List" />
        </Radio.Group>
      ) : (
        <SegmentedControl
          label="View"
          defaultValue="grid"
          onChange={changed}
          data={[
            { value: 'grid', label: 'Grid' },
            { value: 'locked', label: 'Locked', disabled: true },
            { value: 'list', label: 'List' },
          ]}
        />
      ),
    );
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    key(inputs[0], 'ArrowRight');
    expect(inputs[2]).toBeChecked();
    expect(document.activeElement).toBe(inputs[2]);
    expect(changed).toHaveBeenLastCalledWith('list');
    key(inputs[2], 'ArrowRight');
    expect(inputs[0]).toBeChecked();
    expect(document.activeElement).toBe(inputs[0]);
  });
  it.each(['radio', 'segmented'] as const)('%s uses RTL horizontal direction and vertical down direction', (type) => {
    for (const orientation of ['horizontal', 'vertical'] as const) {
      render(
        type === 'radio' ? (
          <Radio.Group key={orientation} label="View" orientation={orientation} defaultValue="grid">
            <Radio value="grid" label="Grid" />
            <Radio value="list" label="List" />
          </Radio.Group>
        ) : (
          <SegmentedControl
            key={orientation}
            label="View"
            orientation={orientation}
            defaultValue="grid"
            data={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
            ]}
          />
        ),
        'ar',
      );
      const inputs = host.querySelectorAll<HTMLInputElement>('input');
      key(inputs[0], orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowDown');
      expect(inputs[1]).toBeChecked();
      expect(document.activeElement).toBe(inputs[1]);
    }
  });
  it('shows an icon segment hint on keyboard focus without a nested trigger warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <SegmentedControl
        aria-label="View"
        data={[
          { value: 'grid', icon: <svg />, accessibleLabel: 'Grid view' },
          { value: 'list', icon: <svg />, accessibleLabel: 'List view' },
        ]}
        defaultValue="grid"
      />,
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    expect(inputs[0]).toHaveAccessibleName('Grid view');
    key(inputs[0], 'ArrowRight');
    expect(inputs[1]).toBeChecked();
    expect(document.querySelector('[role="tooltip"]')).toHaveTextContent('List view');
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('Focusable'));
    warn.mockRestore();
  });
  it.each(['disabled', 'readOnly'] as const)('prevents %s segmented selection with pointer and arrows', (state) => {
    const changed = vi.fn();
    render(
      <SegmentedControl
        label="View"
        data={['Grid', 'List']}
        defaultValue="Grid"
        onChange={changed}
        {...{ [state]: true }}
      />,
    );
    const inputs = host.querySelectorAll<HTMLInputElement>('input');
    key(inputs[0], 'ArrowRight');
    act(() => inputs[1].click());
    expect(changed).not.toHaveBeenCalled();
    expect(inputs[0]).toBeChecked();
    expect(inputs[1]).not.toBeChecked();
    expect(inputs[0].disabled).toBe(state === 'disabled');
  });
  it('renders uncontrolled switch track copy from selected state while keeping its accessible name stable', () => {
    render(<Switch label="Notifications" defaultChecked onLabel="On" offLabel="Off" />);
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input).toBeChecked();
    expect(input).toHaveAccessibleName('Notifications');
    expect(host.textContent).toBe('OnNotifications');
    act(() => input.click());
    expect(input).not.toBeChecked();
    expect(input).toHaveAccessibleName('Notifications');
    expect(host.textContent).toBe('OffNotifications');
  });
  it('renders controlled switch track copy when the owner updates checked', () => {
    const props = { label: 'Notifications', onLabel: 'On', offLabel: 'Off' };
    render(<Switch {...props} checked />);
    expect(host.textContent).toBe('OnNotifications');
    render(<Switch {...props} checked={false} />);
    expect(host.textContent).toBe('OffNotifications');
    expect(host.querySelector('input')).toHaveAccessibleName('Notifications');
  });
});
