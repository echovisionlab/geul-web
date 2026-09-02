import { create } from '@bufbuild/protobuf';
import {
  AIDocumentMutationSchema,
  AIDocumentOperationSchema,
  AIDocumentValueSchema,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { describe, expect, it } from 'vitest';
import { createAIDocumentRequestIdentity, DCDP_PROTOCOL_VERSION } from './document-client';
import { extractExactSummaryProposal } from './summary-proposal';

const target = { type: 'post' as const, id: 'post-1', locale: 'en' };

function summaryMutation(fieldHandle = 'summary') {
  return create(AIDocumentMutationSchema, {
    protocolVersion: DCDP_PROTOCOL_VERSION,
    ...createAIDocumentRequestIdentity(target),
    expectedDocumentRevision: 'document-rev-1',
    expectedTargetRevision: 'target-rev-1',
    operations: [
      create(AIDocumentOperationSchema, {
        operation: {
          case: 'setField',
          value: {
            target: { owner: { case: 'blockHandle', value: 'document' }, fieldHandle },
            value: create(AIDocumentValueSchema, { value: { case: 'text', value: ' Exact locale summary ' } }),
          },
        },
      }),
    ],
  });
}

describe('exact Summary DCDP proposal', () => {
  it('returns the exact summary text for the requested document and locale', () => {
    expect(extractExactSummaryProposal(target, summaryMutation())).toBe('Exact locale summary');
  });

  it('rejects another locale, another field, and mixed operation batches', () => {
    const anotherLocale = summaryMutation();
    if (anotherLocale.locale) {
      anotherLocale.locale.code = 'ko';
    }
    expect(extractExactSummaryProposal(target, anotherLocale)).toBeNull();
    expect(extractExactSummaryProposal(target, summaryMutation('title'))).toBeNull();

    const mixed = summaryMutation();
    mixed.operations.push(
      create(AIDocumentOperationSchema, {
        operation: { case: 'deleteBlock', value: { blockHandle: 'paragraph-1' } },
      }),
    );
    expect(extractExactSummaryProposal(target, mixed)).toBeNull();
  });
});
