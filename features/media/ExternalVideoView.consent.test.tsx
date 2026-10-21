// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import {
  COOKIE_CONSENT_COOKIE_NAME,
  buildCookieConsentPreferences,
  serializeCookieConsentPreferences,
} from '@/lib/cookie-consent';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { ExternalVideoView } from './ExternalVideoView';

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/`;
});

function mount(consent: boolean | null) {
  if (consent !== null) {
    document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${serializeCookieConsentPreferences(buildCookieConsentPreferences(consent))}; Path=/`;
  }
  const container = document.createElement('div');
  root = createRoot(container);
  act(() =>
    root!.render(
      <ManifestProvider manifest={siteVariableManifest}>
        <ExternalVideoView
          url="https://youtu.be/dQw4w9WgXcQ"
          title="Live set"
          thumbnailUrl="/asset/thumbnail.jpg"
          playbackLabels={({ title, provider }) => ({ play: `Play ${title}`, notice: `From ${provider}` })}
        />
      </ManifestProvider>,
    ),
  );
  return container;
}

it('loads the provider player with the page only after optional consent', () => {
  const consented = mount(true);
  const iframe = consented.querySelector('iframe');
  expect(iframe?.src).toContain('autoplay=0');
  expect(iframe?.getAttribute('allow')).toBe('fullscreen; picture-in-picture');
});

it.each([false, null])('shows the stored thumbnail until play, then starts that one player (consent=%s)', (consent) => {
  const container = mount(consent);
  expect(container.querySelector('iframe')).toBeNull();
  expect(container.querySelector('img')?.getAttribute('src')).toContain('thumbnail.jpg');

  act(() => (container.querySelector('button[aria-label="Play Live set"]') as HTMLButtonElement).click());

  const iframe = container.querySelector('iframe');
  expect(iframe?.src).toContain('autoplay=1');
  expect(iframe?.getAttribute('allow')).toBe('autoplay; fullscreen; picture-in-picture');
});
