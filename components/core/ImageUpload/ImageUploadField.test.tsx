// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ImageUploadField, type ImageUploadFieldProps } from './ImageUploadField';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

let container: HTMLDivElement;
let root: Root;

const baseProps: ImageUploadFieldProps = {
  alt: 'Preview image',
  label: 'Logo',
  emptyTitle: 'Upload an image',
  emptyDescription: 'SVG, PNG or JPG',
  inputId: 'image-input',
  accept: ['image/png', 'image/svg+xml'],
  preview: {
    mode: 'hug',
    maxWidth: 320,
    maxHeight: 120,
  },
  placeholder: {
    width: 320,
    minHeight: 120,
  },
};

function renderField(props: Partial<ImageUploadFieldProps> = {}) {
  act(() => {
    root.render(
      <MantineProvider>
        <ImageUploadField {...baseProps} {...props} />
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
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe('ImageUploadField', () => {
  it('renders placeholder copy and forwards hidden input file selections', () => {
    const onFileSelect = vi.fn();
    renderField({ onFileSelect });

    expect(container.textContent).toContain('Logo');
    expect(container.textContent).toContain('Upload an image');
    expect(container.textContent).toContain('SVG, PNG or JPG');

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('accept')).toBe('image/png,image/svg+xml');
    if (!input) {
      throw new Error('expected hidden file input to render');
    }

    const file = new File(['image-bytes'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('matches the empty dropzone hitbox to the bounded placeholder surface', () => {
    renderField({
      dropzoneId: 'bounded-logo-dropzone',
      dropzoneAriaLabel: 'Upload logo',
      onFileSelect: vi.fn(),
      placeholder: {
        width: '100%',
        maxWidth: 360,
        aspectRatio: '3 / 1',
      },
    });

    const dropzone = container.querySelector<HTMLElement>('#bounded-logo-dropzone');
    const placeholder = dropzone?.querySelector<HTMLElement>('[data-interactive="true"]');
    const dropzoneInput = dropzone?.querySelector<HTMLInputElement>('input[type="file"]');

    expect(dropzone?.style.width).toBe('100%');
    expect(dropzone?.style.maxWidth).toBe('360px');
    expect(dropzone?.getAttribute('aria-label')).toBe('Upload logo');
    expect(dropzoneInput?.getAttribute('aria-label')).toBe('Upload logo');
    expect(placeholder?.style.width).toBe('100%');
    expect(placeholder?.style.maxWidth).toBe('360px');
    expect(placeholder?.style.aspectRatio).toBe('3 / 1');
  });

  it('keeps full-width empty upload consumers full width instead of inheriting the preview cap', () => {
    renderField({
      dropzoneId: 'full-width-dropzone',
      onFileSelect: vi.fn(),
      preview: {
        mode: 'fixed',
        width: '100%',
        maxWidth: 400,
        minHeight: 96,
      },
      placeholder: {
        width: '100%',
        minHeight: 96,
      },
    });

    const dropzone = container.querySelector<HTMLElement>('#full-width-dropzone');
    expect(dropzone?.style.width).toBe('100%');
    expect(dropzone?.style.maxWidth).toBe('100%');
  });

  it('uses the same responsive placeholder dimensions while loading', () => {
    renderField({
      loading: true,
      loadingLabel: 'Uploading logo',
      preview: {
        mode: 'hug',
        width: 'auto',
        maxWidth: 432,
      },
      placeholder: {
        width: '100%',
        maxWidth: 360,
        aspectRatio: '3 / 1',
      },
    });

    const placeholder = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      (element) => element.style.aspectRatio === '3 / 1',
    );

    expect(placeholder?.style.width).toBe('100%');
    expect(placeholder?.style.maxWidth).toBe('360px');
    expect(placeholder?.style.aspectRatio).toBe('3 / 1');
  });

  it('renders the preview at intrinsic ratio and removes it from the overlay button', () => {
    const onRemove = vi.fn();
    renderField({
      imageUrl: '/logo.svg',
      changeHint: 'Click the image to replace',
      dropzoneId: 'change-logo-dropzone',
      dropzoneAriaLabel: 'Change logo',
      removeButtonAriaLabel: 'Remove logo',
      onRemove,
      onFileSelect: vi.fn(),
    });

    const image = container.querySelector<HTMLImageElement>('img');
    const previewSurface = image?.parentElement?.parentElement;
    const dropzone = previewSurface?.parentElement?.parentElement;
    expect(image?.getAttribute('src')).toBe('/logo.svg');
    expect(image?.getAttribute('alt')).toBe('Preview image');
    expect(image?.style.width).toBe('auto');
    expect(previewSurface?.style.width).toBe('fit-content');
    expect(dropzone?.style.width).toBe('fit-content');
    expect(
      container.querySelector<HTMLInputElement>('#change-logo-dropzone input[type="file"]')?.getAttribute('aria-label'),
    ).toBe('Change logo');
    expect(container.textContent).toContain('Click the image to replace');

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Remove logo"]')?.click();
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders fixed-ratio previews through the full-width shared frame', () => {
    renderField({
      imageUrl: '/featured.webp',
      onFileSelect: vi.fn(),
      preview: {
        mode: 'fixed',
        width: '100%',
        aspectRatio: '1200 / 630',
        minHeight: 120,
        fit: 'cover',
      },
    });

    const image = container.querySelector<HTMLImageElement>('img');
    const frame = image?.parentElement;
    const outerFrame = frame?.parentElement;
    expect(image?.getAttribute('src')).toBe('/featured.webp');
    expect(image?.style.width).toBe('100%');
    expect(image?.style.height).toBe('100%');
    expect(image?.style.objectFit).toBe('cover');
    expect(frame?.style.aspectRatio).toBe('1200 / 630');
    expect(outerFrame?.style.width).toBe('100%');
    expect(outerFrame?.style.maxWidth).toBe('100%');
  });

  it('uses the loading placeholder instead of stale image or empty copy', () => {
    renderField({
      imageUrl: '/old-logo.png',
      loading: true,
      loadingLabel: 'Uploading logo',
      progress: 45,
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Uploading logo');
    expect(container.textContent).toContain('45%');
    expect(container.textContent).not.toContain('Upload an image');
  });
});
