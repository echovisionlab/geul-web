// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  buildCookieConsentPreferences,
  serializeCookieConsentPreferences,
} from '@/lib/cookie-consent';
import { useFileBrowserViewSettings, FILE_BROWSER_VIEW_STORAGE_KEY } from './useFileBrowserViewSettings';
import { defaultFileBrowserViewSettings, parseFileBrowserViewSettings } from './ui/file-browser-view-settings';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
let browser: ReturnType<typeof useFileBrowserViewSettings>;
function Harness() {
  browser = useFileBrowserViewSettings();
  return null;
}
function consent(accepted: boolean, version = 1) {
  const preferences = { ...buildCookieConsentPreferences(accepted), version };
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentPreferences(preferences)}; Path=/`;
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: preferences }));
}
beforeEach(() => {
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`;
  localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});
function mount() {
  act(() => root.render(<Harness />));
}
const custom = {
  ...defaultFileBrowserViewSettings,
  iconSize: 'small' as const,
  columns: 3 as const,
  viewMode: 'list' as const,
};

describe('consent-aware shared file browser appearance', () => {
  it('keeps settings in the session without consent and removes unconsented legacy data', () => {
    localStorage.setItem('geul.file-manager.view', 'list');
    localStorage.setItem(FILE_BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, settings: custom }));
    mount();
    expect(browser.settings).toEqual(defaultFileBrowserViewSettings);
    act(() => browser.change(custom));
    expect(browser.settings).toEqual(custom);
    expect(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('geul.file-manager.view')).toBeNull();
  });
  it('restores only accepted current consent and saves only appearance fields', () => {
    consent(true);
    localStorage.setItem(FILE_BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, settings: custom }));
    mount();
    expect(browser.settings).toEqual(custom);
    act(() => browser.change({ ...custom, viewMode: 'grid' }));
    expect(JSON.parse(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY)!)).toEqual({
      version: 1,
      settings: { ...custom, viewMode: 'grid' },
    });
  });
  it('saves current session on acceptance and deletes stored settings on revocation', () => {
    mount();
    act(() => browser.change(custom));
    act(() => consent(true));
    expect(parseFileBrowserViewSettings(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY))).toEqual(custom);
    act(() => consent(false));
    expect(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY)).toBeNull();
    expect(browser.settings).toEqual(custom);
  });
  it('does not restore with obsolete consent or rejected optional cookies', () => {
    consent(true, 0);
    localStorage.setItem(FILE_BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, settings: custom }));
    mount();
    expect(browser.settings).toEqual(defaultFileBrowserViewSettings);
    expect(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY)).toBeNull();
    act(() => consent(false));
    act(() => browser.change(custom));
    expect(localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY)).toBeNull();
  });
  it('survives inaccessible storage and rejects corrupt, unsupported and unbounded settings', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    mount();
    act(() => browser.change(custom));
    expect(browser.settings).toEqual(custom);
    for (const columns of [0, 13, 2.5, '3', 'wide']) {
      expect(parseFileBrowserViewSettings(JSON.stringify({ version: 1, settings: { ...custom, columns } }))).toBeNull();
    }
    expect(parseFileBrowserViewSettings('{')).toBeNull();
    expect(parseFileBrowserViewSettings(JSON.stringify({ version: 2, settings: custom }))).toBeNull();
  });
  it('synchronizes the app manager and picker within the same window', () => {
    let other: ReturnType<typeof useFileBrowserViewSettings>;
    function Pair() {
      browser = useFileBrowserViewSettings();
      other = useFileBrowserViewSettings();
      return null;
    }
    act(() => root.render(<Pair />));
    act(() => browser.change(custom));
    expect(other!.settings).toEqual(custom);
  });
});
