// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteOgBackgroundUploader } from './SiteOgBackgroundUploader';

const uploadMock = vi.fn();
const setSiteAssetActionMock = vi.fn();
const deleteSiteAssetActionMock = vi.fn();
let removeHandler: (() => void | Promise<void>) | null = null;
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
    mutate: async (vars?: any) => {
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

vi.mock('@/components/core/Notification', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({
    imageUrl,
    onRemove,
  }: {
    imageUrl: string | null;
    onUpload: (blob: Blob) => void | Promise<void>;
    onRemove: () => void | Promise<void>;
  }) => {
    removeHandler = onRemove;
    return <div data-testid="featured-image-url">{imageUrl ?? ''}</div>;
  },
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({
    upload: uploadMock,
    isUploading: false,
  }),
}));

vi.mock('@/lib/actions/site-setting', () => ({
  setSiteAssetAction: (...args: any[]) => setSiteAssetActionMock(...args),
  deleteSiteAssetAction: (...args: any[]) => deleteSiteAssetActionMock(...args),
}));

beforeEach(() => {
  uploadMock.mockResolvedValue({ fileId: 'file-1', url: '/uploaded-source.webp' });
  setSiteAssetActionMock.mockResolvedValue({ success: true });
  deleteSiteAssetActionMock.mockResolvedValue({ success: true, assetUrl: null });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  removeHandler = null;
  uploadMock.mockReset();
  setSiteAssetActionMock.mockReset();
  deleteSiteAssetActionMock.mockReset();
});

describe('SiteOgBackgroundUploader', () => {
  it('clears the current background immediately after delete succeeds', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<SiteOgBackgroundUploader type="terms_og_background" currentUrl="/existing-og-background.webp" />);
    });

    expect(container.textContent).toContain('/existing-og-background.webp');

    await act(async () => {
      await removeHandler?.();
    });

    expect(deleteSiteAssetActionMock).toHaveBeenCalledWith('terms_og_background');
    expect(container.textContent).not.toContain('/existing-og-background.webp');
  });
});
