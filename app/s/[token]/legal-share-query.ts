import { isConnectErrorCode } from '@/lib/api/connect-error';
import 'server-only';

import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import type { LegalShareDocument } from '@/features/policy/LegalShareDocumentView';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { mapPublicLocalizationInfo } from '@/lib/queries/localized-public';
import { createPublicPrivacyClientWithAuth, createPublicTermsClientWithAuth } from '@/lib/api/server-client';

export async function getLegalShareDocument(
  entityType: 'privacy' | 'terms',
  id: string,
  token: string,
  requestedLocale: string,
  password?: string,
): Promise<LegalShareDocument | null> {
  try {
    const client =
      entityType === 'privacy'
        ? await createPublicPrivacyClientWithAuth(requestedLocale)
        : await createPublicTermsClientWithAuth(requestedLocale);
    const response = await client.get({ id, shareToken: token, sharePassword: password });
    const document =
      response.scheduled ??
      ('privacy' in response ? response.privacy : 'terms' in response ? response.terms : undefined);
    if (!document?.document) {
      return null;
    }
    const archivedSummary = response.scheduled
      ? null
      : (await client.list({ limit: 100, offset: 0 })).items.find((item) => item.id === document.id);
    return {
      entityType,
      title: document.title,
      content: materializeLocalizedRichTextTree(document.document),
      version: document.version,
      effectiveFrom: document.effectiveFrom ? timestampDate(document.effectiveFrom).toISOString() : null,
      effectiveUntil: archivedSummary?.effectiveUntil
        ? timestampDate(archivedSummary.effectiveUntil).toISOString()
        : null,
      localizationInfo: mapPublicLocalizationInfo(document.localizationInfo),
    };
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound, Code.PermissionDenied)) {
      return null;
    }
    throw error;
  }
}

export async function isPublicLegalHistoryVersion(
  entityType: 'privacy' | 'terms',
  id: string,
  requestedLocale: string,
): Promise<boolean> {
  try {
    if (entityType === 'privacy') {
      const client = await createPublicPrivacyClientWithAuth(requestedLocale);
      const response = await client.get({ id });
      return response.privacy?.id === id;
    }
    const client = await createPublicTermsClientWithAuth(requestedLocale);
    const response = await client.get({ id });
    return response.terms?.id === id;
  } catch (error) {
    if (isConnectErrorCode(error, Code.NotFound, Code.PermissionDenied)) {
      return false;
    }
    throw error;
  }
}
