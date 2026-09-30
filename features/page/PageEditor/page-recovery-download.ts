import { toJson } from '@bufbuild/protobuf';
import { materializeCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { LocalizedPageDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import * as Y from 'yjs';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import type { DocumentLayout } from '@/features/document-layout';

export interface PageRecoveryDraft {
  title: string;
  summary: string;
  layout: DocumentLayout;
}

/** A portable recovery copy, never a command to overwrite the saved Page. */
export function serializePageRecoverySnapshot(snapshot: BlockRoomRecoverySnapshot, draft?: PageRecoveryDraft): string {
  if (
    snapshot.documentType !== 'page' ||
    snapshot.canonicalDocument.$typeName !== 'api.content.v1.LocalizedPageDocument'
  ) {
    throw new Error('Expected a Page recovery snapshot.');
  }
  const recovered = new Y.Doc();
  let localDocument;
  try {
    Y.applyUpdate(recovered, snapshot.yjsUpdate);
    const materialized = materializeCanonicalBlockRoom(recovered, 'page');
    if (materialized.$typeName === 'api.content.v1.LocalizedPageDocument') {
      localDocument = toJson(LocalizedPageDocumentSchema, materialized);
    }
  } catch {
    // Preserve the raw update even if an incomplete local graph cannot render.
  } finally {
    recovered.destroy();
  }
  return JSON.stringify(
    {
      format: 'geul-page-recovery-v1',
      pageId: snapshot.entityId,
      locale: snapshot.locale,
      sourceLocale: snapshot.sourceLocale,
      capturedAt: new Date(snapshot.capturedAt).toISOString(),
      documentRevision: snapshot.documentRevision,
      targetRevision: snapshot.targetRevision,
      localMetadata: draft,
      canonicalDocument: toJson(LocalizedPageDocumentSchema, snapshot.canonicalDocument),
      localDocument,
      yjsUpdate: Array.from(snapshot.yjsUpdate),
    },
    null,
    2,
  );
}

export function downloadPageRecoverySnapshot(snapshot: BlockRoomRecoverySnapshot, draft?: PageRecoveryDraft): void {
  const blob = new Blob([serializePageRecoverySnapshot(snapshot, draft)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `page-${snapshot.entityId}-${snapshot.locale}-recovery-${snapshot.capturedAt}.json`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
