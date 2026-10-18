import { FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it } from 'vitest';
import { fileUsageLabel } from './file-browser-presentation';

const labels = {
  usages: 'Used in',
  usageDomains: {
    [FileUsageDomain.POST]: 'Post',
    [FileUsageDomain.SITE_SETTINGS]: 'Site Settings',
    [FileUsageDomain.TRACK]: 'Track',
  },
  usageSlots: {
    logo_full_light: 'Full logo · light',
    logo_full_dark: 'Full logo · dark',
    logo_symbol_light: 'Symbol · light',
    logo_symbol_dark: 'Symbol · dark',
    logo_email_light: 'Email logo · light',
    logo_email_dark: 'Email logo · dark',
    favicon: 'Site Favicon',
    loader: 'Site Loader',
    site_og_background: 'Home OG Background',
    privacy_og_background: 'Privacy OG Background',
    terms_og_background: 'Terms OG Background',
  },
};

describe('fileUsageLabel', () => {
  it.each(Object.entries(labels.usageSlots))('names the Site Settings %s slot by its settings label', (slot, name) => {
    const usage = { domain: FileUsageDomain.SITE_SETTINGS, entityId: 'site-settings-1', slot, count: 1 };

    expect(fileUsageLabel(usage, labels)).toBe(`Site Settings · ${name}`);
  });

  it('locates a post usage by its exact block', () => {
    const usage = {
      domain: FileUsageDomain.POST,
      entityId: 'post-1',
      slot: 'file',
      blockId: 'block-1',
      blockType: 'file',
      title: 'Shared post',
      count: 1,
    };

    expect(fileUsageLabel(usage, labels)).toBe('Post · Shared post · file · file · block-1');
  });

  it('locates a track usage by the track itself', () => {
    const usage = {
      domain: FileUsageDomain.TRACK,
      entityId: 'track-1',
      slot: 'audio_original',
      title: 'Field recording',
      count: 1,
    };

    expect(fileUsageLabel(usage, labels)).toBe('Track · Field recording · audio_original · track-1');
  });

  it('does not name the generic editor slot as a location', () => {
    const usage = { domain: FileUsageDomain.POST, entityId: 'post-1', slot: 'editor', title: 'Shared post', count: 1 };

    expect(fileUsageLabel(usage, labels)).toBe('Post · Shared post');
  });
});
