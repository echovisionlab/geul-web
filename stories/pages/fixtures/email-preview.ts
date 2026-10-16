import { toJson } from '@bufbuild/protobuf';
import {
  LocalizedRichTextDocumentSchema,
  type LocalizedRichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export interface LocalEmailPreviewRequest {
  locale: string;
  subject: string;
  document?: LocalizedRichTextDocument;
  contentHtml?: string;
  layoutHtml?: string;
  variables?: Record<string, string>;
}

/** Local fixture data, rendered by the same Go orchestration as delivered mail. */
export async function renderLocalEmailPreview(
  input: LocalEmailPreviewRequest,
  signal?: AbortSignal,
): Promise<{ html: string; subject: string; text: string }> {
  const response = await fetch('/__fixtures/email-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      ...input,
      ...(input.document ? { document: toJson(LocalizedRichTextDocumentSchema, input.document) } : {}),
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Email preview failed');
  }
  return result;
}
