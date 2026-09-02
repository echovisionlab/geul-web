import { equals, fromJson, type JsonValue } from '@bufbuild/protobuf';
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
import { z } from 'zod';
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

const documentTypeSchema = z.enum([
  'post',
  'page',
  'work',
  'program-event',
  'artist',
  'label',
  'release',
  'campaign',
  'email-template',
  'terms-history',
  'privacy-history',
]);
const nonEmptyStringSchema = z.string().trim().min(1);
const uuidSchema = z.string().uuid();
export const targetRevisionSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Target revision must be a nonblank opaque token.');
const base64Schema = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u);
const localeMetadataSchema = z
  .object({
    locale: nonEmptyStringSchema,
    title: z.string().optional(),
    summary: z.string().optional(),
    subject: z.string().optional(),
    creditNotes: z
      .array(
        z
          .object({
            creditId: nonEmptyStringSchema,
            note: z.string(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
type LocaleMetadata = z.infer<typeof localeMetadataSchema>;

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

const bootstrapEnvelopeSchema = z
  .object({
    kind: z.literal('block_room.bootstrap'),
    protocolVersion: z.literal(1),
    bootstrapChallenge: nonEmptyStringSchema,
    documentName: nonEmptyStringSchema,
    documentType: documentTypeSchema,
    document: z.unknown(),
    documentRevision: uuidSchema,
    sourceLocale: nonEmptyStringSchema,
    locale: nonEmptyStringSchema,
    localeExists: z.boolean(),
    targetRevision: targetRevisionSchema.optional(),
    presentLocaleValues: z.array(z.unknown()),
    sourceMetadata: localeMetadataSchema,
    localeMetadata: localeMetadataSchema.optional(),
    blockCatalogFingerprint: nonEmptyStringSchema,
    serverInstanceId: nonEmptyStringSchema,
    roomEpoch: uuidSchema,
    yjsBootstrapUpdate: base64Schema,
  })
  .strict();

interface BlockRoomBootstrapBase {
  documentName: string;
  documentRevision: string;
  sourceLocale: string;
  locale: string;
  localeExists: boolean;
  targetRevision?: string;
  presentLocaleValues: readonly AIDocumentFieldTarget[];
  sourceMetadata: {
    locale: string;
    title?: string;
    summary?: string;
    subject?: string;
    creditNotes?: readonly { creditId: string; note: string }[];
  };
  localeMetadata?: {
    locale: string;
    title?: string;
    summary?: string;
    subject?: string;
    creditNotes?: readonly { creditId: string; note: string }[];
  };
  blockCatalogFingerprint: string;
  serverInstanceId: string;
  roomEpoch: string;
  bootstrapChallenge: string;
  yjsBootstrapUpdate: Uint8Array;
}

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

export function parseBlockRoomBootstrap(
  raw: unknown,
  type: BlockRoomDocumentType,
  entityId: string,
  locale: string,
): BlockRoomBootstrap {
  const parsed = bootstrapEnvelopeSchema.safeParse(raw);
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
  const document =
    envelope.documentType === 'page'
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
