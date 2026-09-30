// @vitest-environment jsdom

import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedPageDocumentSchema,
  type LocalizedPageDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import {
  hydrateCanonicalBlockRoom,
  materializeCanonicalBlockRoom,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import * as Y from 'yjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import { createBlockRoomPageSectionsController } from './block-room-page-sections';
import { createDefaultSection } from './types';
import { downloadPageRecoverySnapshot, serializePageRecoverySnapshot } from './page-recovery-download';

function snapshot(): BlockRoomRecoverySnapshot {
  const document = new Y.Doc();
  hydrateCanonicalBlockRoom(
    document,
    'page',
    'en',
    fromJson(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      locale: 'en',
      base: { nodes: [] },
      localeOverlay: { locale: 'en', sections: [] },
    }),
    [],
  );
  const controller = createBlockRoomPageSectionsController(document, 'en');
  const section = {
    ...createDefaultSection('external-video'),
    props: { url: 'https://example.com/video', caption: 'Saved caption' },
  };
  controller.insert(section, { index: 0 });
  const canonicalDocument = materializeCanonicalBlockRoom(document, 'page') as LocalizedPageDocument;
  controller.updateLocaleProps(section.id, { caption: 'Local caption before reconnect' });
  const result: BlockRoomRecoverySnapshot = {
    documentType: 'page',
    entityId: '11111111-1111-4111-8111-111111111111',
    locale: 'en',
    sourceLocale: 'en',
    capturedAt: 1000,
    documentRevision: 'saved-revision',
    canonicalDocument,
    yjsUpdate: Y.encodeStateAsUpdate(document),
  };
  document.destroy();
  return result;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Page recovery download', () => {
  it('exports saved and local content separately and retains a replayable copy after teardown', () => {
    const recovered = JSON.parse(
      serializePageRecoverySnapshot(snapshot(), {
        title: 'Local title',
        summary: 'Local summary',
        layout: { contentHeight: 'viewport', pageChrome: 'flow', footer: 'flow' },
      }),
    );
    expect(recovered.localMetadata.title).toBe('Local title');
    expect(recovered.canonicalDocument.localeOverlay.sections[0].externalVideo.props.caption).toBe('Saved caption');
    expect(recovered.localDocument.localeOverlay.sections[0].externalVideo.props.caption).toBe(
      'Local caption before reconnect',
    );
    const replay = new Y.Doc();
    Y.applyUpdate(replay, Uint8Array.from(recovered.yjsUpdate));
    expect(createBlockRoomPageSectionsController(replay, 'en').read()[0]?.props?.caption).toBe(
      'Local caption before reconnect',
    );
    replay.destroy();
  });
  it('keeps the raw recovery copy when an incomplete graph cannot be materialized', () => {
    const copy = snapshot();
    copy.yjsUpdate = Uint8Array.of(1, 2, 3);
    const recovered = JSON.parse(serializePageRecoverySnapshot(copy));
    expect(recovered.localDocument).toBeUndefined();
    expect(recovered.yjsUpdate).toEqual([1, 2, 3]);
  });
  it('downloads the scoped JSON file and releases its temporary URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:recovery');
    const revokeObjectURL = vi.fn();
    const NativeURL = URL;
    vi.stubGlobal(
      'URL',
      class extends NativeURL {
        static createObjectURL = createObjectURL;
        static revokeObjectURL = revokeObjectURL;
      },
    );
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('page-11111111-1111-4111-8111-111111111111-en-recovery-1000.json');
      expect(this.href).toBe('blob:recovery');
    });
    downloadPageRecoverySnapshot(snapshot());
    expect(clicked).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:recovery');
  });
});
