// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AdminEntityPagePreview } from './AdminEntities.stories';
import { MyListsPagePreview } from './MyLists.stories';
import { OnboardingPagePreview } from './Onboarding.stories';
import { OAuthConsentPagePreview } from './OAuth.stories';
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
afterEach(() => {
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
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
describe('expanded production page adapters', () => {
  it.each(['artists', 'labels', 'releases'] as const)(
    'runs the actual %s create controller with a local typed action',
    async (domain) => {
      render(<AdminEntityPagePreview domain={domain} />);
      const button = Array.from(host.querySelectorAll('button')).find((node) => node.textContent?.startsWith('New '));
      expect(button).toBeDefined();
      await act(async () => button!.click());
      expect(host.querySelector('[role=alert]')?.textContent).toContain('Draft');
    },
  );
  it('keeps actual entity empty state and table search UI', async () => {
    render(<AdminEntityPagePreview state="empty" />);
    await flush();
    expect(host.textContent).toContain('No artists');
    expect(host.querySelector('input[placeholder*=artists]')).not.toBeNull();
  });
  it('runs the actual works query owner against local credited rows', async () => {
    render(<MyListsPagePreview domain="works" />);
    await flush();
    expect(host.textContent).toContain('Night Signals');
    expect(host.textContent).toContain('Composer');
  });
  it('runs the actual posts query and create owner without service calls', async () => {
    render(<MyListsPagePreview domain="posts" />);
    await flush();
    expect(host.textContent).toContain('Listening notes');
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="New post"]');
    expect(button).not.toBeNull();
    await act(async () => button!.click());
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Draft');
  });
  it('uses the actual series loaded/empty render tree', () => {
    render(<MyListsPagePreview domain="series" state="empty" />);
    expect(host.textContent).toContain('series');
    expect(host.querySelector('a[href^="/my/series/"]')).toBeNull();
  });
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
  it('renders actual OAuth consent forms with requested scope disclosure', () => {
    render(<OAuthConsentPagePreview />);
    expect(host.querySelectorAll('form')).toHaveLength(2);
    expect(host.textContent).toContain('Studio MCP');
    expect(host.querySelector('button[type=submit]')?.textContent).toContain('Cancel');
  });
});
