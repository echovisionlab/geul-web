// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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

function renderPanel(
  multiple: boolean,
  onFilesSelected: (files: File[]) => void,
  presentation?: { showDescription?: boolean; showLibraryAction?: boolean },
) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <EditorFileInsertPanel
            multiple={multiple}
            onFilesSelected={onFilesSelected}
            onOpenLibrary={vi.fn()}
            {...presentation}
          />
        </DesignSystemProvider>
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
  it('keeps the actual native browse action when tabbed composition hides redundant guidance', () => {
    const onFilesSelected = vi.fn();
    renderPanel(true, onFilesSelected, { showDescription: false, showLibraryAction: false });
    expect(container.textContent).not.toContain(enMessages.editorCommon.media.ingestDialog.unifiedDescription);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const openPicker = vi.spyOn(input, 'click').mockImplementation(() => {});
    act(() => container.querySelector<HTMLButtonElement>('button')?.click());
    expect(openPicker).toHaveBeenCalledOnce();
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    selectFiles(input, [file]);
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
    expect(input.value).toBe('');
    openPicker.mockRestore();
  });

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
