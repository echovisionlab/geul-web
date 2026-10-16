'use server';

import type { LegalShareDocument } from '@/features/policy/LegalShareDocumentView';
import { logServerFailure } from '@/lib/logging/logger';
import { getLegalShareDocument } from './legal-share-query';

export type { LegalShareDocument } from '@/features/policy/LegalShareDocumentView';

export interface LegalShareAccessState {
  document?: LegalShareDocument;
  error?: 'not_found';
}

export async function accessLegalShareAction(
  _previousState: LegalShareAccessState,
  formData: FormData,
): Promise<LegalShareAccessState> {
  const entityType = String(formData.get('entityType') ?? '');
  const id = String(formData.get('id') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || 'en';
  const password = String(formData.get('password') ?? '');
  if ((entityType !== 'privacy' && entityType !== 'terms') || !id || !token || !password) {
    return { error: 'not_found' };
  }

  try {
    const document = await getLegalShareDocument(entityType, id, token, requestedLocale, password);
    if (!document) {
      return { error: 'not_found' };
    }
    return {
      document,
    };
  } catch (error) {
    logServerFailure('legal-share-access', 'accessLegalShareAction', error, [token, password]);
    return { error: 'not_found' };
  }
}
