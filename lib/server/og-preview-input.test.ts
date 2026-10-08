import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_OG_CONFIG, DEFAULT_CONTENT_OG_CONFIG } from '@/lib/utils/og-config';
import { ogPreviewInput } from './og-preview-input';

describe('OG preview input', () => {
  it.each([
    null,
    [],
    {},
    { type: 'unknown' },
    { type: 'content', title: 4 },
    { type: 'home', config: {} },
    { type: 'home', config: [] },
    { type: 'content', title: 'Title', config: { ...DEFAULT_CONTENT_OG_CONFIG, title: null } },
    {
      type: 'home',
      config: { ...DEFAULT_HOME_OG_CONFIG, siteTitle: { ...DEFAULT_HOME_OG_CONFIG.siteTitle, fontSize: -1 } },
    },
  ])('rejects malformed request %j before rendering', (body) => {
    expect(ogPreviewInput.safeParse(body).success).toBe(false);
  });
  it.each([
    { type: 'home' },
    { type: 'home', config: DEFAULT_HOME_OG_CONFIG },
    { type: 'content', title: 'Title' },
    { type: 'content', title: 'Title', config: DEFAULT_CONTENT_OG_CONFIG },
  ])('accepts current editor payload %j', (body) => {
    expect(ogPreviewInput.safeParse(body).success).toBe(true);
  });
});
