// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { useLocale } from 'react-aria';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { COLOR_SCHEME_STORAGE_KEY } from '@/lib/theme/color-scheme';
import { DesignSystemProvider, useColorScheme } from './DesignSystemProvider';
import { getThemeTokens } from '@/lib/theme/themes';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=; Path=/; Max-Age=0`;
  localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=; Path=/; Max-Age=0`;
  localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
});
function Probe() {
  const theme = useColorScheme();
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={theme.toggleColorScheme}
      data-mode={theme.computedColorScheme}
      data-theme-id={theme.themeId}
      data-locale={locale.locale}
      data-direction={locale.direction}
    >
      Theme
    </button>
  );
}
it('updates forced preview theme and locale together without overwriting the stored application preference', async () => {
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=dark; Path=/`;
  localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'dark');
  await act(async () =>
    root.render(
      <DesignSystemProvider locale="ko" forceColorScheme="light">
        <Probe />
      </DesignSystemProvider>,
    ),
  );
  expect(document.documentElement.dataset.geulTheme).toBe('light');
  expect(host.querySelector('button')?.dataset.locale).toBe('ko');
  await act(async () => host.querySelector('button')!.click());
  expect(document.documentElement.dataset.geulTheme).toBe('light');
  expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark');
  await act(async () =>
    root.render(
      <DesignSystemProvider locale="ar" forceColorScheme="dark">
        <Probe />
      </DesignSystemProvider>,
    ),
  );
  expect(host.querySelector('button')?.dataset.direction).toBe('rtl');
  expect(document.documentElement.dataset.geulTheme).toBe('dark');
  expect(document.cookie).toContain(`${COLOR_SCHEME_STORAGE_KEY}=dark`);
});
it('applies custom roles to the document for portals, switches base mode, and removes old overrides', async () => {
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=auto; Path=/`;
  localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'auto');
  const portal = document.createElement('div');
  document.body.append(portal);
  try {
    await act(async () =>
      root.render(
        <DesignSystemProvider locale="en" forceTheme="ocean-light">
          {createPortal(<Probe />, portal)}
        </DesignSystemProvider>,
      ),
    );
    expect(portal.querySelector('button')?.dataset.themeId).toBe('ocean-light');
    expect(document.documentElement.dataset.geulTheme).toBe('light');
    expect(document.documentElement.dataset.geulThemeId).toBe('ocean-light');
    expect(document.documentElement.style.getPropertyValue('--geul-background')).toBe(
      getThemeTokens('ocean-light').background,
    );
    await act(async () => portal.querySelector('button')!.click());
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('auto');
    expect(document.cookie).toContain(`${COLOR_SCHEME_STORAGE_KEY}=auto`);

    await act(async () =>
      root.render(
        <DesignSystemProvider locale="ar" forceTheme="ocean-dark">
          {createPortal(<Probe />, portal)}
        </DesignSystemProvider>,
      ),
    );
    expect(portal.querySelector('button')?.dataset.direction).toBe('rtl');
    expect(document.documentElement.dataset.geulTheme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe(
      getThemeTokens('ocean-dark').surface,
    );
    expect(document.documentElement.style.getPropertyValue('--geul-border-default')).toBe('');

    await act(async () =>
      root.render(<DesignSystemProvider forceTheme="light">{createPortal(<Probe />, portal)}</DesignSystemProvider>),
    );
    expect(document.documentElement.dataset.geulThemeId).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--geul-background')).toBe('');
    expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('auto');
  } finally {
    portal.remove();
  }
});

it('restores the outer preview theme when a nested provider leaves, regardless of layout-effect mount order', async () => {
  await act(async () =>
    root.render(
      <DesignSystemProvider forceTheme="ocean-light">
        <Probe />
        <DesignSystemProvider forceTheme="ocean-dark">
          <Probe />
        </DesignSystemProvider>
      </DesignSystemProvider>,
    ),
  );
  expect(document.documentElement.dataset.geulThemeId).toBe('ocean-dark');
  expect([...host.querySelectorAll('button')].map((button) => button.dataset.themeId)).toEqual([
    'ocean-light',
    'ocean-dark',
  ]);
  await act(async () =>
    root.render(
      <DesignSystemProvider forceTheme="ocean-light">
        <Probe />
      </DesignSystemProvider>,
    ),
  );
  expect(document.documentElement.dataset.geulThemeId).toBe('ocean-light');
  expect(document.documentElement.style.getPropertyValue('--geul-surface')).toBe(getThemeTokens('ocean-light').surface);
});

it('inherits a forced preview through an unforced nested provider without reading or writing stored preferences', async () => {
  document.cookie = `${COLOR_SCHEME_STORAGE_KEY}=dark; Path=/`;
  localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'auto');
  await act(async () =>
    root.render(
      <DesignSystemProvider forceTheme="ocean-light">
        <DesignSystemProvider>
          <Probe />
        </DesignSystemProvider>
      </DesignSystemProvider>,
    ),
  );
  expect(host.querySelector('button')?.dataset.themeId).toBe('ocean-light');
  expect(document.documentElement.dataset.geulThemeId).toBe('ocean-light');
  await act(async () => host.querySelector('button')!.click());
  expect(document.cookie).toContain(`${COLOR_SCHEME_STORAGE_KEY}=dark`);
  expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('auto');
});
it('follows system mode changes in auto and persists an explicit user toggle', async () => {
  let update: ((event: MediaQueryListEvent) => void) | undefined;
  const media = {
    matches: false,
    addEventListener: (_: string, fn: typeof update) => {
      update = fn;
    },
    removeEventListener: vi.fn(),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
  await act(async () =>
    root.render(
      <DesignSystemProvider defaultColorScheme="auto">
        <Probe />
      </DesignSystemProvider>,
    ),
  );
  expect(document.documentElement.dataset.geulTheme).toBe('light');
  media.matches = true;
  await act(async () => update?.({ matches: true } as MediaQueryListEvent));
  expect(document.documentElement.dataset.geulTheme).toBe('dark');
  await act(async () => host.querySelector('button')!.click());
  expect(document.documentElement.dataset.geulTheme).toBe('light');
  expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('light');
  expect(document.cookie).toContain(`${COLOR_SCHEME_STORAGE_KEY}=light`);
});
