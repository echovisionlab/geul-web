import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createPublicTermsClient, createPublicTermsClientWithLocale } from '@/lib/api/browser-client';
import { mapPublicLocalizationInfo } from '@/lib/queries/localized-public';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('terms-browser');

// ============================================
// Client Component queries for Terms domain
// ============================================

export async function getActiveTerms(requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicTermsClientWithLocale(requestedLocale) : createPublicTermsClient();
    const response = await client.get({});

    if (!response.terms) {
      return null;
    }

    return {
      id: response.terms.id,
      version: response.terms.version,
      title: response.terms.title,
      content: response.terms.document ? materializeLocalizedRichTextTree(response.terms.document) : null,
      localizationInfo: mapPublicLocalizationInfo(response.terms.localizationInfo),
      status: 'active' as const,
      effectiveFrom: response.terms.effectiveFrom ? timestampDate(response.terms.effectiveFrom) : null,
      createdAt: null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

export async function getScheduledTerms(requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicTermsClientWithLocale(requestedLocale) : createPublicTermsClient();
    const response = await client.get({});

    if (!response.scheduled) {
      return null;
    }

    return {
      id: response.scheduled.id,
      version: response.scheduled.version,
      title: response.scheduled.title,
      localizationInfo: mapPublicLocalizationInfo(response.scheduled.localizationInfo),
      status: 'scheduled' as const,
      effectiveFrom: response.scheduled.effectiveFrom ? timestampDate(response.scheduled.effectiveFrom) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

export async function getScheduledTermsPreview(
  id: string,
  token: string,
  requestedLocale?: string | null,
  password?: string,
) {
  try {
    const client = requestedLocale ? createPublicTermsClientWithLocale(requestedLocale) : createPublicTermsClient();
    const response = await client.get({ id, shareToken: token, sharePassword: password });

    if (!response.scheduled?.document) {
      return null;
    }

    return {
      id: response.scheduled.id,
      version: response.scheduled.version,
      title: response.scheduled.title,
      content: materializeLocalizedRichTextTree(response.scheduled.document),
      localizationInfo: mapPublicLocalizationInfo(response.scheduled.localizationInfo),
      status: 'scheduled' as const,
      effectiveFrom: response.scheduled.effectiveFrom ? timestampDate(response.scheduled.effectiveFrom) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return null;
    }
    throw err;
  }
}

export async function listArchivedTerms() {
  try {
    const client = createPublicTermsClient();
    const response = await client.list({ limit: 100, offset: 0 });

    return (response.items ?? []).map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      effectiveFrom: v.effectiveFrom ? timestampDate(v.effectiveFrom) : null,
      effectiveUntil: v.effectiveUntil ? timestampDate(v.effectiveUntil) : null,
    }));
  } catch (err) {
    logger.error('Failed to list archived terms', { error: serializeClientLogError(err) });
    return [];
  }
}

export async function getArchivedTerms(id: string, requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicTermsClientWithLocale(requestedLocale) : createPublicTermsClient();
    const [response, current] = await Promise.all([client.get({ id }), client.get({})]);

    if (!response.terms) {
      return null;
    }

    const isCurrent = current.terms?.id === response.terms.id;
    const archivedSummary = isCurrent
      ? null
      : (await client.list({ limit: 100, offset: 0 })).items.find((item) => item.id === response.terms?.id);

    return {
      id: response.terms.id,
      version: response.terms.version,
      title: response.terms.title,
      content: response.terms.document ? materializeLocalizedRichTextTree(response.terms.document) : null,
      localizationInfo: mapPublicLocalizationInfo(response.terms.localizationInfo),
      status: isCurrent ? ('active' as const) : ('archived' as const),
      effectiveFrom: response.terms.effectiveFrom ? timestampDate(response.terms.effectiveFrom) : null,
      effectiveUntil: archivedSummary?.effectiveUntil ? timestampDate(archivedSummary.effectiveUntil) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}
