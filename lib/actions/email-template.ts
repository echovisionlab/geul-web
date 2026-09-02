'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type {
  LocalizedRichTextDocument,
  RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { createEmailTemplateClient } from '@/lib/api/server-client';
import { createCommittedMutationRevalidator } from '@/lib/actions/revalidate-after-commit';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';

const revalidateEmailTemplateAfterCommit = createCommittedMutationRevalidator(
  'email-template-actions',
  'email template',
);

interface EmailTemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
}

export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  layoutId?: string;
  description?: string;
  document?: RichTextDocument;
  variables: EmailTemplateVariable[];
  isSystem: boolean;
  isActive: boolean;
  eventKey?: string;
  deliveryRunCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

interface EmailEventMapping {
  event: string;
  templateId?: string;
  templateName?: string;
}

export interface EmailTemplateListItem {
  id: string;
  key: string;
  name: string;
  subject: string;
  layoutId?: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  eventKey?: string;
  deliveryRunCount: number;
  createdAt: Date;
  updatedAt?: Date;
}

function mapTemplate(t: {
  id: string;
  key: string;
  name: string;
  subject: string;
  layoutId?: string;
  description?: string;
  document?: RichTextDocument;
  variables: Array<{
    name: string;
    description: string;
    defaultValue?: string;
  }>;
  isSystem: boolean;
  isActive: boolean;
  eventKey?: string;
  deliveryRunCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}): EmailTemplate {
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    subject: t.subject,
    layoutId: t.layoutId,
    description: t.description,
    document: t.document,
    variables: t.variables.map((v) => ({
      name: v.name,
      description: v.description,
      defaultValue: v.defaultValue,
    })),
    isSystem: t.isSystem,
    isActive: t.isActive,
    eventKey: t.eventKey,
    deliveryRunCount: t.deliveryRunCount,
    createdAt: t.createdAt ? timestampDate(t.createdAt) : new Date(),
    updatedAt: t.updatedAt ? timestampDate(t.updatedAt) : undefined,
  };
}

function mapTemplateListItem(t: {
  id: string;
  key: string;
  name: string;
  subject: string;
  layoutId?: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  eventKey?: string;
  deliveryRunCount: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}): EmailTemplateListItem {
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    subject: t.subject,
    layoutId: t.layoutId,
    description: t.description,
    isSystem: t.isSystem,
    isActive: t.isActive,
    eventKey: t.eventKey,
    deliveryRunCount: t.deliveryRunCount,
    createdAt: t.createdAt ? timestampDate(t.createdAt) : new Date(),
    updatedAt: t.updatedAt ? timestampDate(t.updatedAt) : undefined,
  };
}

export async function listEmailEventMappingsAction(): Promise<EmailEventMapping[]> {
  const client = await createEmailTemplateClient();
  const response = await client.getEventMappings({});
  return (response.mappings ?? []).map((mapping) => ({
    event: mapping.event,
    templateId: mapping.templateId,
    templateName: mapping.templateName,
  }));
}

interface ListEmailTemplatesAdminInput {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listEmailTemplatesAdminAction(
  input: ListEmailTemplatesAdminInput,
): Promise<PaginatedQueryResult<EmailTemplateListItem>> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 20;

  const client = await createEmailTemplateClient();
  const response = await client.listEmailTemplatesAdmin({
    pagination: { limit: pageSize, offset: (page - 1) * pageSize },
    filters: input.search ? [{ field: 'search', op: FilterOp.ILIKE, value: input.search }] : undefined,
    sorts: input.sortField ? [{ field: input.sortField, order: input.sortOrder === 'desc' ? 2 : 1 }] : undefined,
  });

  const total = response.pagination?.total ?? 0;

  return {
    data: (response.templates ?? []).map(mapTemplateListItem),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getEmailTemplateAction(id: string): Promise<EmailTemplate | null> {
  try {
    const client = await createEmailTemplateClient();
    const response = await client.getEmailTemplate({ id });
    return mapTemplate(response);
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    throw err;
  }
}

export async function createEmailTemplateAction(data: {
  key: string;
  name: string;
  subject: string;
  description?: string;
}): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createEmailTemplateClient();
    const result = await client.createEmailTemplate({
      key: data.key,
      name: data.name,
      subject: data.subject,
      description: data.description,
    });
    revalidateEmailTemplateAfterCommit('/admin/email-templates');
    return { data: { id: result.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.AlreadyExists)) {
      return { error: 'Template with this key already exists' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create email template' };
  }
}

export async function updateEmailTemplateLayoutAction(
  id: string,
  layoutId: string | null,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createEmailTemplateClient();
    await client.updateEmailTemplate({
      id,
      layoutId: layoutId ?? '',
    });
    revalidateEmailTemplateAfterCommit('/admin/email-templates');
    revalidateEmailTemplateAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Template or layout not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update layout' };
  }
}

export type DeleteEmailTemplateErrorCode = 'UNAUTHORIZED' | 'NOT_FOUND' | 'FAILED_PRECONDITION' | 'UNKNOWN';

export async function deleteEmailTemplateAction(
  id: string,
): Promise<{ success?: boolean; error?: string; errorCode?: DeleteEmailTemplateErrorCode }> {
  try {
    const client = await createEmailTemplateClient();
    await client.deleteEmailTemplate({ id });
    revalidateEmailTemplateAfterCommit('/admin/email-templates');
    revalidateEmailTemplateAfterCommit('/admin/campaigns');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized', errorCode: 'UNAUTHORIZED' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Template not found', errorCode: 'NOT_FOUND' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: err.message, errorCode: 'FAILED_PRECONDITION' };
    }
    return {
      error: err instanceof Error ? err.message : 'Failed to delete email template',
      errorCode: 'UNKNOWN',
    };
  }
}

export async function updateEmailTemplateEventMappingAction(
  eventKey: string,
  templateId: string | null,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createEmailTemplateClient();
    await client.updateEventMapping({
      event: eventKey,
      templateId: templateId ?? undefined,
    });
    revalidateEmailTemplateAfterCommit('/admin/email-templates');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Template not found' };
    }
    if (isConnectErrorCode(err, Code.FailedPrecondition)) {
      return { error: 'Inactive templates cannot be assigned to events' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to update event mapping' };
  }
}

export async function sendTestEmailTemplateAction(
  id: string,
  email: string,
  locale?: string | null,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createEmailTemplateClient();
    await client.sendTestEmail({ id, email, locale: locale ?? undefined });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Template not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to send test email' };
  }
}

export async function previewEmailTemplateAction(data: {
  id: string;
  subject?: string;
  document?: LocalizedRichTextDocument;
  layoutId?: string | null;
  locale?: string;
}): Promise<{ subject: string; html: string } | null> {
  try {
    const client = await createEmailTemplateClient();
    const response = await client.previewEmailTemplate({
      id: data.id,
      subject: data.subject,
      document: data.document,
      layoutId: data.layoutId === undefined ? undefined : (data.layoutId ?? ''),
      locale: data.locale,
    });
    return {
      subject: response.subject,
      html: response.html,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.NotFound)) {
      return null;
    }
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    throw err;
  }
}
