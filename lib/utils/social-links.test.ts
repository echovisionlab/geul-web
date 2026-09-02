import { describe, expect, it } from 'vitest';
import {
  compactSocialLinks,
  formatForSave,
  formatOrderedLinksForSave,
  getDisplaySocialLinkEntries,
  inferSocialPlatformFromUrl,
  normalizeToUrl,
  toEditableOrderedArray,
} from './social-links';

describe('social-links utilities', () => {
  it('normalizes usernames for editable social links', () => {
    expect(normalizeToUrl('instagram', '@example-studio')).toBe('https://instagram.com/example-studio');
    expect(normalizeToUrl('bandcamp', 'artist-name')).toBe('https://artist-name.bandcamp.com');
    expect(normalizeToUrl('mastodon', 'example-studio@mastodon.social')).toBe(
      'https://mastodon.social/@example-studio',
    );
    expect(normalizeToUrl('substack', 'example-studio')).toBe('https://example-studio.substack.com');
  });

  it('formats only supported social links for saving', () => {
    expect(
      formatForSave([
        { key: 'instagram', value: '@example-studio' },
        { key: 'unsupported', value: 'https://example.com' },
        { key: 'github', value: '' },
      ]),
    ).toEqual({
      instagram: 'https://instagram.com/example-studio',
    });
  });

  it('returns display entries without empty or unsupported links', () => {
    expect(
      getDisplaySocialLinkEntries({
        instagram: 'https://instagram.com/example-studio',
        unsupported: 'https://example.com',
        youtube: '  ',
        github: 'https://github.com/example-studio',
      }),
    ).toEqual([
      { key: 'instagram', platform: 'instagram', url: 'https://instagram.com/example-studio' },
      { key: 'github', platform: 'github', url: 'https://github.com/example-studio' },
    ]);
  });

  it('writes editable links as ordered numeric URL keys and keeps duplicate platforms', () => {
    expect(
      formatOrderedLinksForSave([
        { platform: 'facebook', value: 'https://facebook.com/label-one' },
        { platform: 'facebook', value: 'https://facebook.com/label-two' },
        { platform: 'instagram', value: '@example-studio' },
      ]),
    ).toEqual({
      '0': 'https://facebook.com/label-one',
      '1': 'https://facebook.com/label-two',
      '2': 'https://instagram.com/example-studio',
    });
  });

  it('reads legacy platform-key and ordered numeric-key social links into editor rows', () => {
    expect(
      toEditableOrderedArray({
        instagram: 'https://instagram.com/legacy',
        '1': 'https://facebook.com/second',
        '0': 'https://facebook.com/first',
      }),
    ).toEqual([
      { key: '0', platform: 'facebook', value: 'https://facebook.com/first' },
      { key: '1', platform: 'facebook', value: 'https://facebook.com/second' },
      { key: 'instagram', platform: 'instagram', value: 'https://instagram.com/legacy' },
    ]);
  });

  it('infers social platforms from ordered-key URLs', () => {
    expect(inferSocialPlatformFromUrl('https://open.spotify.com/album/abc')).toBe('spotify');
    expect(inferSocialPlatformFromUrl('https://music.apple.com/artist/name/1')).toBe('applemusic');
    expect(inferSocialPlatformFromUrl('https://example-studio.substack.com')).toBe('substack');

    expect(
      getDisplaySocialLinkEntries({
        '0': 'https://facebook.com/label-one',
        '1': 'https://facebook.com/label-two',
      }),
    ).toEqual([
      { key: '0', platform: 'facebook', url: 'https://facebook.com/label-one' },
      { key: '1', platform: 'facebook', url: 'https://facebook.com/label-two' },
    ]);
  });

  it('compacts optional streaming URL fields into the shared social-links shape', () => {
    expect(
      compactSocialLinks({
        spotify: ' https://open.spotify.com/album/1 ',
        soundcloud: null,
        youtube: '',
        youtubemusic: 'https://music.youtube.com/playlist?list=1',
      }),
    ).toEqual({
      spotify: 'https://open.spotify.com/album/1',
      youtubemusic: 'https://music.youtube.com/playlist?list=1',
    });
  });
});
