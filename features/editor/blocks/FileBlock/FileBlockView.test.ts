import { describe, expect, it } from 'vitest';
import { resolveFileBlockViewKind } from './FileBlockView';

describe('resolveFileBlockViewKind', () => {
  it.each([
    [{ hasSource: false, mimeType: '', isLoadingMime: false }, 'empty'],
    [{ hasSource: true, mimeType: '', isLoadingMime: true }, 'loading'],
    [{ hasSource: true, mimeType: 'image/webp', isLoadingMime: false }, 'image'],
    [{ hasSource: true, mimeType: 'audio/wav', isLoadingMime: false }, 'audio'],
    [{ hasSource: true, mimeType: 'video/mp4', isLoadingMime: false }, 'video'],
    [{ hasSource: true, mimeType: 'application/pdf', isLoadingMime: false }, 'file'],
  ] as const)('resolves %o to %s', (input, expected) => {
    expect(resolveFileBlockViewKind(input)).toBe(expected);
  });
});
