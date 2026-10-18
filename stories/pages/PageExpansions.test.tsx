// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { OnboardingPagePreview } from './Onboarding.stories';
import { settleInAct, wrapQueryNotificationsInAct } from '@/test/act-wait';

// Full production page renders: a loaded CI worker needs more than the default 5s per test.
vi.setConfig({ testTimeout: 20_000 });
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
}));
vi.mock('@/lib/actions/artist', () => ({
  createArtistDraftAction: vi.fn(),
  previewDeleteArtistAction: vi.fn(),
  deleteArtistAction: vi.fn(),
  listMyArtistsAction: vi.fn(),
}));
vi.mock('@/lib/actions/label', () => ({
  createLabelDraftAction: vi.fn(),
  previewDeleteLabelAction: vi.fn(),
  deleteLabelAction: vi.fn(),
}));
vi.mock('@/lib/actions/release', () => ({ createReleaseAction: vi.fn(), deleteReleaseAction: vi.fn() }));
vi.mock('@/lib/actions/post', () => ({ createPostAction: vi.fn() }));
vi.mock('@/lib/actions/user', () => ({
  checkNicknameAvailabilityAction: vi.fn(),
  completeMyOnboardingAction: vi.fn(),
}));
vi.mock('@/lib/actions/work', () => ({ listMyCreditedWorksAction: vi.fn() }));
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
let host: HTMLDivElement;
let root: Root;
wrapQueryNotificationsInAct();
afterEach(async () => {
  await settleInAct();
  act(() => root?.unmount());
  host?.remove();
  vi.useRealTimers();
});
function render(view: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<TestProviders>{view}</TestProviders>));
}
describe('expanded production page adapters', () => {
  it('validates and completes the actual nickname onboarding form locally', async () => {
    vi.useFakeTimers();
    render(<OnboardingPagePreview />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(351);
    });
    expect(host.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(false);
    await act(async () =>
      host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Applied');
  });
  it('keeps unavailable nickname completion disabled', async () => {
    vi.useFakeTimers();
    render(<OnboardingPagePreview state="taken" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(351);
    });
    expect(host.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);
  });
});
