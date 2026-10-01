import { toJson } from '@bufbuild/protobuf';
import { materializeCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import {
  LocalizedRichTextDocumentSchema,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import * as Y from 'yjs';
import type { DocumentLayout } from '@/features/document-layout';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';

export interface PostRecoveryDraft {
  title: string;
  summary: string;
  commentsEnabled: boolean;
  mapPlaceId: string | null;
  layout: DocumentLayout;
}

/** A portable recovery copy, never a command to overwrite the saved Post. */
export function serializePostRecoverySnapshot(snapshot: BlockRoomRecoverySnapshot, draft?: PostRecoveryDraft): string {
  if (
    snapshot.documentType !== 'post' ||
    snapshot.canonicalDocument.$typeName !== 'api.content.v1.LocalizedRichTextDocument' ||
    snapshot.canonicalDocument.locale !== snapshot.locale
  ) {
    throw new Error('Expected a Post recovery snapshot for its captured locale.');
  }

  let localDocument: unknown;
  const recovered = new Y.Doc();
  try {
    Y.applyUpdate(recovered, snapshot.yjsUpdate);
    const materialized = materializeCanonicalBlockRoom(recovered, 'post');
    if (materialized.$typeName === 'api.content.v1.LocalizedRichTextDocument') {
      localDocument = toJson(LocalizedRichTextDocumentSchema, materialized);
    }
  } catch {
    // Preserve the raw update even if an incomplete local graph cannot render.
  } finally {
    recovered.destroy();
  }

  return JSON.stringify(
    {
      format: 'geul-post-recovery-v1',
      postId: snapshot.entityId,
      locale: snapshot.locale,
      sourceLocale: snapshot.sourceLocale,
      capturedAt: new Date(snapshot.capturedAt).toISOString(),
      documentRevision: snapshot.documentRevision,
      targetRevision: snapshot.targetRevision,
      localMetadata: draft,
      canonicalDocument: toJson(
        LocalizedRichTextDocumentSchema,
        snapshot.canonicalDocument as LocalizedRichTextDocument,
      ),
      localDocument,
      yjsUpdate: Array.from(snapshot.yjsUpdate),
    },
    null,
    2,
  );
}

export function downloadPostRecoverySnapshot(snapshot: BlockRoomRecoverySnapshot, draft?: PostRecoveryDraft): void {
  const blob = new Blob([serializePostRecoverySnapshot(snapshot, draft)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `post-${snapshot.entityId}-${snapshot.locale}-recovery-${snapshot.capturedAt}.json`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
