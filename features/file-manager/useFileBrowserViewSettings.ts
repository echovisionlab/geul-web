'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_COOKIE_NAME,
  getCookieValue,
  hasValidAnalyticsConsent,
  parseCookieConsentPreferences,
} from '@/lib/cookie-consent';
import {
  defaultFileBrowserViewSettings,
  parseFileBrowserViewSettings,
  type FileBrowserViewSettings,
} from './ui/file-browser-view-settings';

export const FILE_BROWSER_VIEW_STORAGE_KEY = 'geul.file-browser.view.v1';
const CHANGE_EVENT = 'geul:file-browser-view-change';
const LEGACY_KEY = 'geul.file-manager.view';

/** The current consent model has no preferences category; remember only after Accept all. */
function canRememberView(): boolean {
  return hasValidAnalyticsConsent(
    parseCookieConsentPreferences(getCookieValue(document.cookie, COOKIE_CONSENT_COOKIE_NAME)),
  );
}
function save(value: FileBrowserViewSettings) {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
    if (canRememberView()) {
      window.localStorage.setItem(FILE_BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, settings: value }));
    } else {
      window.localStorage.removeItem(FILE_BROWSER_VIEW_STORAGE_KEY);
    }
  } catch {
    /* Restricted storage keeps the current session usable. */
  }
}

/** Only appearance is remembered. File names, paths and selection never enter storage. */
export function useFileBrowserViewSettings() {
  const [settings, setSettings] = useState<FileBrowserViewSettings>(defaultFileBrowserViewSettings);
  const current = useRef(settings);
  current.current = settings;
  useEffect(() => {
    const restore = () => {
      try {
        if (!canRememberView()) {
          window.localStorage.removeItem(FILE_BROWSER_VIEW_STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_KEY);
          return;
        }
        const saved = parseFileBrowserViewSettings(window.localStorage.getItem(FILE_BROWSER_VIEW_STORAGE_KEY));
        const legacy = window.localStorage.getItem(LEGACY_KEY);
        if (saved) {
          setSettings(saved);
        } else if (legacy === 'grid' || legacy === 'list') {
          const migrated: FileBrowserViewSettings = { ...defaultFileBrowserViewSettings, viewMode: legacy };
          setSettings(migrated);
          save(migrated);
        }
      } catch {
        /* Access can be denied in embedded browsers. */
      }
    };
    restore();
    const consentChanged = () => save(current.current);
    const changed = (event: Event) => {
      const next = parseFileBrowserViewSettings(
        JSON.stringify({ version: 1, settings: (event as CustomEvent).detail }),
      );
      if (next) {
        setSettings(next);
      }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === FILE_BROWSER_VIEW_STORAGE_KEY && canRememberView()) {
        restore();
      }
    };
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, consentChanged);
    window.addEventListener(CHANGE_EVENT, changed);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, consentChanged);
      window.removeEventListener(CHANGE_EVENT, changed);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  const change = useCallback((value: FileBrowserViewSettings) => {
    const valid = parseFileBrowserViewSettings(JSON.stringify({ version: 1, settings: value }));
    if (!valid) {
      throw new RangeError('Invalid file browser view settings');
    }
    current.current = valid;
    setSettings(valid);
    save(valid);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: valid }));
  }, []);
  return { settings, change };
}
