// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { SiteLoaderAssetsUploader } from './SiteLoaderAssetsUploader';

const uploadFileMock = vi.fn();
const addSiteLoaderAssetActionMock = vi.fn();
const removeSiteLoaderAssetActionMock = vi.fn();

let fileSelectHandler: ((file: File) => void | Promise<void>) | null = null;
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

vi.mock('@/components/core/ImageUpload', () => ({
  ImageUploadField: ({ onFileSelect }: { onFileSelect: (file: File) => void | Promise<void> }) => {
    fileSelectHandler = onFileSelect;
    return <div data-testid="image-upload-field" />;
  },
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
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
  addSiteLoaderAssetAction: (...args: any[]) => addSiteLoaderAssetActionMock(...args),
  removeSiteLoaderAssetAction: (...args: any[]) => removeSiteLoaderAssetActionMock(...args),
}));

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  uploadFileMock.mockResolvedValue({ fileId: 'file-1', url: '/media/site/loader/file-1.gif' });
  addSiteLoaderAssetActionMock.mockResolvedValue({ success: true });
  removeSiteLoaderAssetActionMock.mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  fileSelectHandler = null;
  uploadFileMock.mockReset();
  addSiteLoaderAssetActionMock.mockReset();
  removeSiteLoaderAssetActionMock.mockReset();
});

describe('SiteLoaderAssetsUploader', () => {
  it('uploads a loader and appends it to the loader pool', async () => {
    const file = new File(['gif'], 'loader.gif', { type: 'image/gif' });

    act(() => {
      root?.render(
        <MantineProvider>
          <SiteLoaderAssetsUploader assets={[]} />
        </MantineProvider>,
      );
    });

    expect(fileSelectHandler).toBeTruthy();
    await act(async () => {
      await fileSelectHandler?.(file);
    });

    expect(uploadFileMock).toHaveBeenCalledWith(file, { slotId: 'loader' });
    expect(addSiteLoaderAssetActionMock).toHaveBeenCalledWith('file-1');
  });

  it('removes a selected loader asset by file id', async () => {
    act(() => {
      root?.render(
        <MantineProvider>
          <SiteLoaderAssetsUploader
            assets={[{ file_id: 'file-2', url: 'https://cdn.example.com/media/site/loader/file-2.gif' }]}
          />
        </MantineProvider>,
      );
    });

    const removeButton = container?.querySelector('button');
    expect(removeButton).toBeTruthy();

    await act(async () => {
      removeButton?.click();
    });

    expect(removeSiteLoaderAssetActionMock).toHaveBeenCalledWith('file-2');
  });
});
