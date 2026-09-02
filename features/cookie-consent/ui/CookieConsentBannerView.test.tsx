// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { CookieConsentBannerView, type CookieConsentBannerViewModel } from './CookieConsentBannerView';

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

describe('CookieConsentBannerView', () => {
  it('renders injected copy and emits consent intents', () => {
    const onRejectNonEssential = vi.fn();
    const onTogglePreferences = vi.fn();
    const onAcceptAll = vi.fn();
    const onAnalyticsChange = vi.fn();
    const onSavePreferences = vi.fn();
    const model: CookieConsentBannerViewModel = {
      isOpen: true,
      requiresRenewal: true,
      showPreferences: true,
      analyticsEnabled: false,
      labels: {
        renewalNotice: 'Renew consent',
        intro: 'Cookie intro',
        rejectNonEssential: 'Reject optional',
        hidePreferences: 'Hide options',
        customize: 'Customize',
        acceptAll: 'Accept everything',
        essential: 'Essential cookies',
        analytics: 'Analytics cookies',
        savePreferences: 'Save choices',
      },
      learnMore: [
        { text: 'Read ' },
        { text: 'Privacy', href: '/privacy' },
        { text: ' and ' },
        { text: 'Terms', href: '/terms' },
        { text: '.' },
      ],
    };

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <MantineProvider>
          <CookieConsentBannerView
            model={model}
            onRejectNonEssential={onRejectNonEssential}
            onTogglePreferences={onTogglePreferences}
            onAcceptAll={onAcceptAll}
            onAnalyticsChange={onAnalyticsChange}
            onSavePreferences={onSavePreferences}
          />
        </MantineProvider>,
      );
    });

    expect(host.textContent).toContain('Renew consent');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/privacy"]')?.textContent).toBe('Privacy');
    expect(host.querySelector<HTMLAnchorElement>('a[href="/terms"]')?.textContent).toBe('Terms');

    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    act(() => buttons.find((button) => button.textContent === 'Reject optional')?.click());
    act(() => buttons.find((button) => button.textContent === 'Hide options')?.click());
    act(() => buttons.find((button) => button.textContent === 'Accept everything')?.click());
    act(() => buttons.find((button) => button.textContent === 'Save choices')?.click());
    const analytics = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][1];
    act(() => analytics?.click());

    expect(onRejectNonEssential).toHaveBeenCalledTimes(1);
    expect(onTogglePreferences).toHaveBeenCalledTimes(1);
    expect(onAcceptAll).toHaveBeenCalledTimes(1);
    expect(onSavePreferences).toHaveBeenCalledTimes(1);
    expect(onAnalyticsChange).toHaveBeenCalledWith(true);
  });
});
