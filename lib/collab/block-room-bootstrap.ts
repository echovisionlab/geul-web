import { equals, fromJson, toBinary, type JsonValue } from '@bufbuild/protobuf';
import {
  blockRoomPresentLocaleValues,
  materializeCanonicalBlockRoom,
  type BlockRoomDocumentType,
} from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { CollaborativeDocumentType, createDocumentName } from '@echovisionlab/geul-common/collaboration/document';
import {
  LocalizedPageDocumentSchema,
  LocalizedRichTextDocumentSchema,
  type LocalizedPageDocument,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { AIDocumentFieldTargetSchema, type AIDocumentFieldTarget } from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import {
  bootstrapSchema,
  documentBodyDigest,
  KNOWN_DOCUMENT_DIGEST_PARAM,
  KNOWN_DOCUMENT_REVISION_PARAM,
  type BootstrapMessage,
  type LocaleMetadata,
} from '@echovisionlab/geul-common/collaboration/protocol';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
export { targetRevisionSchema } from '@echovisionlab/geul-common/collaboration/protocol';
import * as Y from 'yjs';

export type { BlockRoomDocumentType };

const collaborativeDocumentTypes = {
  post: CollaborativeDocumentType.POST,
  page: CollaborativeDocumentType.PAGE,
  work: CollaborativeDocumentType.WORK,
  'program-event': CollaborativeDocumentType.PROGRAM_EVENT,
  artist: CollaborativeDocumentType.ARTIST,
  label: CollaborativeDocumentType.LABEL,
  release: CollaborativeDocumentType.RELEASE,
  campaign: CollaborativeDocumentType.CAMPAIGN,
  'email-template': CollaborativeDocumentType.EMAIL_TEMPLATE,
  'terms-history': CollaborativeDocumentType.TERMS_HISTORY,
  'privacy-history': CollaborativeDocumentType.PRIVACY_HISTORY,
} as const satisfies Record<BlockRoomDocumentType, CollaborativeDocumentType>;

export function createBlockRoomDocumentName(type: BlockRoomDocumentType, entityId: string, locale: string): string {
  return createDocumentName(collaborativeDocumentTypes[type], entityId, locale);
}

function localeMetadataEquals(left: LocaleMetadata, right: LocaleMetadata): boolean {
  return (
    left.locale === right.locale &&
    left.title === right.title &&
    left.summary === right.summary &&
    left.subject === right.subject &&
    left.creditNotes?.length === right.creditNotes?.length &&
    (left.creditNotes?.every((note, index) => {
      const rightNote = right.creditNotes?.[index];
      return rightNote !== undefined && note.creditId === rightNote.creditId && note.note === rightNote.note;
    }) ??
      true)
  );
}

/** Decoded domain payload; every envelope field is inherited from Common. */
type BlockRoomBootstrapBase = Omit<
  BootstrapMessage,
  'v' | 'kind' | 'documentType' | 'document' | 'presentLocaleValues' | 'yjsBootstrapUpdate'
> & {
  presentLocaleValues: readonly AIDocumentFieldTarget[];
  yjsBootstrapUpdate: Uint8Array;
};

export type BlockRoomBootstrap =
  | (BlockRoomBootstrapBase & { documentType: 'page'; document: LocalizedPageDocument })
  | (BlockRoomBootstrapBase & {
      documentType: Exclude<BlockRoomDocumentType, 'page'>;
      document: LocalizedRichTextDocument;
    });

export class BlockRoomBootstrapError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BlockRoomBootstrapError';
  }
}

function decodeBase64(value: string): Uint8Array {
  if (!value) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap returned an empty Yjs update.');
  }
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new BlockRoomBootstrapError('Collaboration bootstrap returned an invalid Yjs update.');
  }
}

const knownDocumentQueries = new WeakMap<object, string>();

/**
 * Connection query naming the typed body already rendered for `locale`, so collab can omit it
 * from `room.bootstrap`. Empty when the snapshot holds no body for this room.
 */
export function knownDocumentQuery(snapshot: EditorSnapshot | undefined, locale: string): string {
  const body = snapshot?.locale === locale ? snapshot.document : undefined;
  if (!snapshot || !body) {
    return '';
  }
  let query = knownDocumentQueries.get(body);
  if (query === undefined) {
    const bytes =
      body.$typeName === 'api.content.v1.LocalizedPageDocument'
        ? toBinary(LocalizedPageDocumentSchema, body)
        : toBinary(LocalizedRichTextDocumentSchema, body);
    query = new URLSearchParams({
      [KNOWN_DOCUMENT_REVISION_PARAM]: snapshot.documentRevision,
      [KNOWN_DOCUMENT_DIGEST_PARAM]: documentBodyDigest(bytes),
    }).toString();
    knownDocumentQueries.set(body, query);
  }
  return `?${query}`;
}

