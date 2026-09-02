import { isConnectError } from '@/lib/api/connect-error';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { FormStatus } from '@echovisionlab/geul-proto/secure/form_pb.ts';
import { createFormClient } from '@/lib/api/server-client';
import type { FormFields } from '@/lib/collab/form-fields';
import type { UserRole } from '@/lib/types/user/model';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('form-queries');

const fromBytes = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

export interface FormSettingsMeta {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  isPublic: boolean;
  opensAt: string | null;
  closesAt: string | null;
  maxSubmissions: number | null;
  requireAuth: boolean;
  allowedRoles: UserRole[];
  allowDuplicateSubmission: boolean;
  hasPassword: boolean;
  ogImageUrl: string | null;
  featuredImageUrl: string | null;
}

const ROLE_VALUES = new Set<UserRole>(['admin', 'author', 'user']);

function toUserRoles(roles: string[]): UserRole[] | null {
  const normalized = roles.filter((role): role is UserRole => ROLE_VALUES.has(role as UserRole));
  return normalized.length > 0 ? normalized : null;
}

/**
 * Get minimal form metadata for admin settings pages.
 */
export async function getFormSettingsMeta(formId: string): Promise<FormSettingsMeta | null> {
  try {
    const client = await createFormClient();
    const form = await client.getForm({ id: formId });

    return {
      id: form.id,
      title: form.title,
      slug: form.slug ?? '',
      status: form.status === FormStatus.PUBLISHED ? 'published' : 'draft',
      isPublic: form.isPublic,
      opensAt: form.opensAt ? timestampDate(form.opensAt).toISOString() : null,
      closesAt: form.closesAt ? timestampDate(form.closesAt).toISOString() : null,
      maxSubmissions: form.maxSubmissions ?? null,
      requireAuth: form.requireAuth ?? false,
      allowedRoles: toUserRoles(form.allowedRoles) ?? [],
      allowDuplicateSubmission: form.allowDuplicateSubmission ?? true,
      hasPassword: form.hasPassword,
      ogImageUrl: form.ogAsset?.url ?? null,
      featuredImageUrl: form.featuredImageAsset?.url ?? null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetFormSettingsMeta RPC error', { error: err.message });
    }
    return null;
  }
}

/**
 * Get DB-backed initial form fields for the collaborative editor.
 * These values are used as the fallback when the form yjs document is empty.
 */
export async function getFormEditorInitialFields(formId: string): Promise<Partial<FormFields> | null> {
  try {
    const client = await createFormClient();
    const form = await client.getForm({ id: formId });

    return {
      title: form.title,
      schema: JSON.parse(fromBytes(form.schema)),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetFormEditorInitialFields RPC error', { error: err.message });
    }
    return null;
  }
}

/**
 * Get form submission with form schema in a single request.
 * For use in Server Components - combines submission data with form schema.
 */
export async function getFormSubmissionWithSchema(submissionId: string) {
  try {
    const client = await createFormClient();
    const response = await client.getFormSubmissionWithSchema({ id: submissionId });

    const submission = response.submission;
    if (!submission) {
      return null;
    }

    return {
      submission: {
        id: submission.id,
        formId: submission.formId,
        memberId: submission.memberId,
        data: JSON.parse(fromBytes(submission.data)),
        ipAddress: submission.ipAddress,
        countryCode: submission.countryCode,
        userAgent: submission.userAgent,
        createdAt: submission.createdAt ? timestampDate(submission.createdAt) : undefined,
      },
      formSchema: JSON.parse(fromBytes(response.formSchema)),
      formTitle: response.formTitle,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetFormSubmissionWithSchema RPC error', { error: err.message });
    }
    return null;
  }
}
