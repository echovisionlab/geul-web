// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlockRoomMetadataUpdate, BlockRoomProtocolTransport } from '@/lib/collab/block-room-protocol';
import { mergeMetadataPatches } from './merge-metadata-patches';
import { useBlockRoomMetadataUpdates } from './useBlockRoomMetadataUpdates';
import { useDebouncedPatch } from './useDebouncedPatch';

interface MetadataPatch {
  categoryIds?: string[];
  tagIds?: string[];
  observed?: Record<string, unknown>;
  value?: Record<string, unknown>;
  previous?: Record<string, unknown>;
}

type MetadataQueue = ReturnType<typeof useDebouncedPatch<MetadataPatch>>;

class FakeMetadataChannel {
  private readonly listeners = new Set<(update: BlockRoomMetadataUpdate) => void>();
  private bootstrapUpdates: BlockRoomMetadataUpdate[] = [];

  subscribeMetadata = vi.fn((listener: (update: BlockRoomMetadataUpdate) => void) => {
    this.listeners.add(listener);
    this.bootstrapUpdates.forEach(listener);
    return () => this.listeners.delete(listener);
  });

  setBootstrap(...updates: BlockRoomMetadataUpdate[]) {
    this.bootstrapUpdates = updates;
    updates.forEach((update) => this.emit(update));
  }

  emit(update: BlockRoomMetadataUpdate) {
    this.listeners.forEach((listener) => listener(update));
  }

  listenerCount() {
    return this.listeners.size;
  }
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let queueRef: { current: MetadataQueue | null };

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function update(
  operation: BlockRoomMetadataUpdate['operation'],
  values: Record<string, unknown>,
  sequence: number,
): BlockRoomMetadataUpdate {
  return { operation, values, sequence };
}

function Harness({
  channel,
  onUpdate,
  write,
}: {
  channel: FakeMetadataChannel;
  onUpdate: (update: BlockRoomMetadataUpdate) => void;
  write: (patch: MetadataPatch) => Promise<void>;
}) {
  useBlockRoomMetadataUpdates({ protocol: channel as unknown as BlockRoomProtocolTransport }, 'post:post-1', onUpdate);
  queueRef.current = useDebouncedPatch<MetadataPatch>({
    write,
    delay: 60_000,
    scope: 'post:post-1',
    document: 'post:post-1',
    recoveryScope: null,
    merge: mergeMetadataPatches,
  });
  return null;
}

function mount(
  channel: FakeMetadataChannel,
  onUpdate: (update: BlockRoomMetadataUpdate) => void,
  write = async () => {},
) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  queueRef.current = null;
  act(() => root?.render(<Harness channel={channel} onUpdate={onUpdate} write={write} />));
}

beforeEach(() => {
  queueRef = { current: null };
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe('useBlockRoomMetadataUpdates', () => {
  it.each(['before', 'after'] as const)('receives bootstrap metadata when subscribing %s bootstrap', (timing) => {
    const channel = new FakeMetadataChannel();
    const onUpdate = vi.fn();
    const bootstrap = update('document', { categoryIds: ['category-bootstrap'] }, 0);

    if (timing === 'before') {
      channel.setBootstrap(bootstrap);
    }
    mount(channel, onUpdate);
    if (timing === 'after') {
      act(() => channel.setBootstrap(bootstrap));
    }

    expect(onUpdate).toHaveBeenCalledWith(bootstrap);
  });

  it('masks pending IDs, adopts unrelated peer fields, then applies the latest canonical IDs after queue acknowledgement', async () => {
    const channel = new FakeMetadataChannel();
    const onUpdate = vi.fn();
    let acknowledgeWrite: (() => void) | undefined;
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledgeWrite = resolve;
        }),
    );
    mount(channel, onUpdate, write);
    act(() => {
      channel.setBootstrap(update('document', { categoryIds: ['category-base'], tagIds: ['tag-base'] }, 0));
    });
    onUpdate.mockClear();

    act(() => {
      queueRef.current?.({ categoryIds: ['category-local'], observed: { categoryIds: ['category-base'] } });
      channel.emit(update('document', { categoryIds: ['category-peer'], tagIds: ['tag-peer'] }, 1));
    });
    expect(onUpdate).toHaveBeenLastCalledWith(update('document', { tagIds: ['tag-peer'] }, 1));

    let flush: Promise<boolean> | undefined;
    act(() => {
      flush = queueRef.current?.flush();
    });
    expect(write).toHaveBeenCalledWith({
      categoryIds: ['category-local'],
      observed: { categoryIds: ['category-base'] },
    });

    act(() => {
      channel.emit(update('document', { categoryIds: ['category-peer', 'category-local'], tagIds: ['tag-latest'] }, 2));
    });
    expect(onUpdate).toHaveBeenLastCalledWith(update('document', { tagIds: ['tag-latest'] }, 2));

    await act(async () => {
      acknowledgeWrite?.();
      await flush;
    });
    expect(onUpdate).toHaveBeenLastCalledWith(
      update('document', { categoryIds: ['category-peer', 'category-local'], tagIds: ['tag-latest'] }, 2),
    );
    expect(queueRef.current?.hasPending()).toBe(false);
  });

  it('masks only locally changed nested page layout fields', () => {
    const channel = new FakeMetadataChannel();
    const onUpdate = vi.fn();
    mount(channel, onUpdate);
    const previous = { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' };
    const value = { contentHeight: 'content', pageChrome: 'pinned', footer: 'flow' };

    act(() => {
      queueRef.current?.({ value, previous });
      channel.emit(
        update(
          'page_layout',
          {
            documentLayout: {
              contentHeight: 'DOCUMENT_CONTENT_HEIGHT_VIEWPORT',
              pageChrome: 'DOCUMENT_REGION_PLACEMENT_FLOW',
              footer: 'DOCUMENT_REGION_PLACEMENT_PINNED',
            },
          },
          1,
        ),
      );
    });

    expect(onUpdate).toHaveBeenLastCalledWith(
      update(
        'page_layout',
        {
          documentLayout: {
            contentHeight: 'DOCUMENT_CONTENT_HEIGHT_VIEWPORT',
            footer: 'DOCUMENT_REGION_PLACEMENT_PINNED',
          },
        },
        1,
      ),
    );
  });

  it('cleans up the previous protocol subscription on replacement and unmount', () => {
    const firstChannel = new FakeMetadataChannel();
    const nextChannel = new FakeMetadataChannel();
    const onUpdate = vi.fn();
    mount(firstChannel, onUpdate);
    expect(firstChannel.listenerCount()).toBe(1);

    act(() => root?.render(<Harness channel={nextChannel} onUpdate={onUpdate} write={async () => {}} />));
    expect(firstChannel.listenerCount()).toBe(0);
    expect(nextChannel.listenerCount()).toBe(1);

    const countBeforeUnmount = onUpdate.mock.calls.length;
    act(() => root?.unmount());
    root = null;
    expect(nextChannel.listenerCount()).toBe(0);
    firstChannel.emit(update('document', { categoryIds: ['ignored'] }, 1));
    nextChannel.emit(update('document', { categoryIds: ['ignored'] }, 1));
    expect(onUpdate).toHaveBeenCalledTimes(countBeforeUnmount);
  });
});
