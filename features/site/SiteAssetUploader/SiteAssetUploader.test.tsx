// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageUploadAccept } from '@/components/core/ImageUpload';
import { SiteAssetUploader } from './SiteAssetUploader';

const uploadFileMock = vi.fn();
const setSiteAssetActionMock = vi.fn();
const deleteSiteAssetActionMock = vi.fn();
const maybeConvertSvgMock = vi.fn();

let dropHandler: ((files: File[]) => void | Promise<void>) | null = null;
let dropzoneAccept: ImageUploadAccept | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (vars: any) => Promise<any>;
    onSuccess?: (result: any) => void;
  }) => ({
    mutateAsync: async (vars: any) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      return result;
    },
    mutate: async (vars: any) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      return result;
    },
    isPending: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => values?.label ?? key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/site/SiteAssetUploader/ImageDropzone', () => ({
  ImageDropzone: ({
    accept,
    onDrop,
  }: {
    accept: ImageUploadAccept;
    onDrop: (files: File[]) => void | Promise<void>;
  }) => {
    dropzoneAccept = accept;
    dropHandler = onDrop;
    return <div data-testid="image-dropzone" />;
  },
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({
    uploadFile: uploadFileMock,
    isUploading: false,
  }),
}));

vi.mock('@/lib/hooks/useUploadValidation', () => ({
  useUploadValidation: () => ({
    validateFile: () => ({ valid: true as const }),
  }),
}));

vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: (...args: any[]) => setSiteAssetActionMock(...args),
  deleteSiteAssetAction: (...args: any[]) => deleteSiteAssetActionMock(...args),
}));

vi.mock('@/lib/utils/svg', () => ({
  maybeConvertSvg: (...args: any[]) => maybeConvertSvgMock(...args),
}));

beforeEach(() => {
  setSiteAssetActionMock.mockResolvedValue({ success: true });
  deleteSiteAssetActionMock.mockResolvedValue({ success: true });
  uploadFileMock.mockResolvedValue({ fileId: 'file-1', url: '/media/file-1.png' });
  maybeConvertSvgMock.mockImplementation(async (file: File) => file);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  dropHandler = null;
  dropzoneAccept = null;
  uploadFileMock.mockReset();
  setSiteAssetActionMock.mockReset();
  deleteSiteAssetActionMock.mockReset();
  maybeConvertSvgMock.mockReset();
});

describe('SiteAssetUploader', () => {
  it('allows favicon MIME aliases and extension-only ICO selection', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SiteAssetUploader type="favicon" currentUrl={null} />);
    });

    expect(dropzoneAccept).toEqual({
      'image/png': [],
      'image/x-icon': ['.ico'],
      'image/vnd.microsoft.icon': ['.ico'],
      'image/svg+xml': [],
    });
  });

  it('preserves normal site logos without SVG conversion', async () => {
    const svgFile = new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' });
    const onSuccess = vi.fn();
    setSiteAssetActionMock.mockResolvedValue({
      success: true,
      ogGenerationRunId: 'site-logo-run',
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SiteAssetUploader type="logo_light" currentUrl={null} onSuccess={onSuccess} />);
    });

    expect(dropHandler).toBeTruthy();

    await act(async () => {
      await dropHandler?.([svgFile]);
    });

    expect(maybeConvertSvgMock).not.toHaveBeenCalled();
    expect(uploadFileMock).toHaveBeenCalledWith(svgFile, { slotId: 'logo_light' });
    expect(setSiteAssetActionMock).toHaveBeenCalledWith('logo_light', 'file-1');
    expect(onSuccess).toHaveBeenCalledWith('site-logo-run');
  });

  it('converts email logos to a raster format before upload', async () => {
    const svgFile = new File(['<svg></svg>'], 'logo-email.svg', { type: 'image/svg+xml' });
    const pngFile = new File(['png'], 'logo-email.png', { type: 'image/png' });
    maybeConvertSvgMock.mockResolvedValue(pngFile);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SiteAssetUploader type="logo_email" currentUrl={null} />);
    });

    expect(dropHandler).toBeTruthy();

    await act(async () => {
      await dropHandler?.([svgFile]);
    });

    expect(maybeConvertSvgMock).toHaveBeenCalledWith(svgFile);
    expect(uploadFileMock).toHaveBeenCalledWith(pngFile, { slotId: 'logo_email' });
    expect(setSiteAssetActionMock).toHaveBeenCalledWith('logo_email', 'file-1');
  });
});
