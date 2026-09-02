import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { describe, expect, it } from 'vitest';
import { UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import {
  buildUnsupportedRemoteUploadTypeMessage,
  buildUnsupportedUploadTypeMessage,
  formatSupportedUploadFormats,
  isLikelySupportedUploadUrl,
  resolveUploadMimeTypeFromUrl,
} from './upload';

describe('resolveUploadMimeTypeFromUrl', () => {
  it('resolves mime type from URL extension', () => {
    expect(resolveUploadMimeTypeFromUrl('https://cdn.example.com/files/sample.mp3')).toBe('audio/mpeg');
    expect(resolveUploadMimeTypeFromUrl('https://cdn.example.com/files/sample.aif')).toBe('audio/aiff');
    expect(resolveUploadMimeTypeFromUrl('https://cdn.example.com/files/model.glb')).toBe('model/gltf-binary');
    expect(resolveUploadMimeTypeFromUrl('https://cdn.example.com/files/sample.MOV?download=1')).toBe('video/quicktime');
  });

  it('returns empty string when the URL has no extension hint', () => {
    expect(resolveUploadMimeTypeFromUrl('https://cdn.example.com/files/sample')).toBe('');
  });
});

describe('isLikelySupportedUploadUrl', () => {
  it('accepts URLs whose extension matches the upload type', () => {
    expect(
      isLikelySupportedUploadUrl(
        'https://cdn.example.com/audio/sample.mp3',
        UPLOAD_CONFIGS[UploadType.EDITOR_AUDIO].permittedMimeTypes,
      ),
    ).toBe(true);
  });

  it('rejects URLs whose extension clearly mismatches the upload type', () => {
    expect(
      isLikelySupportedUploadUrl(
        'https://cdn.example.com/video/sample.mp4',
        UPLOAD_CONFIGS[UploadType.EDITOR_AUDIO].permittedMimeTypes,
      ),
    ).toBe(false);
  });

  it('returns null when the URL does not provide enough information', () => {
    expect(
      isLikelySupportedUploadUrl(
        'https://cdn.example.com/file/download',
        UPLOAD_CONFIGS[UploadType.EDITOR_ATTACHMENT].permittedMimeTypes,
      ),
    ).toBeNull();
  });

  it.each([
    'https://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/123456',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@vimeo.com/123456',
    'https://youtube.com:444/watch?v=dQw4w9WgXcQ',
    'https://cdn.example.com/master.m3u8',
  ])('rejects provider pages and HLS manifests for video import: %s', (url) => {
    expect(isLikelySupportedUploadUrl(url, UPLOAD_CONFIGS[UploadType.EDITOR_VIDEO].permittedMimeTypes)).toBe(false);
  });

  it('does not reject spoof provider hosts as provider pages', () => {
    expect(
      isLikelySupportedUploadUrl(
        'https://youtube.com.evil.test/download',
        UPLOAD_CONFIGS[UploadType.EDITOR_VIDEO].permittedMimeTypes,
      ),
    ).toBeNull();
  });

  it.each([
    'https://cdn.example.com/file.mp4',
    'https://cdn.example.com/file.webm',
    'https://cdn.example.com/file.mov',
    'https://cdn.example.com/file.avi',
    'https://cdn.example.com/file.mkv',
  ])('accepts supported direct video URLs: %s', (url) => {
    expect(isLikelySupportedUploadUrl(url, UPLOAD_CONFIGS[UploadType.EDITOR_VIDEO].permittedMimeTypes)).toBe(true);
  });

  it('passes extensionless signed URLs to the server', () => {
    expect(
      isLikelySupportedUploadUrl(
        'https://cdn.example.com/download?signature=x',
        UPLOAD_CONFIGS[UploadType.EDITOR_VIDEO].permittedMimeTypes,
      ),
    ).toBeNull();
  });
});

describe('formatSupportedUploadFormats', () => {
  it('deduplicates aliases into a single display extension', () => {
    expect(formatSupportedUploadFormats(['application/zip', 'application/x-zip-compressed', 'application/json'])).toBe(
      'ZIP, JSON',
    );
  });
});

describe('unsupported upload messages', () => {
  it('includes supported formats for local validation', () => {
    expect(buildUnsupportedUploadTypeMessage(UploadType.EDITOR_AUDIO, 'audio/basic')).toContain(
      'Supported formats: MP3, WAV, OGG, WEBA, FLAC, AAC, M4A, AIFF.',
    );
  });

  it('includes supported formats for remote validation', () => {
    expect(buildUnsupportedRemoteUploadTypeMessage(UploadType.EDITOR_VIDEO)).toContain(
      'Supported formats: MP4, WEBM, MOV, AVI, MKV.',
    );
  });

  it('only advertises HEIC for local image selections that can be normalized', () => {
    expect(buildUnsupportedUploadTypeMessage(UploadType.EDITOR_IMAGE)).toContain('HEIC');
    expect(buildUnsupportedRemoteUploadTypeMessage(UploadType.EDITOR_IMAGE)).not.toContain('HEIC');
  });

  it('includes supported formats for mesh validation', () => {
    expect(buildUnsupportedUploadTypeMessage(UploadType.EDITOR_MESH, 'application/octet-stream')).toContain(
      'Supported formats: GLB.',
    );
  });
});
