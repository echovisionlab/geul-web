// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import LoginCatalog from './Login.stories';
import MapThemesCatalog from './MapThemes.stories';
import EventSeriesCatalog from './EventSeries.stories';
import PublicEntitiesCatalog from './PublicEntities.stories';
import LegalCatalog from './Legal.stories';
import FormsCatalog from './Forms.stories';
import ProfileCatalog from './UserProfile.stories';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
}));
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
});
function render(view: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<TestProviders>{view}</TestProviders>));
}
const Login = LoginCatalog.component;
const MapThemes = MapThemesCatalog.component;
const EventSeries = EventSeriesCatalog.component;
const PublicEntities = PublicEntitiesCatalog.component;
const Legal = LegalCatalog.component;
const Forms = FormsCatalog.component;
const Profile = ProfileCatalog.component;
describe('production page preview adapters', () => {
  it('moves the actual login form to the code surface using local callbacks', () => {
    render(<Login />);
    const emailForm = host.querySelector('form')!;
    expect(host.querySelector<HTMLInputElement>('#login-email-input')?.value).toBe('june@example.com');
    act(() => emailForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(host.querySelectorAll('input[inputmode="numeric"]')).toHaveLength(6);
    expect(host.textContent).toContain('Check your email');
  });
  it('projects expired login state onto disabled code cells', () => {
    render(<Login initialState="expired" />);
    expect(
      Array.from(host.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')).every(
        (input) => input.disabled,
      ),
    ).toBe(true);
    expect(host.textContent).toContain('expired');
  });
  it('renders the actual map-theme page cards and default restriction', () => {
    render(<MapThemes />);
    expect(host.querySelectorAll('[data-map-theme-card]')).toHaveLength(3);
    expect(host.textContent).toContain('Gallery');
    expect(host.querySelector('h1')?.textContent).toContain('Map Themes');
  });
  it('loads another event through the production page table local adapter', () => {
    render(<EventSeries />);
    expect(host.textContent).toContain('Opening performance');
    expect(host.textContent).not.toContain('Listening room');
    const more = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('more'),
    )!;
    expect(more).toBeDefined();
    act(() => more.click());
    expect(host.textContent).toContain('Listening room');
  });
  it.each(['work', 'event'] as const)('renders the actual %s public route client with fixture data', (entity) => {
    render(<PublicEntities entity={entity} />);
    expect(host.querySelector('h1')).not.toBeNull();
    expect(host.textContent).toContain(entity === 'work' ? 'Night Signals' : 'Listening Room');
  });
  it.each(['terms', 'privacy'] as const)(
    'renders the actual %s page client with seeded transport disabled',
    (document) => {
      render(<Legal document={document} scheduled />);
      expect(host.querySelector(`[data-legal-document="${document}"]`)).not.toBeNull();
      expect(host.textContent).toContain('2026');
    },
  );
  it('renders the production form response and success surfaces independently', () => {
    render(<Forms />);
    expect(host.querySelector('input')).not.toBeNull();
    act(() =>
      root.render(
        <TestProviders>
          <Forms surface="success" />
        </TestProviders>,
      ),
    );
    expect(host.textContent).toContain('submitted');
  });
  it('keeps public profile fixtures free of administrative action controls', () => {
    render(<Profile />);
    expect(host.textContent).toContain('June Han');
    expect(host.textContent).not.toContain('Ban User');
  });
});
