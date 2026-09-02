import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { createTermsClient } from '@/lib/api/server-client';
import { TermsStatus as ProtoTermsStatus } from '@echovisionlab/geul-proto/secure/terms_pb.ts';
import { TERMS_STATUS } from '@/lib/policy-status';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('terms-queries');

function termsStatus(status: ProtoTermsStatus) {
  switch (status) {
    case ProtoTermsStatus.SCHEDULED:
      return TERMS_STATUS.SCHEDULED;
    case ProtoTermsStatus.ACTIVE:
      return TERMS_STATUS.ACTIVE;
    case ProtoTermsStatus.ARCHIVED:
      return TERMS_STATUS.ARCHIVED;
    case ProtoTermsStatus.DRAFT:
    default:
      return TERMS_STATUS.DRAFT;
  }
}

// ============================================
// Server Component queries for Terms domain
// ============================================

export async function listTermsVersions() {
  try {
    const client = await createTermsClient();
    const response = await client.listTermsVersions({
      pagination: { limit: 100, offset: 0 },
    });
    return (response.versions ?? []).map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      status: termsStatus(v.status),
      effectiveFrom: v.effectiveFrom ? timestampDate(v.effectiveFrom) : null,
      effectiveUntil: v.effectiveUntil ? timestampDate(v.effectiveUntil) : null,
      createdAt: v.createdAt ? timestampDate(v.createdAt) : null,
      updatedAt: v.updatedAt ? timestampDate(v.updatedAt) : null,
    }));
  } catch (err) {
    logger.error('Failed to list terms versions', { error: err });
    return [];
  }
}

export async function getTermsVersion(id: string) {
  try {
    const client = await createTermsClient();
    const terms = await client.getTermsVersion({ id });
    return {
      id: terms.id,
      version: terms.version,
      title: terms.title,
      document: terms.document ?? null,
      status: termsStatus(terms.status),
      effectiveFrom: terms.effectiveFrom ? timestampDate(terms.effectiveFrom) : null,
      effectiveUntil: terms.effectiveUntil ? timestampDate(terms.effectiveUntil) : null,
      createdAt: terms.createdAt ? timestampDate(terms.createdAt) : null,
      updatedAt: terms.updatedAt ? timestampDate(terms.updatedAt) : null,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    throw err;
  }
}
