// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { SharePasswordView } from './SharePasswordView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = {
  title: 'Password required',
  description: 'Enter the password.',
  password: 'Password',
  submit: 'Open page',
};

describe('SharePasswordView', () => {
  it('keeps the entered value while pending and returns keyboard focus to a rejected password', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const render = (pending: boolean, error?: string) =>
      act(() =>
        root.render(
          <DesignSystemProvider forceColorScheme="light">
            <SharePasswordView
              password="wrong"
              onPasswordChange={() => {}}
              pending={pending}
              error={error}
              labels={labels}
            />
          </DesignSystemProvider>,
        ),
      );
    render(true);
    const input = host.querySelector<HTMLInputElement>('input[name="password"]')!;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('wrong');
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    render(false, 'Incorrect password.');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const description = input
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .join(' ');
    expect(description).toContain('Incorrect password.');
    expect(input.readOnly).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
  it('keeps submit disabled for an empty password and emits password changes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onPasswordChange = vi.fn();
    act(() =>
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <SharePasswordView password="" onPasswordChange={onPasswordChange} pending={false} labels={labels} />
        </DesignSystemProvider>,
      ),
    );
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    const input = document.querySelector<HTMLInputElement>('input[name="password"]');
    act(() => {
      if (input) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'secret');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(onPasswordChange).toHaveBeenCalledWith('secret');
    act(() =>
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <SharePasswordView password="secret" onPasswordChange={onPasswordChange} pending={false} labels={labels} />
        </DesignSystemProvider>,
      ),
    );
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
});
