// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'react-aria-components';
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
      <I18nProvider locale="en">
        <ImageUploadField {...baseProps} {...props} />
      </I18nProvider>,
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
