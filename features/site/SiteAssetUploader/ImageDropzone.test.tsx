// @vitest-environment jsdom

import { TestProviders } from '@/test/TestProviders';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageDropzone } from './ImageDropzone';

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

describe('ImageDropzone', () => {
  it('keeps the compact empty surface usable and accepts extension-only ICO files', async () => {
    const onDrop = vi.fn();

    act(() => {
      root.render(
        <TestProviders>
          <ImageDropzone
            currentUrl={null}
            uploading={false}
            deleting={false}
            accept={{
              'image/png': [],
              'image/x-icon': ['.ico'],
              'image/vnd.microsoft.icon': ['.ico'],
              'image/svg+xml': [],
            }}
            maxSize={2 * 1024 * 1024}
            previewHeight={32}
            previewWidth={32}
            label="Site Favicon"
            description="Used in browser tabs and bookmarks."
            uploadPrompt="Drop or click to upload · PNG, ICO, SVG · Max 2 MB"
            onDrop={onDrop}
            onDelete={vi.fn()}
          />
        </TestProviders>,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-label="Site Favicon"]');
    const placeholder = container.querySelector<HTMLElement>('[data-shape="square"]');
    expect(trigger).not.toBeNull();

    expect(container.textContent).toContain('Drop or click to upload · PNG, ICO, SVG · Max 2 MB');
    expect(placeholder?.style.width).toBe('100%');
    expect(placeholder?.style.height).toBe('auto');
    expect(placeholder?.style.minHeight).toBe('96px');

    const fileInputs = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    expect(fileInputs.length).toBeGreaterThan(0);
    for (const fileInput of fileInputs) {
      expect(fileInput.accept.split(',')).toEqual(
        expect.arrayContaining(['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', '.ico']),
      );
    }

    const icoFile = new File(['ico'], 'favicon.ico', { type: '' });
    Object.defineProperty(input!, 'files', { configurable: true, value: [icoFile] });
    await act(async () => {
      input!.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onDrop).toHaveBeenCalledWith([icoFile]);
  });
});
