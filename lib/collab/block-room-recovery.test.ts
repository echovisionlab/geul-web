import { create } from '@bufbuild/protobuf';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import { createBlockRoomDocumentName, type BlockRoomBootstrap } from './block-room-bootstrap';
import {
  createBlockRoomRecoverySnapshot,
  matchesBlockRoomRecoveryScope,
  retainBlockRoomRecoverySnapshot,
} from './block-room-recovery';

const entityId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';

function bootstrap(
  options: { documentName?: string; locale?: string; sourceLocale?: string; targetRevision?: string } = {},
): BlockRoomBootstrap {
  const locale = options.locale ?? 'ko';
  const sourceLocale = options.sourceLocale ?? 'ko';
  return {
    documentName: options.documentName ?? createBlockRoomDocumentName('page', entityId, locale),
    documentType: 'page',
    document: create(LocalizedPageDocumentSchema, {
      blockCatalogFingerprint: 'catalog-v1',
      locale,
      base: { nodes: [] },
      localeOverlay: { locale, sections: [] },
    }),
    documentRevision: 'b67328c4-668c-5bf2-8f1e-41465149ded6',
    sourceLocale,
    locale,
    localeExists: true,
    presentLocaleValues: [],
    sourceMetadata: { locale: sourceLocale },
    localeMetadata: { locale },
    documentMetadata: {},
    metadataSequence: 0,
    blockCatalogFingerprint: 'catalog-v1',
    serverInstanceId: 'collab-1',
    roomEpoch: 'bdac72af-8a24-4214-999d-83727445cbd7',
    bootstrapChallenge: 'challenge-1',
    yjsBootstrapUpdate: Uint8Array.of(0, 0),
    ...(options.targetRevision === undefined ? {} : { targetRevision: options.targetRevision }),
  } as BlockRoomBootstrap;
}

function snapshot(capturedAt: number) {
  return createBlockRoomRecoverySnapshot({
    documentType: 'page',
    entityId,
    locale: 'ko',
    admitted: true,
    bootstrap: bootstrap(),
    yjsUpdate: Uint8Array.of(1, 2, 3),
    capturedAt,
  });
}

describe('block-room recovery snapshots', () => {
  it('captures only an admitted bootstrap that matches the requested room', () => {
    const canonical = bootstrap();
    const input = {
      documentType: 'page' as const,
      entityId,
      locale: 'ko',
      bootstrap: canonical,
      yjsUpdate: Uint8Array.of(1, 2, 3),
      capturedAt: 100,
    };

    expect(createBlockRoomRecoverySnapshot({ ...input, admitted: false })).toBeNull();
    expect(createBlockRoomRecoverySnapshot({ ...input, admitted: true, bootstrap: null })).toBeNull();
    expect(createBlockRoomRecoverySnapshot({ ...input, admitted: true, locale: 'ja' })).toBeNull();
    expect(
      createBlockRoomRecoverySnapshot({
        ...input,
        admitted: true,
        bootstrap: bootstrap({ documentName: `page:${entityId}:ja` }),
      }),
    ).toBeNull();
  });

  it('copies the canonical document and Yjs update with revision metadata', () => {
    const canonical = bootstrap({ locale: 'ja', sourceLocale: 'ko', targetRevision: `tr1_${'A'.repeat(43)}` });
    const update = Uint8Array.of(4, 5, 6);
    const result = createBlockRoomRecoverySnapshot({
      documentType: 'page',
      entityId,
      locale: 'ja',
      admitted: true,
      bootstrap: canonical,
      yjsUpdate: update,
      capturedAt: 200,
    });

    expect(result).toMatchObject({
      documentType: 'page',
      entityId,
      locale: 'ja',
      capturedAt: 200,
      sourceLocale: 'ko',
      documentRevision: canonical.documentRevision,
      targetRevision: `tr1_${'A'.repeat(43)}`,
      canonicalDocument: canonical.document,
      yjsUpdate: Uint8Array.of(4, 5, 6),
    });
    expect(result?.canonicalDocument).not.toBe(canonical.document);
    expect(result?.yjsUpdate).not.toBe(update);
    update[0] = 99;
    expect([...result!.yjsUpdate]).toEqual([4, 5, 6]);
  });

  it('retains a same-room snapshot until the next admitted document has local changes', () => {
    const original = snapshot(300)!;
    const repeated = snapshot(400)!;

    expect(matchesBlockRoomRecoveryScope(original, { documentType: 'page', entityId, locale: 'ko' })).toBe(true);
    expect(matchesBlockRoomRecoveryScope(original, { documentType: 'page', entityId, locale: 'ja' })).toBe(false);
    expect(matchesBlockRoomRecoveryScope(original, { documentType: 'post', entityId, locale: 'ko' })).toBe(false);
    expect(retainBlockRoomRecoverySnapshot(original, repeated, false)).toBe(original);
    expect(retainBlockRoomRecoverySnapshot(original, repeated, true)).toBe(repeated);
  });
});
