// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Code, ConnectError } from '@connectrpc/connect';
import { MantineProvider } from '@mantine/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryErrorAlert } from './QueryErrorAlert';

vi.mock('next-intl', () => ({ useLocale: () => 'ko' }));
let root: Root;
let container: HTMLDivElement;
function render(node: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<MantineProvider>{node}</MantineProvider>));
}
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});
function query(code: Code) {
  return {
    isError: true,
    error: new ConnectError('private provider secret', code),
    isFetching: false,
    refetch: vi.fn().mockResolvedValue({}),
  };
}
describe('query failure UI', () => {
  it('shows a safe service error and retries without clearing edited input', () => {
    const failed = query(Code.Unavailable);
    render(
      <>
        <QueryErrorAlert queries={[failed]} />
        <input aria-label="title" defaultValue="unsaved title" />
      </>,
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('503');
    expect(container.textContent).not.toContain('private');
    act(() => container.querySelector('button')!.click());
    expect(failed.refetch).toHaveBeenCalledOnce();
    expect(container.querySelector('input')).toHaveValue('unsaved title');
  });
  it('shows permission failure without a retry button', () => {
    render(<QueryErrorAlert queries={[query(Code.PermissionDenied)]} />);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('403');
    expect(container.querySelector('button')).toBeNull();
  });
  it('does not display an error for an empty successful query', () => {
    render(<QueryErrorAlert queries={[{ ...query(Code.Internal), isError: false }]} />);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
