// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
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
        <MantineProvider>
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
        </MantineProvider>,
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const dropzone = input?.nextElementSibling as HTMLElement | null;
    const dropzoneInner = dropzone?.lastElementChild as HTMLElement | null;
    const placeholder = dropzoneInner?.firstElementChild as HTMLElement | null;

    expect(container.textContent).toContain('Drop or click to upload · PNG, ICO, SVG · Max 2 MB');
    expect(placeholder?.style.width).toBe('100%');
    expect(placeholder?.style.height).toBe('auto');
    expect(placeholder?.style.minHeight).toBe('96px');

    const fileInputs = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')];
    expect(fileInputs).toHaveLength(2);
    for (const fileInput of fileInputs) {
      expect(fileInput.accept.split(',')).toEqual(
        expect.arrayContaining(['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', '.ico']),
      );
    }

    const icoFile = new File(['ico'], 'favicon.ico', { type: '' });
    const dropEvent = new Event('drop', { bubbles: true });
    Object.assign(dropEvent, {
      dataTransfer: {
        files: [icoFile],
        items: [
          {
            kind: 'file',
            type: icoFile.type,
            getAsFile: () => icoFile,
          },
        ],
        types: ['Files'],
      },
    });

    await act(async () => {
      dropzone?.dispatchEvent(dropEvent);
      await Promise.resolve();
    });

    expect(onDrop).toHaveBeenCalledWith([icoFile]);
  });
});
