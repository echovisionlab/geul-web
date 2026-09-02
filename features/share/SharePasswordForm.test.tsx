// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./SharePasswordView', () => ({
  SharePasswordView: ({
    password,
    onPasswordChange,
    error,
  }: {
    password: string;
    onPasswordChange: (value: string) => void;
    error?: string;
  }) => (
    <>
      <input
        name="password"
        aria-label="password"
        value={password}
        onChange={(event) => onPasswordChange(event.currentTarget.value)}
      />
      {error ? <output>{error}</output> : null}
      <button type="submit">Open</button>
    </>
  ),
}));

import { SharePasswordForm, type SharePasswordAccessState } from './SharePasswordForm';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const labels = { title: 'Share', description: 'Protected', password: 'Password', submit: 'Open' };

describe('SharePasswordForm', () => {
  it('renders initial content without mounting a form', () => {
    act(() => {
      root.render(
        <SharePasswordForm
          action={async (state: SharePasswordAccessState<'unused'>) => state}
          initialState={{ content: <article>Shared content</article> }}
          hiddenFields={{ token: 'token' }}
          labels={labels}
          getErrorMessage={(error) => error}
        />,
      );
    });

    expect(container.textContent).toBe('Shared content');
    expect(container.querySelector('form')).toBeNull();
  });

  it('owns password state, hidden fields, submission, and error projection', async () => {
    const action = vi.fn(async (_state: { error?: string }, formData: FormData) => ({
      error: formData.get('password') === 'secret' ? undefined : 'incorrect_password',
    }));

    act(() => {
      root.render(
        <SharePasswordForm
          action={action}
          initialState={{}}
          hiddenFields={{ token: 'share-token', idOrSlug: 'post' }}
          labels={labels}
          getErrorMessage={(error) => `translated:${error}`}
        />,
      );
    });

    expect(container.querySelector<HTMLInputElement>('input[name="token"]')?.value).toBe('share-token');
    expect(container.querySelector<HTMLInputElement>('input[name="idOrSlug"]')?.value).toBe('post');

    const input = container.querySelector<HTMLInputElement>('input[name="password"]');
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setValue?.call(input, 'wrong');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => container.querySelector<HTMLFormElement>('form')?.requestSubmit());
    await act(async () => {
      await Promise.resolve();
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect((action.mock.calls[0]?.[1] as FormData).get('password')).toBe('wrong');
    expect(container.querySelector('output')?.textContent).toBe('translated:incorrect_password');
  });
});
