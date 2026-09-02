'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
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

export async function getEmailSuppressionAction(email: string): Promise<EmailSuppressionStatus | null> {
  if (!email.trim()) {
    return null;
  }

  try {
    const client = await createEmailSuppressionClient();
    const response = await client.getEmailSuppression({ email });
    return response.suppression ? mapSuppression(response.suppression) : null;
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    logger.error('Failed to get email suppression', { error: err });
    return null;
  }
}

export async function releaseEmailSuppressionAction(email: string): Promise<{ success?: boolean; error?: string }> {
  if (!email.trim()) {
    return { error: 'Email is required' };
  }

  try {
    const client = await createEmailSuppressionClient();
    const response = await client.releaseEmailSuppression({ email });
    if (!response.success) {
      return { error: 'Failed to release email suppression' };
    }
    return { success: response.success };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to release email suppression' };
  }
}
