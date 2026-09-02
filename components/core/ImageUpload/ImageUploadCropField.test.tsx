// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ImageUploadCropField, type ImageUploadCropFieldProps } from './ImageUploadCropField';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

const labels: ImageUploadCropFieldProps['labels'] = {
  field: 'Cover image',
  imageAlt: 'Cover preview',
  emptyTitle: 'Upload cover image',
  emptyDescription: 'PNG or JPEG · 10 MB maximum',
  readOnlyDescription: 'No cover image',
  changeHint: 'Click the image to replace it',
  loading: 'Uploading image',
  removeButtonAriaLabel: 'Remove cover image',
  cropTitle: 'Crop cover image',
  cropPreviewAlt: 'Cover crop preview',
  cropCancel: 'Cancel',
  cropConfirm: 'Apply crop',
  cropProcessing: 'Preparing image',
};

const baseProps: ImageUploadCropFieldProps = {
  imageUrl: null,
  cropImageSrc: null,
  cropOpened: false,
  canEdit: true,
  loading: false,
  removeButtonLoading: false,
  labels,
  accept: ['image/png', 'image/jpeg'],
  maxSize: 10 * 1024 * 1024,
  onFileSelect: vi.fn(),
  onReject: vi.fn(),
  onCrop: vi.fn(),
  onCropClose: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

function renderField(overrides: Partial<ImageUploadCropFieldProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <ImageUploadCropField {...baseProps} {...overrides} />
      </MantineProvider>,
    );
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('ImageUploadCropField', () => {
  it('renders injected copy and forwards file-selection intent', () => {
    const onFileSelect = vi.fn();
    renderField({ idPrefix: 'cover', onFileSelect });

    expect(container.textContent).toContain('Cover image');
    expect(container.textContent).toContain('PNG or JPEG · 10 MB maximum');

    const input = container.querySelector<HTMLInputElement>('#cover-file-input');
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    act(() => input?.dispatchEvent(new Event('change', { bubbles: true })));

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('uses controller-supplied read-only and loading state', () => {
    renderField({ canEdit: false });
    expect(container.textContent).toContain('No cover image');

    renderField({ canEdit: true, loading: true, progress: 62 });
    expect(container.textContent).toContain('Uploading image');
    expect(container.textContent).toContain('62%');
  });
});
