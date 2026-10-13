// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LocaleProvider } from '@/lib/providers/LocaleProvider';
import { getSupportedLocaleOptions } from '@/lib/i18n/locale';
import enMessages from '@/messages/en.json';
import { LanguageMenu } from './LanguageMenu';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
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
