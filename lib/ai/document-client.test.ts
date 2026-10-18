import { create } from '@bufbuild/protobuf';
import {
  AIDocumentAcceptedMutationSchema,
  AIDocumentLocaleRole,
  AIDocumentMetadataSchema,
  AIDocumentOperationSchema,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generated = vi.hoisted(() => ({
  openAIDocument: vi.fn(),
  applyAIDocumentOperations: vi.fn(),
}));

vi.mock('@/lib/api/browser/secure-ai', () => ({
  createAIDocumentClient: () => generated,
}));

import {
  createAIDocumentMutation,
  createAIDocumentRequestIdentity,
  DCDP_PROTOCOL_VERSION,
  mutateAIDocumentTargetTranslation,
} from './document-client';

const target = { type: 'post' as const, id: 'post-1', locale: 'en' };
const metadata = create(AIDocumentMetadataSchema, {
  protocolVersion: DCDP_PROTOCOL_VERSION,
  documentRevision: 'document-rev-1',
  targetRevision: 'target-rev-1',
});

function targetMetadata(input: { localeExists: boolean; targetRevision?: string }) {
  return create(AIDocumentMetadataSchema, {
    protocolVersion: DCDP_PROTOCOL_VERSION,
    document: createAIDocumentRequestIdentity(target).document,
    sourceLocale: { code: 'ko' },
    requestedLocale: { code: 'en' },
    localeRole: AIDocumentLocaleRole.AI_DOCUMENT_LOCALE_ROLE_NON_SOURCE,
    localeExists: input.localeExists,
    documentRevision: 'document-rev-1',
    targetRevision: input.targetRevision,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  generated.openAIDocument.mockResolvedValue({ metadata });
});

describe('browser DCDP client', () => {
  it('omits a target CAS token when the server reports a missing target', () => {
    const operation = create(AIDocumentOperationSchema, {
      operation: { case: 'createTranslation', value: {} },
    });

    const mutation = createAIDocumentMutation(target, { documentRevision: 'document-rev-1' }, [operation]);

    expect(mutation).toMatchObject({
      expectedDocumentRevision: 'document-rev-1',
    });
    expect(mutation).not.toHaveProperty('expectedTargetRevision');
  });

  it('creates a source-seeded target and accepts only the exact re-opened revision', async () => {
    generated.openAIDocument
      .mockResolvedValueOnce({ metadata: targetMetadata({ localeExists: false }) })
      .mockResolvedValueOnce({ metadata: targetMetadata({ localeExists: true, targetRevision: 'target-rev-1' }) });
    generated.applyAIDocumentOperations.mockResolvedValue({
      result: {
        case: 'accepted',
        value: create(AIDocumentAcceptedMutationSchema, {
          documentRevision: 'document-rev-1',
          targetRevision: 'target-rev-1',
        }),
      },
    });

    await expect(mutateAIDocumentTargetTranslation({ target, action: 'create' })).resolves.toEqual({
      documentRevision: 'document-rev-1',
      targetRevision: 'target-rev-1',
      localeExists: true,
    });
    expect(generated.applyAIDocumentOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.objectContaining({
          expectedDocumentRevision: 'document-rev-1',
          operations: [expect.objectContaining({ operation: expect.objectContaining({ case: 'createTranslation' }) })],
        }),
      }),
      undefined,
    );
  });

  it('deletes with the exact target revision and verifies the missing target on re-open', async () => {
    generated.openAIDocument
      .mockResolvedValueOnce({ metadata: targetMetadata({ localeExists: true, targetRevision: 'target-rev-1' }) })
      .mockResolvedValueOnce({ metadata: targetMetadata({ localeExists: false }) });
    generated.applyAIDocumentOperations.mockResolvedValue({
      result: {
        case: 'accepted',
        value: create(AIDocumentAcceptedMutationSchema, { documentRevision: 'document-rev-1' }),
      },
    });

    await expect(mutateAIDocumentTargetTranslation({ target, action: 'delete' })).resolves.toEqual({
      documentRevision: 'document-rev-1',
      targetRevision: undefined,
      localeExists: false,
    });
    expect(generated.applyAIDocumentOperations).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.objectContaining({
          expectedDocumentRevision: 'document-rev-1',
          expectedTargetRevision: 'target-rev-1',
          operations: [expect.objectContaining({ operation: expect.objectContaining({ case: 'deleteTranslation' }) })],
        }),
      }),
      undefined,
    );
  });
});
