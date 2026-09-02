import type { AIDocumentMutation } from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { createAIDocumentRequestIdentity, type AIDocumentTarget } from './document-client';

const DOCUMENT_METADATA_BLOCK_HANDLE = 'document';
const SUMMARY_FIELD_HANDLE = 'summary';

/**
 * Accepts only the one exact locale-owned summary replacement represented by
 * the DCDP catalog. A Summary card must never approve body, structure, file,
 * relation, title, or another locale's mutation.
 */
export function extractExactSummaryProposal(target: AIDocumentTarget, mutation: AIDocumentMutation): string | null {
  const identity = createAIDocumentRequestIdentity(target);
  if (
    mutation.protocolVersion !== 'dcdp/1' ||
    mutation.document?.domain !== identity.document.domain ||
    mutation.document.reference !== identity.document.reference ||
    mutation.locale?.code !== identity.locale.code ||
    mutation.operations.length !== 1
  ) {
    return null;
  }

  const operation = mutation.operations[0]?.operation;
  if (operation?.case !== 'setField') {
    return null;
  }
  const fieldTarget = operation.value.target;
  if (
    fieldTarget?.owner.case !== 'blockHandle' ||
    fieldTarget.owner.value !== DOCUMENT_METADATA_BLOCK_HANDLE ||
    fieldTarget.fieldHandle !== SUMMARY_FIELD_HANDLE ||
    fieldTarget.path.length !== 0 ||
    operation.value.value?.value.case !== 'text'
  ) {
    return null;
  }

  const summary = operation.value.value.value.value.trim();
  return summary || null;
}
