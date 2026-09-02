'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { createEmailLayoutClient } from '@/lib/api/server-client';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';

const revalidateEmailLayoutAfterCommit = createCommittedMutationRevalidator('email-layout-actions', 'email layout');

export type EmailLayoutActionErrorCode =
  'UNAUTHORIZED' | 'ALREADY_EXISTS' | 'NOT_FOUND' | 'FAILED_PRECONDITION' | 'INVALID_ARGUMENT' | 'UNKNOWN';

interface EmailLayoutActionError {
  error?: string;
  errorCode?: EmailLayoutActionErrorCode;
}

export async function createEmailLayoutAction(data: {
  name: string;
  key: string;
  htmlContent: string;
  sourceLocale: string;
}): Promise<{ data?: { id: string } } & EmailLayoutActionError> {
  try {
    const client = await createEmailLayoutClient();
    const result = await client.createEmailLayout({
      name: data.name,
      key: data.key,
      htmlContent: data.htmlContent,
      sourceLocale: data.sourceLocale,
    });
    revalidateEmailLayoutAfterCommit('/admin/email-layouts');
    revalidateEmailLayoutAfterCommit('/admin/email-templates');
    revalidateEmailLayoutAfterCommit('/admin/campaigns');
    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
    }
    if (isConnectErrorCode(err, Code.AlreadyExists)) {
      return { error: 'Layout with this key already exists', errorCode: 'ALREADY_EXISTS' };
    }
    if (isConnectErrorCode(err, Code.InvalidArgument)) {
      return { error: err.message, errorCode: 'INVALID_ARGUMENT' };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to create email layout',
      errorCode: 'UNKNOWN',
    };
  }
}

export async function updateEmailLayoutAction(
  id: string,
  data: {
    name?: string;
    key?: string;
  },
): Promise<{ success?: boolean } & EmailLayoutActionError> {
  try {
    const client = await createEmailLayoutClient();
    await client.updateEmailLayout({
      id,
      name: data.name,
      key: data.key,
    });
    revalidateEmailLayoutAfterCommit('/admin/email-layouts');
    revalidateEmailLayoutAfterCommit('/admin/email-templates');
    revalidateEmailLayoutAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Layout not found', errorCode: 'NOT_FOUND' };
    }
    if (isConnectErrorCode(err, Code.AlreadyExists)) {
      return { error: 'Layout with this key already exists', errorCode: 'ALREADY_EXISTS' };
    }
    if (isConnectErrorCode(err, Code.InvalidArgument)) {
      return { error: err.message, errorCode: 'INVALID_ARGUMENT' };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to update email layout',
      errorCode: 'UNKNOWN',
    };
  }
}

export async function deleteEmailLayoutAction(id: string): Promise<{ success?: boolean } & EmailLayoutActionError> {
  try {
    const client = await createEmailLayoutClient();
    await client.deleteEmailLayout({ id });
    revalidateEmailLayoutAfterCommit('/admin/email-layouts');
    revalidateEmailLayoutAfterCommit('/admin/email-templates');
    revalidateEmailLayoutAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Layout not found', errorCode: 'NOT_FOUND' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message, errorCode: 'FAILED_PRECONDITION' };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to delete email layout',
      errorCode: 'UNKNOWN',
    };
  }
}

export interface PreviewEmailLayoutContentResult {
  valid: boolean;
  html: string;
  errors: EmailLayoutValidationError[];
}

export async function previewEmailLayoutContentAction(
  htmlContent: string,
  sampleContent?: string,
  locale?: string,
): Promise<PreviewEmailLayoutContentResult> {
  try {
    const client = await createEmailLayoutClient();
    const response = await client.previewEmailLayoutContent({
      htmlContent,
      sampleContent,
      locale,
    });
    return {
      valid: response.valid,
      html: response.html,
      errors: response.errors.map((e) => ({
        code: e.code,
        message: e.message,
        line: e.line,
        column: e.column,
      })),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return {
        valid: false,
        html: '',
        errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }],
      };
    }
    return {
      valid: false,
      html: '',
      errors: [{ code: 'UNKNOWN_ERROR', message: err instanceof Error ? err.message : 'Unknown error' }],
    };
  }
}
