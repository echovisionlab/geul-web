'use server';

import { logServerFailure } from '@/lib/logging/logger';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { Code } from '@connectrpc/connect';
import { createEmailLayoutClient } from '@/lib/api/server-client';
import type { ActionResult } from '@/lib/actions/action-result';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import { runAction } from '@/lib/actions/run-action';
import type { EmailLayoutValidationError } from '@/lib/types/email-layout/validation';

const revalidateEmailLayoutAfterCommit = createCommittedMutationRevalidator('email-layout-actions', 'email layout');

const LAYOUT_NOT_FOUND = 'Layout not found';
const LAYOUT_KEY_EXISTS = 'Layout with this key already exists';

export async function createEmailLayoutAction(data: {
  name: string;
  key: string;
  htmlContent: string;
  sourceLocale: string;
}): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'email-layout-actions',
    'createEmailLayoutAction',
    async () => {
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
    },
    {
      fallback: 'Failed to create email layout',
      messages: { [Code.AlreadyExists]: LAYOUT_KEY_EXISTS },
      privateValues: [data?.htmlContent],
    },
  );
}

export async function updateEmailLayoutAction(
  id: string,
  data: {
    name?: string;
    key?: string;
  },
  editorOrigin?: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'email-layout-actions',
    'updateEmailLayoutAction',
    async () => {
      const client = await createEmailLayoutClient(editorOrigin);
      await client.updateEmailLayout({
        id,
        name: data.name,
        key: data.key,
      });
      revalidateEmailLayoutAfterCommit('/admin/email-layouts');
      revalidateEmailLayoutAfterCommit('/admin/email-templates');
      revalidateEmailLayoutAfterCommit('/admin/campaigns');
      return { success: true as const };
    },
    {
      fallback: 'Failed to update email layout',
      messages: { [Code.NotFound]: LAYOUT_NOT_FOUND, [Code.AlreadyExists]: LAYOUT_KEY_EXISTS },
    },
  );
}

export async function deleteEmailLayoutAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'email-layout-actions',
    'deleteEmailLayoutAction',
    async () => {
      const client = await createEmailLayoutClient();
      await client.deleteEmailLayout({ id });
      revalidateEmailLayoutAfterCommit('/admin/email-layouts');
      revalidateEmailLayoutAfterCommit('/admin/email-templates');
      revalidateEmailLayoutAfterCommit('/admin/campaigns');
      return { success: true as const };
    },
    { fallback: 'Failed to delete email layout', messages: { [Code.NotFound]: LAYOUT_NOT_FOUND } },
  );
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
    logServerFailure('email-layout-actions', 'previewEmailLayoutContentAction', err, [htmlContent, sampleContent]);
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
