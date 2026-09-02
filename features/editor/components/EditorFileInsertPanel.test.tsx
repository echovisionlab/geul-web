// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { EditorFileInsertPanel } from './EditorFileInsertPanel';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderPanel(multiple: boolean, onFilesSelected: (files: File[]) => void) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <MantineProvider>
          <EditorFileInsertPanel multiple={multiple} onFilesSelected={onFilesSelected} onOpenLibrary={vi.fn()} />
        </MantineProvider>
      </NextIntlClientProvider>,
    );
  });
}

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  Object.defineProperty(input, 'value', { configurable: true, writable: true, value: 'selected' });
  act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
}

describe('EditorFileInsertPanel', () => {
  it('delegates multi-file picking to FileButton and resets the native input', () => {
    const onFilesSelected = vi.fn();
    renderPanel(true, onFilesSelected);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const files = [
      new File(['image'], 'cover.png', { type: 'image/png' }),
      new File(['audio'], 'field.wav', { type: 'audio/wav' }),
    ];

    expect(input).not.toBeNull();
    expect(input?.multiple).toBe(true);
    expect(input?.accept).toContain('image/');
    expect(input?.accept).toContain('audio/');
    selectFiles(input!, files);

    expect(onFilesSelected).toHaveBeenCalledWith(files);
    expect(input?.value).toBe('');
  });

  it('normalizes single-file picking to the feature array contract', () => {
    const onFilesSelected = vi.fn();
    renderPanel(false, onFilesSelected);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const first = new File(['first'], 'first.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'second.pdf', { type: 'application/pdf' });

    expect(input?.multiple).toBe(false);
    selectFiles(input!, [first, second]);

    expect(onFilesSelected).toHaveBeenCalledWith([first]);
    expect(input?.value).toBe('');
  });
});
