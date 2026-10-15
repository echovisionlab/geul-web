// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { TestProviders } from '@/test/TestProviders';
import { MapThemeVariantTabs, type MapThemeVariantTab } from './MapThemeVariantTabs';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Harness() {
  const [value, setValue] = useState<MapThemeVariantTab>('light');
  const tabIds = { light: 'light-variant', dark: 'dark-variant' };
  return (
    <>
      <MapThemeVariantTabs value={value} onChange={setValue} panelId="variant-panel" tabIds={tabIds} />
      <div id="variant-panel" role="tabpanel" aria-labelledby={tabIds[value]}>
        {value}
      </div>
    </>
  );
}

describe('MapThemeVariantTabs', () => {
  it.each([
    ['en', enMessages],
    ['ko', koMessages],
  ] as const)(
    'uses the existing localized map color-scheme name in %s and keeps the external panel connection',
    (locale, messages) => {
      act(() =>
        root.render(
          <TestProviders locale={locale} messages={messages}>
            <Harness />
          </TestProviders>,
        ),
      );
      const list = host.querySelector('[role="tablist"]');
      expect(list).toHaveAccessibleName(messages.mapControls.fields.colorScheme);
      const tabs = host.querySelectorAll<HTMLElement>('[role="tab"]');
      expect(tabs[0]).toHaveAccessibleName(messages.adminList.mapThemes.variants.light);
      expect(tabs[1]).toHaveAccessibleName(messages.adminList.mapThemes.variants.dark);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      const panel = document.getElementById(tabs[1].getAttribute('aria-controls')!);
      expect(panel).toHaveAccessibleName(messages.adminList.mapThemes.variants.light);
      act(() => tabs[1].click());
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
      expect(panel).toHaveAccessibleName(messages.adminList.mapThemes.variants.dark);
      expect(panel?.textContent).toBe('dark');
    },
  );
});
