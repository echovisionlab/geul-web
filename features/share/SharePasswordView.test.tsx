// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SharePasswordView } from './SharePasswordView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const labels = {
  title: 'Password required',
  description: 'Enter the password.',
  password: 'Password',
  submit: 'Open page',
};

describe('SharePasswordView', () => {
  it('keeps submit disabled for an empty password and emits password changes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onPasswordChange = vi.fn();
    act(() =>
      root.render(
        <MantineProvider>
          <SharePasswordView password="" onPasswordChange={onPasswordChange} pending={false} labels={labels} />
        </MantineProvider>,
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
        <MantineProvider>
          <SharePasswordView password="secret" onPasswordChange={onPasswordChange} pending={false} labels={labels} />
        </MantineProvider>,
      ),
    );
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
});
