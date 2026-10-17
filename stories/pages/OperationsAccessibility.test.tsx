// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { AuthoringExtensionsProvider } from '@/features/authoring/AuthoringExtensionsContext';
import { MailAdaptersPreview } from './MailAdapters.stories';
import { OgImageSettingsPreview } from './OgImageSettings.stories';
import en from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/settings',
  useSearchParams: () => new URLSearchParams(),
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function render(surface: 'mail' | 'og') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <TestProviders>
        <AuthoringExtensionsProvider available={{ generation: false }}>
          {surface === 'mail' ? <MailAdaptersPreview /> : <OgImageSettingsPreview />}
        </AuthoringExtensionsProvider>
      </TestProviders>,
    ),
  );
}

describe('production operations accessibility with local services', () => {
  it('keeps each mail adapter command and value associated with its own provider', async () => {
    await render('mail');
    // Adapters arrive through the local query transport.
    const group = await vi.waitFor(() => {
      const match = host.querySelector('[role="group"][aria-label="Studio SMTP"]');
      expect(match).not.toBeNull();
      return match!;
    });
    const toggle = group.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(toggle.getAttribute('aria-label')).toBe(`${en.adminSettings.mail.row.enableAdapter} Studio SMTP`);
    expect(toggle.checked).toBe(false);
    await act(async () => toggle.click());
    await vi.waitFor(() => expect(toggle.checked).toBe(true));
    expect(group.querySelector(`button[aria-label="${en.common.actions.edit} Studio SMTP"]`)).not.toBeNull();
    expect(group.querySelector(`button[aria-label="${en.common.actions.delete} Studio SMTP"]`)).not.toBeNull();
    expect(
      group.querySelector(`input[aria-label="${en.adminSettings.mail.row.testEmailLabel} Studio SMTP"]`),
    ).not.toBeNull();
  });

  it('exposes OG settings tabs, named form and all three range values without adding visible labels', async () => {
    await render('og');
    const tab = await vi.waitFor(() => {
      const match = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
        (button) => button.textContent === en.ogImageSettings.tabs.content,
      );
      expect(match).toBeDefined();
      return match!;
    });
    await act(async () => tab.click());
    const form = await vi.waitFor(() => {
      expect(tab.getAttribute('aria-selected')).toBe('true');
      const match = host.querySelector(
        `form[aria-label="${en.ogImageSettings.title} ${en.ogImageSettings.tabs.content}"]`,
      );
      expect(match).not.toBeNull();
      return match!;
    });
    expect(form.getAttribute('aria-label')).toBe(`${en.ogImageSettings.title} ${en.ogImageSettings.tabs.content}`);
    const names = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="range"]')).map((input) => {
      const label = document.getElementById(input.getAttribute('aria-labelledby')!);
      return label?.getAttribute('aria-label') ?? label?.textContent;
    });
    expect(names).toEqual([
      en.ogImageSettings.content.fields.fontSizeThreshold,
      en.common.labels.lineHeight,
      en.common.labels.opacity,
    ]);
    expect(form.querySelectorAll('input[type="range"]')).toHaveLength(3);
  });
});
