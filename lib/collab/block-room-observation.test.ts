import { fromJson, type JsonValue } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';
import { observeSharedBlockRoomChanges, type SharedBlockRoomChange } from './block-room-observation';
import { createDefaultSection } from '@/features/page/PageEditor/types';

function pageRoom(): Y.Doc {
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    'page',
    'ko',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'ko',
      base: { nodes: [] },
      localeOverlay: { locale: 'ko', sections: [] },
    } as JsonValue),
    [],
  );
  return document;
}

describe('shared Block-room observer', () => {
  it('fans out synchronously, shares event data, and queues reentrant transactions', () => {
    const document = pageRoom();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const firstSection = createDefaultSection('rich-text');
    const secondSection = createDefaultSection('post-list');
    const firstEvents: SharedBlockRoomChange[] = [];
    const secondEvents: SharedBlockRoomChange[] = [];
    const lateEvents: SharedBlockRoomChange[] = [];
    let stopLate: (() => void) | undefined;

    const stopFirst = observeSharedBlockRoomChanges(document, (change) => {
      firstEvents.push(change);
      if (firstEvents.length === 1) {
        stopLate = observeSharedBlockRoomChanges(document, (nestedChange) => lateEvents.push(nestedChange));
        controller.insert(firstSection, { index: 0 });
        controller.insert(secondSection, { index: 1 });
      }
    });
    const stopSecond = observeSharedBlockRoomChanges(document, (change) => secondEvents.push(change));

    controller.insert(createDefaultSection('author-list'), { index: 0 });

    expect(firstEvents).toHaveLength(3);
    expect(secondEvents).toHaveLength(3);
    expect(lateEvents).toHaveLength(2);
    expect(firstEvents[0]).toBe(secondEvents[0]);
    expect(firstEvents[1]).toBe(secondEvents[1]);
    expect(firstEvents[2]).toBe(secondEvents[2]);
    expect(firstEvents[0]?.snapshot()).toBe(secondEvents[0]?.snapshot());

    stopLate?.();
    stopFirst();
    stopSecond();
    document.destroy();
  });

  it('supports unsubscription during dispatch, reconnects cleanly, and continues after a listener throws', () => {
    const document = pageRoom();
    const controller = createBlockRoomPageSectionsController(document, 'ko');
    const selfChanges = vi.fn();
    const survivingChanges = vi.fn();
    let stopSelf = (): void => undefined;
    stopSelf = observeSharedBlockRoomChanges(document, () => {
      selfChanges();
      stopSelf();
    });
    const stopSurviving = observeSharedBlockRoomChanges(document, survivingChanges);

    controller.insert(createDefaultSection('author-list'), { index: 0 });
    expect(selfChanges).toHaveBeenCalledOnce();
    expect(survivingChanges).toHaveBeenCalledOnce();
    stopSurviving();

    const reconnectedChanges = vi.fn();
    const stopReconnected = observeSharedBlockRoomChanges(document, reconnectedChanges);
    controller.insert(createDefaultSection('post-list'), { index: 1 });
    expect(reconnectedChanges).toHaveBeenCalledOnce();
    stopReconnected();

    const stopThrowing = observeSharedBlockRoomChanges(document, () => {
      throw new Error('observer fault');
    });
    const afterThrow = vi.fn();
    const stopAfterThrow = observeSharedBlockRoomChanges(document, afterThrow);
    expect(() => controller.insert(createDefaultSection('rich-text'), { index: 2 })).toThrow('observer fault');
    expect(afterThrow).toHaveBeenCalledOnce();
    expect(controller.read()).toHaveLength(3);

    stopThrowing();
    stopAfterThrow();
    document.destroy();
  });
});
