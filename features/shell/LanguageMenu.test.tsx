// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { getSupportedLocaleOptions } from '@/lib/i18n/locale';
import enMessages from '@/messages/en.json';
import { LanguageMenu } from './LanguageMenu';
const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/auth/client', () => ({ useSession: () => ({ data: null, isPending: false }) }));
vi.mock('@/lib/actions/user-preference', () => ({ updatePreferredLocaleAction: vi.fn() }));
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
describe('language menu display and accessible name', () => {
  it('preserves the displayed language in the text trigger name and supplies its purpose separately', () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <TestProviders>
          <LocaleProvider locale="en">
            <LanguageMenu variant="text" />
          </LocaleProvider>
        </TestProviders>,
      ),
    );
    const trigger = host.querySelector('button')!;
    const displayedLanguage = getSupportedLocaleOptions().find((option) => option.value === 'en')!.label;
    expect(trigger.getAttribute('aria-label')).toBe(displayedLanguage);
    expect(trigger.textContent).toContain(displayedLanguage);
    expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe(
      enMessages.shell.actions.language,
    );
    expect(['true', 'menu']).toContain(trigger.getAttribute('aria-haspopup'));
  });
});

describe('changing the site language', () => {
  function renderMenu() {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root.render(
        <TestProviders>
          <LocaleProvider locale="en">
            <LanguageMenu variant="text" />
          </LocaleProvider>
        </TestProviders>,
      ),
    );
  }

  async function choose(label: string) {
    act(() => host.querySelector('button')!.click());
    const item = await vi.waitFor(() => {
      const match = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
        (element) => element.textContent === label,
      );
      if (!match) {
        throw new Error(`No menu item ${label}`);
      }
      return match;
    });
    act(() => item.click());
  }

  it('drops a content language pinned in the URL so the document follows the new site language', async () => {
    window.history.replaceState(null, '', '/terms?lang=ko&tab=1#scope');
    renderMenu();
    const dutch = getSupportedLocaleOptions().find((option) => option.value === 'nl')!.label;
    await choose(dutch);
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/terms?tab=1#scope', { scroll: false }));
    expect(router.refresh).not.toHaveBeenCalled();
    expect(document.cookie).toContain('locale=nl');
  });
});
