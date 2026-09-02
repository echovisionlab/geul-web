import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createPrivacyClient } from '@/lib/api/server-client';
import { PrivacyStatus as ProtoPrivacyStatus } from '@echovisionlab/geul-proto/secure/privacy_pb.ts';
import { PRIVACY_STATUS } from '@/lib/policy-status';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('privacy-queries');

function privacyStatus(status: ProtoPrivacyStatus) {
  switch (status) {
    case ProtoPrivacyStatus.SCHEDULED:
      return PRIVACY_STATUS.SCHEDULED;
    case ProtoPrivacyStatus.ACTIVE:
      return PRIVACY_STATUS.ACTIVE;
    case ProtoPrivacyStatus.ARCHIVED:
      return PRIVACY_STATUS.ARCHIVED;
    case ProtoPrivacyStatus.DRAFT:
    default:
      return PRIVACY_STATUS.DRAFT;
  }
}

// ============================================
// Server Component queries for Privacy domain
// ============================================

export async function listPrivacyVersions() {
  try {
    const client = await createPrivacyClient();
    const response = await client.listPrivacyVersions({
      pagination: { limit: 100, offset: 0 },
    });
    return (response.versions ?? []).map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      status: privacyStatus(v.status),
      effectiveFrom: v.effectiveFrom ? timestampDate(v.effectiveFrom) : null,
      effectiveUntil: v.effectiveUntil ? timestampDate(v.effectiveUntil) : null,
      createdAt: v.createdAt ? timestampDate(v.createdAt) : null,
      updatedAt: v.updatedAt ? timestampDate(v.updatedAt) : null,
    }));
  } catch (err) {
    logger.error('Failed to list privacy versions', { error: err });
    return [];
  }
}

export async function getPrivacyVersion(id: string) {
  try {
    const client = await createPrivacyClient();
    const privacy = await client.getPrivacyVersion({ id });
    return {
      id: privacy.id,
      version: privacy.version,
      title: privacy.title,
      document: privacy.document ?? null,
      status: privacyStatus(privacy.status),
      effectiveFrom: privacy.effectiveFrom ? timestampDate(privacy.effectiveFrom) : null,
      effectiveUntil: privacy.effectiveUntil ? timestampDate(privacy.effectiveUntil) : null,
      createdAt: privacy.createdAt ? timestampDate(privacy.createdAt) : null,
      updatedAt: privacy.updatedAt ? timestampDate(privacy.updatedAt) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}
