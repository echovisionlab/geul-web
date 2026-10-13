// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LegalAdminPreview } from './LegalAdmin.stories';
const local = vi.hoisted(() => ({ replace: vi.fn(), notice: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: local.replace, push: vi.fn() }) }));
vi.mock('@/components/core/Notification', () => ({ notifications: { show: local.notice } }));
vi.mock('@/lib/actions/terms', () => ({ createTermsVersionAction: vi.fn(), deleteTermsVersionAction: vi.fn() }));
vi.mock('@/lib/actions/privacy', () => ({ createPrivacyVersionAction: vi.fn(), deletePrivacyVersionAction: vi.fn() }));
// The focused browser suite exercises the actual editor. This test isolates automatic route dispatch.
vi.mock('./LegalEditorsPage.stories', () => ({
  LegalEditorPreview: ({ entity }: { entity: string }) => <div data-policy-editor={entity} />,
}));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.clearAllMocks();
});
async function render(policy: 'terms' | 'privacy', state: 'ready' | 'failed') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <TestProviders>
        <LegalAdminPreview policy={policy} state={state} surface="creation" />
      </TestProviders>,
    ),
  );
}
describe('legal automatic creation preview route', () => {
  it.each(['terms', 'privacy'] as const)(
    'renders the %s editor destination without replacing the runner document',
    async (policy) => {
      await render(policy, 'ready');
      await vi.waitFor(() =>
        expect(host.querySelector('[data-policy-editor]')).toHaveAttribute('data-policy-editor', policy),
      );
      expect(local.replace).not.toHaveBeenCalled();
    },
  );
  it.each(['terms', 'privacy'] as const)('renders the %s list destination after a creation error', async (policy) => {
    await render(policy, 'failed');
    await vi.waitFor(() => expect(host.querySelector('table')).toBeInTheDocument());
    expect(host.textContent).toContain('Current policy');
    expect(host.querySelector('[data-policy-editor]')).toBeNull();
    expect(local.notice).toHaveBeenCalledWith({ message: 'Unable to create local draft', tone: 'danger' });
    expect(local.replace).not.toHaveBeenCalled();
  });
});