export function parseBlockRoomBootstrap(
  raw: unknown,
  type: BlockRoomDocumentType,
  entityId: string,
  locale: string,
  snapshot?: EditorSnapshot,
): BlockRoomBootstrap {
  const parsed = bootstrapSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap response failed validation.');
  }
  const envelope = parsed.data;
  const expectedName = createBlockRoomDocumentName(type, entityId, locale);
  if (envelope.documentType !== type || envelope.documentName !== expectedName || envelope.locale !== locale) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap response targeted a different document.');
  }
  if (envelope.sourceMetadata.locale !== envelope.sourceLocale) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap source locale metadata mismatch.');
  }
  if (envelope.localeMetadata?.locale !== undefined && envelope.localeMetadata.locale !== envelope.locale) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap room locale metadata mismatch.');
  }
  const isSourceRoom = envelope.locale === envelope.sourceLocale;
  if (
    (isSourceRoom && (!envelope.localeExists || envelope.targetRevision !== undefined)) ||
    (!isSourceRoom && envelope.localeExists !== (envelope.targetRevision !== undefined)) ||
    envelope.localeExists !== (envelope.localeMetadata !== undefined) ||
    (isSourceRoom &&
      envelope.localeMetadata !== undefined &&
      !localeMetadataEquals(envelope.sourceMetadata, envelope.localeMetadata))
  ) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap locale authority mismatch.');
  }

  const documentJson = envelope.document as JsonValue;
  let presentLocaleValues: AIDocumentFieldTarget[];
  try {
    presentLocaleValues = envelope.presentLocaleValues.map((target) =>
      fromJson(AIDocumentFieldTargetSchema, target as JsonValue, { ignoreUnknownFields: false }),
    );
  } catch {
    throw new BlockRoomBootstrapError('Collaboration bootstrap locale presence failed validation.');
  }
  if (
    envelope.document === undefined &&
    (!snapshot?.document ||
      snapshot.locale !== locale ||
      snapshot.documentRevision !== envelope.documentRevision ||
      snapshot.document.$typeName !==
        (type === 'page' ? 'api.content.v1.LocalizedPageDocument' : 'api.content.v1.LocalizedRichTextDocument'))
  ) {
    throw new BlockRoomBootstrapError('Omitted bootstrap document requires a matching SSR snapshot.');
  }
  const document =
    envelope.document === undefined
      ? snapshot!.document!
      : envelope.documentType === 'page'
        ? fromJson(LocalizedPageDocumentSchema, documentJson, { ignoreUnknownFields: false })
        : fromJson(LocalizedRichTextDocumentSchema, documentJson, { ignoreUnknownFields: false });
  if (document.blockCatalogFingerprint !== envelope.blockCatalogFingerprint) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap catalog fingerprint mismatch.');
  }
  if (document.locale !== envelope.locale) {
    throw new BlockRoomBootstrapError('Collaboration bootstrap localized document room mismatch.');
  }

  return {
    ...envelope,
    document,
    presentLocaleValues,
    yjsBootstrapUpdate: decodeBase64(envelope.yjsBootstrapUpdate),
  } as BlockRoomBootstrap;
}

/** Applies one bootstrap to a new Y.Doc and rejects any typed/CRDT semantic mismatch. */
export function applyBlockRoomBootstrap(bootstrap: BlockRoomBootstrap): Y.Doc {
  const yDocument = new Y.Doc();
  try {
    Y.applyUpdate(yDocument, bootstrap.yjsBootstrapUpdate, 'block-room-bootstrap');
    const materialized = materializeCanonicalBlockRoom(yDocument, bootstrap.documentType);
    const presentLocaleValues = blockRoomPresentLocaleValues(yDocument);
    const presenceMatches =
      presentLocaleValues.length === bootstrap.presentLocaleValues.length &&
      presentLocaleValues.every((target, index) =>
        equals(AIDocumentFieldTargetSchema, target, bootstrap.presentLocaleValues[index]!),
      );
    const root = yDocument.getMap<unknown>('block-document');
    const matches =
      presenceMatches &&
      root.get('sourceLocale') === bootstrap.sourceLocale &&
      root.get('roomLocale') === bootstrap.locale &&
      (bootstrap.documentType === 'page'
        ? materialized.$typeName === 'api.content.v1.LocalizedPageDocument' &&
          equals(LocalizedPageDocumentSchema, materialized, bootstrap.document)
        : materialized.$typeName === 'api.content.v1.LocalizedRichTextDocument' &&
          equals(LocalizedRichTextDocumentSchema, materialized, bootstrap.document));
    if (!matches) {
      throw new BlockRoomBootstrapError('Collaboration bootstrap typed document and Yjs update do not match.');
    }
    return yDocument;
  } catch (error) {
    yDocument.destroy();
    if (error instanceof BlockRoomBootstrapError) {
      throw error;
    }
    throw new BlockRoomBootstrapError(
      `Collaboration bootstrap Yjs update failed validation: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}
