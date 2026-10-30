'use server';

import { actionFailure, type ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult, type QueryResult } from '@/lib/api/query-result';

import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { createEmailSuppressionClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('email-suppression-actions');

export interface EmailSuppressionStatus {
  id: string;
  email: string;
  reason: string;
  source: string;
  referenceId?: string;
  lastError?: string;
  suppressedAt: Date;
  releasedAt?: Date;
  releasedBy?: string;
}

function mapSuppression(s: {
  id: string;
  email: string;
  reason: string;
  source: string;
  referenceId?: string;
  lastError?: string;
  suppressedAt?: Timestamp;
  releasedAt?: Timestamp;
  releasedBy?: string;
}): EmailSuppressionStatus {
  return {
    id: s.id,
    email: s.email,
    reason: s.reason,
    source: s.source,
    referenceId: s.referenceId,
    lastError: s.lastError,
    suppressedAt: s.suppressedAt ? timestampDate(s.suppressedAt) : new Date(),
    releasedAt: s.releasedAt ? timestampDate(s.releasedAt) : undefined,
    releasedBy: s.releasedBy,
  };
}

export async function getEmailSuppressionAction(email: string): Promise<QueryResult<EmailSuppressionStatus | null>> {
  return queryResult(async () => {
    if (!email.trim()) {
      return null;
    }

    try {
      const client = await createEmailSuppressionClient();
      const response = await client.getEmailSuppression({ email });
      return response.suppression ? mapSuppression(response.suppression) : null;
    } catch (err) {
      logger.error('Failed to get email suppression', { error: err, privateValues: [email] });
      throw err;
    }
  });
}

export async function releaseEmailSuppressionAction(email: string): Promise<ActionResult<{ success: true }>> {
  if (!email.trim()) {
    return actionFailure('Email is required', 'ACTION_FAILED');
  }

  return runAction(
    'email-suppression-actions',
    'releaseEmailSuppressionAction',
    async () => {
      const client = await createEmailSuppressionClient();
      const response = await client.releaseEmailSuppression({ email });
      if (!response.success) {
        throw new Error('Failed to release email suppression');
      }
      return { success: true as const };
    },
    { fallback: 'Failed to release email suppression', privateValues: [email] },
  );
}
