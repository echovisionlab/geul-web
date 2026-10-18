// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { usePostBlockRoomController, useRichTextBlockRoomController } from './useBlockRoomTiptapController';

const mocks = vi.hoisted(() => ({
  createBridge: vi.fn(),
  createController: vi.fn(),
  createPostController: vi.fn(),
}));

vi.mock('@/features/editor/tiptap/block-room-prosemirror-bridge', () => ({
  createBlockRoomProseMirrorBridge: mocks.createBridge,
}));

vi.mock('@/features/editor/tiptap/block-room-tiptap-controller', () => ({
  createPostBlockRoomTiptapController: mocks.createPostController,
  createRichTextBlockRoomTiptapController: mocks.createController,
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let latestController: ReturnType<typeof useRichTextBlockRoomController> = null;
let latestPostController: ReturnType<typeof usePostBlockRoomController> = null;

function TestHarness({ document, locale }: { document: Y.Doc | null; locale: string | null }) {
  latestController = useRichTextBlockRoomController('artist', document, locale);
  return null;
}

function PostTestHarness({ document, locale }: { document: Y.Doc | null; locale: string | null }) {
  latestPostController = usePostBlockRoomController(document, locale);
  return null;
}

async function render(document: Y.Doc | null, locale: string | null) {
  await act(async () => {
    root?.render(<TestHarness document={document} locale={locale} />);
    await Promise.resolve();
  });
}

async function renderPost(document: Y.Doc | null, locale: string | null) {
  await act(async () => {
    root?.render(<PostTestHarness document={document} locale={locale} />);
    await Promise.resolve();
  });
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  latestController = null;
  latestPostController = null;
  mocks.createBridge.mockReset();
  mocks.createController.mockReset();
  mocks.createPostController.mockReset();
  mocks.createBridge.mockImplementation((options) => ({ options }));
  mocks.createController.mockImplementation((bridge) => ({ bridge }));
  mocks.createPostController.mockImplementation((bridge) => ({ bridge }));
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useRichTextBlockRoomController', () => {
  it('does not construct a typed adapter until both a ready document and locale exist', async () => {
    const resident = new Y.Doc();

    await render(null, 'ko');
    expect(latestController).toBeNull();

    await render(resident, null);
    expect(latestController).toBeNull();
    expect(mocks.createBridge).not.toHaveBeenCalled();
    expect(mocks.createController).not.toHaveBeenCalled();

    resident.destroy();
  });

  it('owns controller construction and replaces it only when the room inputs change', async () => {
    const resident = new Y.Doc();

    await render(resident, 'ko');
    const koreanController = latestController;
    expect(mocks.createBridge).toHaveBeenCalledWith({
      document: resident,
      documentType: 'artist',
      locale: 'ko',
    });
    expect(mocks.createController).toHaveBeenCalledOnce();

    await render(resident, 'ko');
    expect(latestController).toBe(koreanController);
    expect(mocks.createBridge).toHaveBeenCalledOnce();
    expect(mocks.createController).toHaveBeenCalledOnce();

    await render(resident, 'en');
    expect(latestController).not.toBe(koreanController);
    expect(mocks.createBridge).toHaveBeenCalledTimes(2);
    expect(mocks.createController).toHaveBeenCalledTimes(2);

    resident.destroy();
  });

  it('owns the post-specific controller factory behind the same ready document boundary', async () => {
    const resident = new Y.Doc();

    await renderPost(resident, 'ko');

    expect(mocks.createBridge).toHaveBeenCalledWith({
      document: resident,
      documentType: 'post',
      locale: 'ko',
    });
    expect(mocks.createPostController).toHaveBeenCalledOnce();
    expect(latestPostController).not.toBeNull();

    resident.destroy();
  });
});
