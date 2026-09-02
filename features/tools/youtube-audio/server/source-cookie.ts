import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import {
  YoutubeAudioError,
  type YoutubeAudioSourceRecord,
  type YoutubeAudioSourceStore,
} from '@echovisionlab/youtube-audio';
import { z } from 'zod';

const COOKIE_PREFIX = 'geul_youtube_audio_';
const COOKIE_AAD = Buffer.from('geul-youtube-audio-source-cookie-v1');
const MAX_COOKIE_VALUE_BYTES = 3_800;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const sourceRecordSchema = z.object({
  expiresAt: z.number().int().positive(),
  id: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  subject: z.string().min(1).max(256),
  upstream: z.object({
    contentType: z.string().min(1),
    expiresAt: z.number().int().positive().nullable(),
    fileName: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    size: z.number().int().positive(),
    title: z.string().min(1),
    url: z.url(),
    videoId: z.string().min(1),
  }),
});

export interface SingleYoutubeAudioSourceStore extends YoutubeAudioSourceStore {
  current: () => YoutubeAudioSourceRecord | null;
}

export function createSingleYoutubeAudioSourceStore(
  initial: YoutubeAudioSourceRecord | null = null,
): SingleYoutubeAudioSourceStore {
  let record = initial;
  return {
    current: () => record,
    async delete(id) {
      if (record?.id === id) {
        record = null;
      }
    },
    async get(id) {
      return record?.id === id ? record : null;
    },
    async put(source) {
      record = source;
    },
  };
}

export function youtubeAudioSourceCookieName(sourceId: string): string {
  return `${COOKIE_PREFIX}${sourceId}`;
}

export function youtubeAudioSourceCookiePath(sourceId: string): string {
  return `/api/tools/youtube-audio/sources/${encodeURIComponent(sourceId)}`;
}

export function encryptYoutubeAudioSourceRecord(record: YoutubeAudioSourceRecord, secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  cipher.setAAD(COOKIE_AAD);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(record), 'utf8'), cipher.final()]);
  const token = `v1.${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
  if (Buffer.byteLength(token) > MAX_COOKIE_VALUE_BYTES) {
    throw new YoutubeAudioError('UPSTREAM_FAILURE', 'The resolved audio source is too large for a short-lived ticket.');
  }
  return token;
}

export function decryptYoutubeAudioSourceRecord(
  token: string | undefined,
  secret: string,
): YoutubeAudioSourceRecord | null {
  if (token === undefined || Buffer.byteLength(token) > MAX_COOKIE_VALUE_BYTES) {
    return null;
  }
  const [version, ivValue, encryptedValue, tagValue, extra] = token.split('.');
  if (version !== 'v1' || !ivValue || !encryptedValue || !tagValue || extra !== undefined) {
    return null;
  }
  try {
    const iv = Buffer.from(ivValue, 'base64url');
    const tag = Buffer.from(tagValue, 'base64url');
    if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
      return null;
    }
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
    decipher.setAAD(COOKIE_AAD);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()]);
    const parsed = sourceRecordSchema.safeParse(JSON.parse(decrypted.toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readYoutubeAudioSourceCookie(request: Request, sourceId: string): string | undefined {
  const name = youtubeAudioSourceCookieName(sourceId);
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1 || part.slice(0, separator).trim() !== name) {
      continue;
    }
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}
