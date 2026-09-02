// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMediaCommandPort, SelectedFileBlock } from '../lib/media-block-updates';
import { MediaIngestDialog } from './MediaIngestDialog';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

vi.mock('@mantine/core', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/core/Modal', () => ({
  ContentModal: ({ children, onClose }: { children: ReactNode; onClose: () => void }) => (
    <div>
      <button data-testid="cancel" onClick={onClose} type="button">
        Cancel
      </button>
      {children}
    </div>
  ),
}));

vi.mock('@/components/core/Tabs', () => {
  const Tabs = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Tabs.List = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Tabs.Tab = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Tabs };
});

vi.mock('@/features/editor/components/EditorFileInsertPanel', () => ({
  EditorFileInsertPanel: ({
    onFilesSelected,
    onOpenLibrary,
  }: {
    onFilesSelected: (files: File[]) => void;
    onOpenLibrary: () => void;
  }) => (
    <div>
      <button data-testid="upload" onClick={() => onFilesSelected([new File(['data'], 'field.wav')])} type="button">
        Upload
      </button>
      <button data-testid="open-library" onClick={onOpenLibrary} type="button">
        Library
      </button>
    </div>
  ),
}));

vi.mock('@/features/editor/components/EditorFileLibraryPicker', () => ({
  EditorFileLibraryPicker: ({ onSelect }: { onSelect: (files: unknown[]) => void }) => (
    <button data-testid="select-library" onClick={() => onSelect([{ id: 'file-1' }])} type="button">
      Select
    </button>
  ),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const selectedBlock: SelectedFileBlock = {
  id: 'placeholder',
  type: 'file',
  props: { fileId: '', name: '' },
};

const editor: EditorMediaCommandPort = {
  getBlock: () => selectedBlock,
  updateBlockProps: () => false,
  deleteBlock: () => false,
  insertBlock: () => ({ ok: false, reason: 'invalid_block' }),
  captureInsertPosition: () => null,
};

function renderDialog(props: {
  onClose: (reason: 'cancelled' | 'committed') => void;
  onUploadFiles?: (files: File[]) => void;
  onSelectLibraryFiles?: Parameters<typeof MediaIngestDialog>[0]['onSelectLibraryFiles'];
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <MediaIngestDialog
        opened
        editor={editor}
        selectedBlock={selectedBlock}
        blockType="file"
        onClose={props.onClose}
        onUploadFiles={props.onUploadFiles ?? (() => undefined)}
        onSelectLibraryFiles={props.onSelectLibraryFiles}
      />,
    );
  });
  return container;
}

function click(testId: string) {
  const button = container?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!button) {
    throw new Error(`Missing ${testId}`);
  }
  act(() => button.click());
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('MediaIngestDialog close authority', () => {
  it('reports an explicit cancellation from modal close', () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    click('cancel');

    expect(onClose).toHaveBeenCalledWith('cancelled');
  });

  it('commits the session before handing selected local files to ingest', () => {
    const order: string[] = [];
    renderDialog({
      onClose: (reason) => order.push(`close:${reason}`),
      onUploadFiles: () => order.push('upload'),
    });

    click('upload');

    expect(order).toEqual(['close:committed', 'upload']);
  });

  it('commits the session before handing a library selection to ingest', () => {
    const order: string[] = [];
    renderDialog({
      onClose: (reason) => order.push(`close:${reason}`),
      onSelectLibraryFiles: () => order.push('library'),
    });

    click('open-library');
    click('select-library');

    expect(order).toEqual(['close:committed', 'library']);
  });
});
