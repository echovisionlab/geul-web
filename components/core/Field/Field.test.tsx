// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider, PasswordInput, TextInput } from '@mantine/core';
import { Field } from './Field';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

describe('Field', () => {
  it('wires label, description, and error state to the input', () => {
    render(
      <Field label="Display name" htmlFor="field-display-name" description="Shown publicly" error="Name is required">
        <TextInput placeholder="Name" />
      </Field>,
    );

    const label = document.querySelector('label[for="field-display-name"]');
    const input = document.querySelector('input#field-display-name');
    const description = document.querySelector('#field-display-name-description');
    const error = document.querySelector('#field-display-name-error');

    expect(label?.textContent).toContain('Display name');
    expect(description?.textContent).toContain('Shown publicly');
    expect(error?.textContent).toContain('Name is required');
    expect(input?.getAttribute('aria-describedby')).toContain('field-display-name-description');
    expect(input?.getAttribute('aria-describedby')).toContain('field-display-name-error');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  it('preserves invalid state wiring for password inputs', () => {
    render(
      <Field label="Confirm password" htmlFor="field-confirm-password" error="Passwords do not match">
        <PasswordInput placeholder="Confirm password" />
      </Field>,
    );

    const input = document.querySelector('input#field-confirm-password');
    const error = document.querySelector('#field-confirm-password-error');

    expect(error?.textContent).toContain('Passwords do not match');
    expect(input?.getAttribute('aria-describedby')).toContain('field-confirm-password-error');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });

  it('wires native inputs to description and error text', () => {
    render(
      <Field
        label="Native email"
        htmlFor="field-native-email"
        description="Used for receipts"
        error="Email is required"
      >
        <input />
      </Field>,
    );

    const input = document.querySelector('input#field-native-email');

    expect(input?.getAttribute('aria-describedby')).toContain('field-native-email-description');
    expect(input?.getAttribute('aria-describedby')).toContain('field-native-email-error');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });
});
