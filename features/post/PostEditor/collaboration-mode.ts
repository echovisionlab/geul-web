import type { AIDocumentTarget } from '@/lib/ai/document-client';

export function resolvePostEditorAiTarget({
  postId,
  roomLocale,
  canEditLocaleDocument,
}: {
  postId: string;
  roomLocale: string | null;
  canEditLocaleDocument: boolean;
}): AIDocumentTarget | undefined {
  if (!canEditLocaleDocument || !postId || !roomLocale) {
    return undefined;
  }
  return { type: 'post', id: postId, locale: roomLocale };
}
