// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorMediaCommandPort, SelectedFileBlock } from '../lib/media-block-updates';
import { DefaultFileToolbarButtons } from './FileToolbarButtons';

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));

const imageBlock: SelectedFileBlock = {
  id: 'block-image-1',
  type: 'file',
  props: { processingStatus: '', fileId: 'file-1', mimeType: 'image/jpeg' },
};

function createPort(block: SelectedFileBlock | null): EditorMediaCommandPort {
  return {
    getBlock: vi.fn((id) => (block?.id === id ? block : null)),
    updateBlockProps: vi.fn(() => true),
    deleteBlock: vi.fn((id) => block?.id === id),
    insertBlock: vi.fn(() => ({ ok: false as const, reason: 'unavailable' as const })),
    captureInsertPosition: vi.fn(() => null),
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('DefaultFileToolbarButtons', () => {
  it('uses the command port to delete and leaves dialog authority to composition', () => {
    const port = createPort(imageBlock);
    const onOpenMediaIngest = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <DefaultFileToolbarButtons port={port} selectedBlock={imageBlock} onOpenMediaIngest={onOpenMediaIngest} />,
      ),
    );
    const replace = container.querySelector('[data-test="replaceFileButton"]') as HTMLButtonElement;
    const remove = container.querySelector('[data-test="deleteFileButton"]') as HTMLButtonElement;
    act(() => replace.click());
    act(() => remove.click());

    expect(onOpenMediaIngest).toHaveBeenCalledWith(imageBlock.id);
    expect(port.deleteBlock).toHaveBeenCalledWith(imageBlock.id);
  });

  it('does not offer replacement while the selected block is processing', () => {
    const busyBlock = { ...imageBlock, props: { ...imageBlock.props, processingStatus: 'processing' } };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() =>
      root?.render(
        <DefaultFileToolbarButtons
          port={createPort(busyBlock)}
          selectedBlock={busyBlock}
          onOpenMediaIngest={vi.fn()}
        />,
      ),
    );

    expect(container.querySelector('[data-test="replaceFileButton"]')).toBeNull();
    expect(container.querySelector('[data-test="deleteFileButton"]')).not.toBeNull();
  });
});
