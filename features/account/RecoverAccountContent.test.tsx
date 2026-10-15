// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemTestProvider } from '@/test/TestProviders';
import { RecoverAccountContent } from './RecoverAccountContent';

const recovery = vi.hoisted(() => ({
  state: { success: false, submitted: false, message: '' },
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useActionState: () => [recovery.state, vi.fn(), false],
}));
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));
vi.mock('@/lib/actions/account', () => ({ requestAccountRecoveryFormAction: vi.fn() }));

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

function renderRecovery() {
  act(() =>
    root.render(
      <DesignSystemTestProvider>
        <RecoverAccountContent />
      </DesignSystemTestProvider>,
    ),
  );
}

describe('account recovery result feedback', () => {
  it('keeps a failed submitted request on the form with its error', () => {
    recovery.state = { success: false, submitted: true, message: 'Recovery service unavailable' };
    renderRecovery();
    expect(container.textContent).toContain('auth.recoverAccount.form.title');
    expect(container.textContent).toContain('Recovery service unavailable');
    expect(container.textContent).not.toContain('auth.common.checkYourEmailTitle');
  });

  it('shows positive email feedback only for a successful request', () => {
    recovery.state = { success: true, submitted: true, message: '' };
    renderRecovery();
    expect(container.textContent).toContain('auth.common.checkYourEmailTitle');
    expect(container.querySelector('[role="status"]')?.getAttribute('data-tone')).toBe('positive');
    expect(document.activeElement).toBe(container.querySelector('h1'));
  });
});
