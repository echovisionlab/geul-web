// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { I18nProvider as DesignSystemProvider } from 'react-aria-components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NativeSelect, Textarea, TextInput } from '../Input';
import { Field } from './Field';
import { Checkbox } from '../Input/Checkbox';

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
    root?.render(<DesignSystemProvider>{node}</DesignSystemProvider>);
  });
}

describe('Field', () => {
  it('focuses an enabled editable target when its visible field label is activated', () => {
    render(
      <Field label="Description" htmlFor="rich-description">
        <div contentEditable role="textbox" aria-label="Description" tabIndex={0} />
      </Field>,
    );
    const target = document.getElementById('rich-description')!;
    act(() => container?.querySelector<HTMLLabelElement>('label')?.click());
    expect(document.activeElement).toBe(target);
  });

  it('does not focus a disabled editable target when its label is activated', () => {
    render(
      <Field label="Description" htmlFor="disabled-description">
        <div contentEditable role="textbox" aria-label="Description" aria-disabled="true" tabIndex={0} />
      </Field>,
    );
    act(() => container?.querySelector<HTMLLabelElement>('label')?.click());
    expect(document.activeElement).not.toBe(document.getElementById('disabled-description'));
  });

  it('retains a native child validation state when the wrapper has no error of its own', () => {
    render(
      <Field label="Email">
        <input aria-invalid="grammar" />
      </Field>,
    );
    expect(container?.querySelector('input')?.getAttribute('aria-invalid')).toBe('grammar');
  });

  it('deduplicates individual child description tokens before merging field guidance', () => {
    render(
      <>
        <span id="child-help">Account guidance</span>
        <Field label="Email" htmlFor="email" description="Receipts" error="Invalid address">
          <input aria-describedby="child-help  email-description child-help email-error" />
        </Field>
      </>,
    );
    expect(container?.querySelector('input')).toHaveAttribute(
      'aria-describedby',
      'child-help email-description email-error',
    );
  });

  it('keeps a readonly required textarea focusable and connects all wrapper guidance', () => {
    render(
      <Field label="Bio" htmlFor="bio" required description="Public profile" error="Review this text">
        <Textarea readOnly defaultValue="Existing bio" />
      </Field>,
    );
    const input = container!.querySelector('textarea')!;
    expect(input).toHaveAccessibleName('Bio');
    expect(input).toHaveAccessibleDescription('Public profile Review this text');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    act(() => input.focus());
    expect(document.activeElement).toBe(input);
  });

  it('keeps field header actions outside the label activation target', () => {
    const action = vi.fn();
    render(
      <Field
        label="Password"
        actions={
          <button type="button" onClick={action}>
            Generate
          </button>
        }
      >
        <TextInput />
      </Field>,
    );
    const button = container!.querySelector('button')!;
    expect(button.closest('label')).toBeNull();
    act(() => button.click());
    expect(action).toHaveBeenCalledOnce();
  });

  it('keeps inline fields labelled and associates helper copy with the select', () => {
    render(
      <Field layout="inline" label="Language" description="Translation source" htmlFor="inline-language">
        <NativeSelect density="compact" data={['English', '한국어']} />
      </Field>,
    );
    const select = container?.querySelector('select');
    expect(select?.id).toBe('inline-language');
    expect(container?.querySelector('label')?.htmlFor).toBe(select?.id);
    expect(select?.getAttribute('aria-describedby')).toBe('inline-language-description');
    expect(container?.querySelector('[data-geul-field-layout]')?.getAttribute('data-geul-field-layout')).toBe('inline');
    expect(container?.querySelectorAll('#inline-language-description')).toHaveLength(1);
  });
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
  it('associates a field label and validation copy with the native React Aria checkbox', () => {
    render(
      <Field label="Consent" htmlFor="consent" error="Required" required>
        <Checkbox />
      </Field>,
    );
    const input = document.querySelector<HTMLInputElement>('input#consent');
    expect(input).not.toBeNull();
    expect(input).toHaveAccessibleName('Consent');
    expect(input?.getAttribute('aria-describedby')).toContain('consent-error');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
  });
});
