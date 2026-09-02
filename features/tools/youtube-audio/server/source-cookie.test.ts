import { describe, expect, it } from 'vitest';
import type { YoutubeAudioSourceRecord } from '@echovisionlab/youtube-audio';
import {
  createSingleYoutubeAudioSourceStore,
  decryptYoutubeAudioSourceRecord,
  encryptYoutubeAudioSourceRecord,
  readYoutubeAudioSourceCookie,
  youtubeAudioSourceCookieName,
  youtubeAudioSourceCookiePath,
} from './source-cookie';

const secret = 'test-encryption-secret-32-characters';
const record: YoutubeAudioSourceRecord = {
  expiresAt: 2_000_000_000_000,
  id: 'source_12345678',
  subject: 'member-1',
  upstream: {
    contentType: 'audio/mp4',
    expiresAt: 2_000_000_100_000,
    fileName: 'Reference.m4a',
    size: 123_456,
    title: 'Reference',
    url: 'https://upstream.example.test/audio?token=secret',
    videoId: 'abcdefghijk',
  },
};

describe('YouTube audio source cookie', () => {
  it('round-trips one authenticated source without exposing its upstream URL', () => {
    const token = encryptYoutubeAudioSourceRecord(record, secret);
    expect(token).not.toContain('upstream.example.test');
    expect(token).not.toContain('member-1');
    expect(decryptYoutubeAudioSourceRecord(token, secret)).toEqual(record);
  });

  it('rejects a modified ticket or a different site secret', () => {
    const token = encryptYoutubeAudioSourceRecord(record, secret);
    const [version, iv, encrypted, tag] = token.split('.');
    const modifiedEncrypted = `${encrypted!.startsWith('a') ? 'b' : 'a'}${encrypted!.slice(1)}`;
    const modified = [version, iv, modifiedEncrypted, tag].join('.');
    expect(decryptYoutubeAudioSourceRecord(modified, secret)).toBeNull();
    expect(decryptYoutubeAudioSourceRecord(token, 'another-site-secret-32-characters')).toBeNull();
  });

  it('uses an exact source cookie name and range endpoint path', () => {
    const name = youtubeAudioSourceCookieName(record.id);
    const token = encryptYoutubeAudioSourceRecord(record, secret);
    const request = new Request('https://www.example.invalid/source', {
      headers: { Cookie: `unrelated=1; ${name}=${token}` },
    });
    expect(readYoutubeAudioSourceCookie(request, record.id)).toBe(token);
    expect(youtubeAudioSourceCookiePath(record.id)).toBe('/api/tools/youtube-audio/sources/source_12345678');
  });

  it('keeps only one request-local source record for the package store contract', async () => {
    const store = createSingleYoutubeAudioSourceStore();
    await expect(store.get(record.id)).resolves.toBeNull();
    await store.put(record);
    await expect(store.get(record.id)).resolves.toEqual(record);
    await store.delete(record.id);
    expect(store.current()).toBeNull();
  });
});
