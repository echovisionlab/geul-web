import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createPublicPrivacyClient, createPublicPrivacyClientWithLocale } from '@/lib/api/browser-client';
import { mapPublicLocalizationInfo } from '@/lib/queries/localized-public';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { createClientLogger, serializeClientLogError } from '@/lib/utils/client-logger';

const logger = createClientLogger('privacy-browser');

// ============================================
// Client Component queries for Privacy domain
// ============================================

export async function getActivePrivacy(requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicPrivacyClientWithLocale(requestedLocale) : createPublicPrivacyClient();
    const response = await client.get({});

    if (!response.privacy) {
      return null;
    }

    return {
      id: response.privacy.id,
      version: response.privacy.version,
      title: response.privacy.title,
      content: response.privacy.document ? materializeLocalizedRichTextTree(response.privacy.document) : null,
      localizationInfo: mapPublicLocalizationInfo(response.privacy.localizationInfo),
      status: 'active' as const,
      effectiveFrom: response.privacy.effectiveFrom ? timestampDate(response.privacy.effectiveFrom) : null,
      createdAt: null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}

export async function getScheduledPrivacy(requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicPrivacyClientWithLocale(requestedLocale) : createPublicPrivacyClient();
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

export async function getScheduledPrivacyPreview(
  id: string,
  token: string,
  requestedLocale?: string | null,
  password?: string,
) {
  try {
    const client = requestedLocale ? createPublicPrivacyClientWithLocale(requestedLocale) : createPublicPrivacyClient();
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

export async function listArchivedPrivacy() {
  try {
    const client = createPublicPrivacyClient();
    const response = await client.list({ limit: 100, offset: 0 });

    return (response.items ?? []).map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      effectiveFrom: v.effectiveFrom ? timestampDate(v.effectiveFrom) : null,
      effectiveUntil: v.effectiveUntil ? timestampDate(v.effectiveUntil) : null,
    }));
  } catch (err) {
    logger.error('Failed to list archived privacy', { error: serializeClientLogError(err) });
    return [];
  }
}

export async function getArchivedPrivacy(id: string, requestedLocale?: string | null) {
  try {
    const client = requestedLocale ? createPublicPrivacyClientWithLocale(requestedLocale) : createPublicPrivacyClient();
    const [response, current] = await Promise.all([client.get({ id }), client.get({})]);

    if (!response.privacy) {
      return null;
    }

    const isCurrent = current.privacy?.id === response.privacy.id;
    const archivedSummary = isCurrent
      ? null
      : (await client.list({ limit: 100, offset: 0 })).items.find((item) => item.id === response.privacy?.id);

    return {
      id: response.privacy.id,
      version: response.privacy.version,
      title: response.privacy.title,
      content: response.privacy.document ? materializeLocalizedRichTextTree(response.privacy.document) : null,
      localizationInfo: mapPublicLocalizationInfo(response.privacy.localizationInfo),
      status: isCurrent ? ('active' as const) : ('archived' as const),
      effectiveFrom: response.privacy.effectiveFrom ? timestampDate(response.privacy.effectiveFrom) : null,
      effectiveUntil: archivedSummary?.effectiveUntil ? timestampDate(archivedSummary.effectiveUntil) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}
