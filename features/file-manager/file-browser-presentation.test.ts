import { describe, expect, it } from 'vitest';
import { fileBrowserFormatLabel } from './file-browser-presentation';

describe('fileBrowserFormatLabel', () => {
  it.each([
    ['a file extension over its MIME type', { kind: 'file', extension: 'wav', mimeType: 'audio/wav' }, 'wav'],
    ['a dotted upper-case extension', { kind: 'file', extension: '.MP3', mimeType: 'audio/mpeg' }, 'mp3'],
    ['the short form of a MIME subtype without an extension', { kind: 'file', mimeType: 'image/jpeg' }, 'jpg'],
    ['a vendor-prefixed MIME subtype without an extension', { kind: 'file', mimeType: 'audio/x-flac' }, 'flac'],
    ['the lower-cased folder label for a folder', { kind: 'folder' }, 'folder'],
  ] as const)('shows %s', (_, item, expected) => {
    expect(fileBrowserFormatLabel(item, 'Folder')).toBe(expected);
  });
});
