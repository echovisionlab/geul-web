// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextInput } from './TextInput';
import { PasswordInput } from './PasswordInput';
import { NumberInput } from './NumberInput';
import { Select } from './Select';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(node: ReactNode) {
  await act(async () => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}
const controls = [TextInput, PasswordInput, NumberInput, Select] as const;
const names = ['TextInput', 'PasswordInput', 'NumberInput', 'Select'] as const;
describe('input contracts in TextInput → PasswordInput → NumberInput → Select order', () => {
  it.each(controls.map((Control, index) => [names[index], Control] as const))(
    '%s relates visible label, helper, error and external description to the actual input',
    async (_, Control) => {
      await render(
        <>
          <p id="external-help">External constraint</p>
          <Control
            id="contract-input"
            label="Value"
            description="Expected format"
            error="Correct this value"
            required
            aria-invalid={false}
            aria-describedby="external-help"
          />
        </>,
      );
      const input = host.querySelector<HTMLInputElement>('input')!;
      const label = host.querySelector<HTMLLabelElement>('label')!;
      expect(label.htmlFor).toBe(input.id);
      expect(label.textContent).toContain('Value');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-required') === 'true' || input.required).toBe(true);
      const description = input
        .getAttribute('aria-describedby')!
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' ');
      expect(description).toContain('External constraint');
      expect(description).toContain('Expected format');
      expect(description).toContain('Correct this value');
      await act(async () => input.focus());
      expect(document.activeElement).toBe(input);
    },
  );
  it.each(controls.map((Control, index) => [names[index], Control] as const))(
    '%s preserves read-only focus separately from native disabled',
    async (_, Control) => {
      await render(<Control label="Value" readOnly />);
      let input = host.querySelector<HTMLInputElement>('input')!;
      expect(input.readOnly).toBe(true);
      expect(input.disabled).toBe(false);
      await act(async () => input.focus());
      expect(document.activeElement).toBe(input);
      await render(<Control label="Value" disabled />);
      input = host.querySelector<HTMLInputElement>('input')!;
      expect(input.disabled).toBe(true);
      expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).every((button) => button.disabled)).toBe(
        true,
      );
    },
  );
  it('PasswordInput keeps controlled visibility and allows read-only inspection without editing the value', async () => {
    const change = vi.fn();
    await render(
      <PasswordInput label="Password" value="secret" visible={false} readOnly onVisibilityChange={change} />,
    );
    const toggle = host.querySelector<HTMLButtonElement>('button')!;
    expect(toggle.disabled).toBe(false);
    expect(toggle.type).toBe('button');
    await act(async () => toggle.click());
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    expect(host.querySelector<HTMLInputElement>('input')?.type).toBe('password');
    await render(<PasswordInput label="Password" value="secret" visible readOnly onVisibilityChange={change} />);
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('secret');
    expect(host.querySelector<HTMLInputElement>('input')?.type).toBe('text');
    expect(host.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Hide password');
  });
  it.each([
    ['Enter', 'Enter'],
    [' ', 'Space'],
  ] as const)('PasswordInput visibility command operates once with %s', async (key, code) => {
    const change = vi.fn();
    await render(<PasswordInput label="Password" defaultValue="sample" onVisibilityChange={change} />);
    const toggle = host.querySelector<HTMLButtonElement>('button')!;
    await act(async () => {
      toggle.focus();
      toggle.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
      toggle.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
    });
    expect(change).toHaveBeenCalledExactlyOnceWith(true);
    expect(host.querySelector<HTMLInputElement>('input')?.type).toBe('text');
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('sample');
    expect(document.activeElement).toBe(toggle);
  });
  it('TextInput preserves external naming and its own help/error relationships together', async () => {
    await render(
      <>
        <span id="account-label">Account name</span>
        <TextInput aria-labelledby="account-label" description="Use your public name" error="Name is required" />
      </>,
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input.getAttribute('aria-labelledby')).toContain('account-label');
    const descriptions = input
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    expect(descriptions).toContain('Use your public name');
    expect(descriptions).toContain('Name is required');
  });
  it('NumberInput keyboard increments follow limits and read-only disables both stepper commands', async () => {
    const change = vi.fn();
    await render(<NumberInput label="Order" defaultValue={1} min={1} max={3} step={2} onChange={change} />);
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input.type).toBe('text');
    expect(input.getAttribute('aria-roledescription')).toBe('Number field');
    const buttons = host.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');
    await act(async () => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(change).toHaveBeenCalledExactlyOnceWith(3);
    expect(input.value).toBe('3');
    expect(buttons[1].disabled).toBe(true);
    change.mockClear();
    // A separate controlled field, not the uncontrolled one above switching modes.
    await render(<NumberInput key="read-only" label="Order" value={1} readOnly onChange={change} />);
    await act(async () =>
      host.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })),
    );
    expect(change).not.toHaveBeenCalled();
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('button')).every((button) => button.disabled)).toBe(
      true,
    );
  });
  it.each(['readOnly', 'disabled'] as const)(
    'Select %s blocks controlled opening and clear commands while retaining its selected label',
    async (state) => {
      const change = vi.fn();
      await render(
        <Select
          label="Status"
          data={['Draft', 'Published']}
          value="Published"
          {...{ [state]: true }}
          dropdownOpened
          clearable
          onChange={change}
        />,
      );
      const input = host.querySelector<HTMLInputElement>('input')!;
      expect(input.value).toBe('Published');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
      expect(change).not.toHaveBeenCalled();
    },
  );
  it('Select allows deselecting the currently selected option only when the API requests it', async () => {
    const change = vi.fn();
    await render(
      <Select label="Status" data={['Draft', 'Published']} defaultValue="Draft" allowDeselect onChange={change} />,
    );
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
    const current = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (option) => option.textContent === 'Draft',
    )!;
    await act(async () => current.click());
    expect(change).toHaveBeenCalledWith(null, { value: '', label: '' });
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('');
  });
  it.each([
    ['NumberInput', NumberInput],
    ['Select', Select],
  ] as const)('%s forwards its promised native input events with an actual input target', async (_, Control) => {
    const click = vi.fn();
    const keyUp = vi.fn();
    const compositionStart = vi.fn();
    const compositionEnd = vi.fn();
    await render(
      <Control
        label="Value"
        onClick={click}
        onKeyUp={keyUp}
        onCompositionStart={compositionStart}
        onCompositionEnd={compositionEnd}
      />,
    );
    const input = host.querySelector<HTMLInputElement>('input')!;
    await act(async () => {
      input.click();
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }));
    });
    for (const callback of [click, keyUp, compositionStart, compositionEnd]) {
      expect(callback).toHaveBeenCalledOnce();
      expect(callback.mock.calls[0][0].target).toBe(input);
    }
  });
});
