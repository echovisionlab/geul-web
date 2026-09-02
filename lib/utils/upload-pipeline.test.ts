import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  prepareUploadFile,
  prepareImageFileForPreview,
  preprocessUploadFile,
  validateUploadFile,
  validateUploadSelectionFile,
} from './upload-pipeline';

const { mockConvertToWebP } = vi.hoisted(() => ({
  mockConvertToWebP: vi.fn(),
}));

vi.mock('@/lib/utils/image-convert', () => ({
  convertToWebP: mockConvertToWebP,
}));

function makeFile(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

describe('upload-pipeline', () => {
  beforeEach(() => {
    mockConvertToWebP.mockReset();
    mockConvertToWebP.mockImplementation(async (file: File) => {
      return {
        ...file,
        name: file.name.replace(/\.[^.]+$/, '.webp'),
        type: 'image/webp',
      } as File;
    });
  });

  describe('validateUploadFile', () => {
    it('rejects raw HEIC as a final backend upload format', () => {
      const result = validateUploadFile(makeFile('photo.heic', 'image/heic', 1024), UploadType.EDITOR_IMAGE);

      expect(result.valid).toBe(false);
    });

    it('accepts valid site logo png', () => {
      const result = validateUploadFile(makeFile('logo.png', 'image/png', 1024), UploadType.SITE_LOGO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('image/png');
        expect(result.uploadType).toBe(UploadType.SITE_LOGO);
      }
    });

    it('rejects site logo webp (policy mismatch prevention)', () => {
      const result = validateUploadFile(makeFile('logo.webp', 'image/webp', 1024), UploadType.SITE_LOGO);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unsupported file type');
        expect(result.error).toContain('SVG, PNG');
      }
    });

    it('canonicalizes video alias MIME', () => {
      const result = validateUploadFile(makeFile('clip.avi', 'video/avi', 1024), UploadType.EDITOR_VIDEO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('video/x-msvideo');
      }
    });

    it('falls back to filename extension when file.type is empty', () => {
      const result = validateUploadFile(makeFile('track.m4a', '', 1024), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/mp4');
      }
    });

    it('accepts AIFF files via MIME alias canonicalization', () => {
      const result = validateUploadFile(makeFile('track.aiff', 'audio/x-aiff', 1024), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/aiff');
      }
    });

    it('prefers explicit audio filename extensions when browser MIME disagrees', () => {
      const result = validateUploadFile(makeFile('track.aiff', 'audio/mpeg', 1024), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/aiff');
      }
    });

    it('keeps browser audio MIME when the filename extension is not an audio hint', () => {
      const result = validateUploadFile(makeFile('track.bin', 'audio/mpeg', 1024), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/mpeg');
      }
    });

    it('accepts AIFF files via filename fallback when file.type is empty', () => {
      const result = validateUploadFile(makeFile('track.aif', '', 1024), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/aiff');
      }
    });

    it('accepts GLB mesh files via filename fallback when file.type is empty', () => {
      const result = validateUploadFile(makeFile('scene.glb', '', 1024), UploadType.EDITOR_MESH);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('model/gltf-binary');
        expect(result.uploadType).toBe(UploadType.EDITOR_MESH);
      }
    });

    it('accepts GLB mesh files when the browser reports octet-stream for explicit mesh upload', () => {
      const result = validateUploadFile(
        makeFile('scene.glb', 'application/octet-stream', 1024),
        UploadType.EDITOR_MESH,
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('model/gltf-binary');
        expect(result.uploadType).toBe(UploadType.EDITOR_MESH);
      }
    });

    it('does not auto-classify octet-stream GLB files as editor mesh uploads', () => {
      const result = validateUploadFile(makeFile('scene.glb', 'application/octet-stream', 1024));
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unsupported file type');
      }
    });

    it('accepts large track audio files up to 4GB', () => {
      const result = validateUploadFile(makeFile('track.flac', 'audio/flac', 370_200_000), UploadType.TRACK_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/flac');
      }
    });

    it('accepts large editor audio files up to 4GB', () => {
      const result = validateUploadFile(makeFile('ambient.wav', 'audio/wav', 370_200_000), UploadType.EDITOR_AUDIO);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('audio/wav');
      }
    });

    it('accepts favicon ico uploads via MIME alias canonicalization', () => {
      const result = validateUploadFile(
        makeFile('favicon.ico', 'image/vnd.microsoft.icon', 1024),
        UploadType.SITE_FAVICON,
      );
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('image/x-icon');
      }
    });

    it('accepts favicon ico uploads via filename fallback when file.type is empty', () => {
      const result = validateUploadFile(makeFile('favicon.ico', '', 1024), UploadType.SITE_FAVICON);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('image/x-icon');
      }
    });

    it('accepts png favicon uploads to match backend policy', () => {
      const result = validateUploadFile(makeFile('favicon.png', 'image/png', 1024), UploadType.SITE_FAVICON);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.mimeType).toBe('image/png');
      }
    });

    it('rejects unsupported favicon uploads with supported format guidance', () => {
      const result = validateUploadFile(makeFile('favicon.webp', 'image/webp', 1024), UploadType.SITE_FAVICON);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Unsupported file type');
        expect(result.error).toContain('PNG, ICO, SVG');
      }
    });

    it('rejects oversized files', () => {
      const result = validateUploadFile(makeFile('loader.gif', 'image/gif', 200 * 1024), UploadType.SITE_LOADER);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('File too large');
      }
    });
  });

  describe('validateUploadSelectionFile', () => {
    it('accepts HEIC and HEIF as normalizable image selections', () => {
      expect(
        validateUploadSelectionFile(makeFile('photo.heic', 'image/heic', 1024), UploadType.EDITOR_IMAGE).valid,
      ).toBe(true);
      expect(validateUploadSelectionFile(makeFile('photo.heif', '', 1024), UploadType.FEATURED_IMAGE).valid).toBe(true);
      expect(validateUploadSelectionFile(makeFile('photo.heic', 'image/heic', 1024)).valid).toBe(true);
    });

    it('accepts managed raster selections up to the original-file limit', () => {
      const result = validateUploadSelectionFile(
        makeFile('avatar.jpg', 'image/jpeg', 20 * 1024 * 1024),
        UploadType.USER_AVATAR,
      );

      expect(result.valid).toBe(true);
    });

    it('rejects managed raster selections above the original-file limit', () => {
      const result = validateUploadSelectionFile(
        makeFile('avatar.jpg', 'image/jpeg', 20 * 1024 * 1024 + 1),
        UploadType.USER_AVATAR,
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('File too large');
      }
    });

    it('allows prepared managed raster files up to the final upload tolerance', () => {
      const result = validateUploadFile(
        makeFile('avatar.webp', 'image/webp', 30 * 1024 * 1024),
        UploadType.USER_AVATAR,
      );

      expect(result.valid).toBe(true);
    });

    it('applies managed raster selection rules to site OG backgrounds', () => {
      const result = validateUploadSelectionFile(
        makeFile('og.jpg', 'image/jpeg', 20 * 1024 * 1024 + 1),
        UploadType.SITE_OG_BACKGROUND,
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('File too large');
      }
    });

    it('rejects prepared managed raster files above the final upload tolerance', () => {
      const result = validateUploadFile(
        makeFile('avatar.webp', 'image/webp', 30 * 1024 * 1024 + 1),
        UploadType.USER_AVATAR,
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('File too large');
      }
    });

    it('still rejects oversized non-normalized uploads', () => {
      const result = validateUploadSelectionFile(
        makeFile('logo.png', 'image/png', 6 * 1024 * 1024),
        UploadType.LABEL_IMAGE,
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('File too large');
      }
    });
  });

  describe('preprocessUploadFile', () => {
    it('always normalizes HEIC to WebP before upload', async () => {
      const file = makeFile('photo.heic', 'image/heic', 1024);
      const result = await preprocessUploadFile(file, UploadType.EDITOR_IMAGE);

      expect(mockConvertToWebP).toHaveBeenCalledWith(file, expect.objectContaining({ maxDimension: 4096 }));
      expect(result.type).toBe('image/webp');
    });

    it('does not convert when upload type does not allow webp', async () => {
      const file = makeFile('logo.png', 'image/png', 1024);
      const result = await preprocessUploadFile(file, UploadType.SITE_LOGO);

      expect(mockConvertToWebP).not.toHaveBeenCalled();
      expect(result).toBe(file);
    });

    it('converts when upload type allows webp', async () => {
      const file = makeFile('cover.jpg', 'image/jpeg', 1024);
      const result = await preprocessUploadFile(file, UploadType.EDITOR_IMAGE);

      expect(mockConvertToWebP).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('image/webp');
    });

    it('keeps managed raster normalization even when the encoded file is larger', async () => {
      const file = makeFile('cover.jpg', 'image/jpeg', 1024);
      mockConvertToWebP.mockResolvedValueOnce({
        ...file,
        name: 'cover.webp',
        type: 'image/webp',
        size: 2048,
      } as File);

      const result = await preprocessUploadFile(file, UploadType.FEATURED_IMAGE);

      expect(result.type).toBe('image/webp');
      expect(result.size).toBe(2048);
    });
  });

  describe('prepareUploadFile', () => {
    it('returns canonical MIME for non-converted upload type', async () => {
      const file = makeFile('logo.svg', '', 1024);
      const result = await prepareUploadFile(file, UploadType.SITE_LOGO);

      expect(mockConvertToWebP).not.toHaveBeenCalled();
      expect(result.file).toBe(file);
      expect(result.mimeType).toBe('image/svg+xml');
    });

    it('throws when file remains disallowed after preprocessing policy', async () => {
      const file = makeFile('logo.jpg', 'image/jpeg', 1024);
      await expect(prepareUploadFile(file, UploadType.SITE_LOGO)).rejects.toThrow('Unsupported file type');
    });

    it('returns converted file and MIME for editor image upload', async () => {
      const file = makeFile('photo.jpg', 'image/jpeg', 1024);
      const result = await prepareUploadFile(file, UploadType.EDITOR_IMAGE);

      expect(mockConvertToWebP).toHaveBeenCalledTimes(1);
      expect(result.file.type).toBe('image/webp');
      expect(result.mimeType).toBe('image/webp');
    });

    it('decodes HEIC before opening a browser preview', async () => {
      const file = makeFile('photo.heic', 'image/heic', 1024);
      const result = await prepareImageFileForPreview(file, UploadType.USER_AVATAR);

      expect(mockConvertToWebP).toHaveBeenCalledTimes(1);
      expect(result.type).toBe('image/webp');
    });
  });
});
