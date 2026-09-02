// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import {
  createTiptapMapCommandPort,
  useAIAssistant,
  useMapInsert,
  type EditorMapCommandPort,
} from './useEditorFeatures';

vi.mock('@/features/editor/tiptap/ai/tiptap-ai', () => ({
  resolveTiptapAIContext: () => ({
    isSupported: true,
    currentBlockId: 'block-1',
    selectedBlockIds: ['block-1'],
    mode: 'generate',
  }),
}));

const editor = {
  isFocused: false,
  isDestroyed: false,
  state: { selection: { from: 1, to: 1, empty: true, constructor: { name: 'TextSelection' } } },
} as unknown as Editor;
const mapPort: EditorMapCommandPort = {
  captureInsertPosition: vi.fn(() => ({ referenceBlockId: 'block-1' })),
  insertMapBlock: vi.fn<EditorMapCommandPort['insertMapBlock']>(() => ({ ok: true, blockId: 'map-1' })),
};

let latestHooks: {
  ai: ReturnType<typeof useAIAssistant>;
  map: ReturnType<typeof useMapInsert>;
} | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

function HookHarness({ enabled }: { enabled: boolean }) {
  latestHooks = {
    ai: useAIAssistant(editor, undefined, enabled),
    map: useMapInsert(editor, { enabled, port: mapPort }),
  };
  return null;
}

function renderHarness(enabled: boolean) {
  act(() => {
    root?.render(<HookHarness enabled={enabled} />);
  });
}

function getHooks() {
  expect(latestHooks).not.toBeNull();
  return latestHooks!;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latestHooks = null;
  vi.mocked(mapPort.captureInsertPosition).mockClear();
  vi.mocked(mapPort.insertMapBlock).mockClear();
  vi.mocked(mapPort.captureInsertPosition).mockReturnValue({ referenceBlockId: 'block-1' });
  vi.mocked(mapPort.insertMapBlock).mockReturnValue({ ok: true, blockId: 'map-1' });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  latestHooks = null;
});

describe('editor authoring feature guards', () => {
  it('fails closed when a map picker returns to a destroyed editor', () => {
    const destroyedEditor = {
      isDestroyed: true,
      get schema() {
        throw new Error('Destroyed editor schema must not be read.');
      },
      get state() {
        throw new Error('Destroyed editor state must not be read.');
      },
    } as unknown as Editor;
    const port = createTiptapMapCommandPort(destroyedEditor);

    expect(port.captureInsertPosition()).toBeNull();
    expect(
      port.insertMapBlock(
        { id: 'map-1', type: 'map', props: { mapPlaceIds: 'place-1' } },
        { referenceBlockId: 'block-1' },
      ),
    ).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('closes an open AI assistant when authoring becomes disabled', () => {
    renderHarness(true);
    act(() => {
      getHooks().ai.openAIMenu();
    });
    expect(getHooks().ai.aiAssistant?.isOpen).toBe(true);

    renderHarness(false);

    expect(getHooks().ai.aiAssistant).toBeNull();
    act(() => {
      getHooks().ai.openAIMenu();
    });
    expect(getHooks().ai.aiAssistant).toBeNull();
  });

  it('closes map insertion and rejects a stale selection when authoring becomes disabled', () => {
    renderHarness(true);
    act(() => {
      getHooks().map.openMapInsert();
    });
    expect(getHooks().map.mapInsert.isOpen).toBe(true);

    renderHarness(false);
    expect(getHooks().map.mapInsert.isOpen).toBe(false);

    act(() => {
      getHooks().map.handleMapPlaceSelect('place-1', { lat: 37.5, lng: 127 });
    });
    expect(mapPort.insertMapBlock).not.toHaveBeenCalled();
  });

  it('uses the captured Tiptap block anchor when map selection returns from the picker', () => {
    renderHarness(true);
    act(() => {
      getHooks().map.openMapInsert();
    });
    act(() => {
      getHooks().map.handleMapPlaceSelect('place-1', { lat: 37.5, lng: 127 });
    });

    expect(mapPort.insertMapBlock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'map', props: expect.objectContaining({ mapPlaceIds: 'place-1' }) }),
      { referenceBlockId: 'block-1' },
    );
  });

  it('keeps the picker state open and exposes an explicit unsupported result', () => {
    vi.mocked(mapPort.insertMapBlock).mockReturnValueOnce({ ok: false, reason: 'unsupported_block' });
    renderHarness(true);
    act(() => {
      getHooks().map.openMapInsert();
      getHooks().map.handleMapPlaceSelect('place-1', { lat: 37.5, lng: 127 });
    });

    expect(getHooks().map.mapInsert).toMatchObject({ isOpen: true, error: 'unsupported_block' });
  });
});
