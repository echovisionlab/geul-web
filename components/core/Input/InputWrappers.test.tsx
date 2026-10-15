// @vitest-environment jsdom

import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LayoutStack as Stack } from '../Layout';
import {
  Checkbox,
  ColorInput,
  PasswordInput,
  Radio,
  SegmentedControl,
  Switch,
  TagsInput,
  Textarea,
  TextInput,
  ValidatingTextInput,
} from '.';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(node: ReactNode) {
  act(() => root.render(<DesignSystemProvider>{node}</DesignSystemProvider>));
}

describe('Core input wrappers', () => {
  it('names the password visibility command separately from the input', () => {
    render(<PasswordInput aria-label="Account password" defaultValue="secret" />);
    const toggle = host.querySelector<HTMLButtonElement>('button')!;
    expect(toggle.getAttribute('aria-label')).toBe('Show password');
    expect(toggle.textContent).toBe('');
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(toggle.querySelector('svg')).toHaveAttribute('focusable', 'false');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    act(() => toggle.focus());
    act(() => toggle.click());
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
    expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Account password');
    expect(host.querySelector('input')?.type).toBe('text');
    expect(host.querySelector('input')?.value).toBe('secret');
    expect(toggle.textContent).toBe('');
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveFocus();
  });

  it('forwards checkbox and switch semantics', () => {
    render(
      <Stack>
        <Checkbox label="Visible to everyone" />
        <Switch label="Enable notifications" />
      </Stack>,
    );
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const control = document.querySelector<HTMLInputElement>('[role="switch"]');
    act(() => {
      checkbox?.click();
      control?.click();
    });
    expect(checkbox?.checked).toBe(true);
    expect(control?.checked).toBe(true);
  });

  it('forwards text-like values and labels', () => {
    render(
      <Stack>
        <TextInput label="Name" defaultValue="Example Studio" />
        <PasswordInput label="Password" defaultValue="secret-value" />
        <Textarea label="Description" defaultValue="Field recording notes" />
        <ColorInput label="Accent color" defaultValue="#228be6" />
      </Stack>,
    );
    const inputValues = Array.from(document.querySelectorAll<HTMLInputElement>('input')).map(({ value }) => value);

    expect(inputValues).toContain('Example Studio');
    expect(inputValues).toContain('secret-value');
    expect(inputValues.map((value) => value.toLowerCase())).toContain('#228be6');
    expect(document.querySelector('textarea')?.value).toBe('Field recording notes');
  });

  it('keeps radio and segmented selections interactive', () => {
    render(
      <Stack>
        <Radio.Group name="visibility" label="Visibility">
          <Radio value="public" label="Public" />
          <Radio value="private" label="Private" />
        </Radio.Group>
        <SegmentedControl data={['Draft', 'Review', 'Published']} />
      </Stack>,
    );
    const privateRadio = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
      (input) => input.value === 'private',
    );
    const published = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
      (input) => input.value === 'Published',
    );
    act(() => {
      privateRadio?.click();
      published?.click();
    });
    expect(privateRadio?.checked).toBe(true);
    expect(published?.checked).toBe(true);
  });

  it('renders tag values and validation state without a browser story test', () => {
    render(
      <Stack>
        <TagsInput label="Keywords" defaultValue={['ambient', 'installation']} />
        <ValidatingTextInput label="Nickname" value="studio" required status="checking" readOnly />
      </Stack>,
    );
    expect(document.body.textContent).toContain('ambient');
    expect(document.body.textContent).toContain('installation');
    const nickname = Array.from(document.querySelectorAll<HTMLInputElement>('input')).find(
      ({ value }) => value === 'studio',
    );
    expect(nickname?.required).toBe(true);
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
