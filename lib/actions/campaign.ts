'use server';

import { isConnectError, isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import type {
  LocalizedRichTextDocument,
  RichTextDocument,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { CampaignRecipientScope as CampaignRecipientScopeValue } from '@echovisionlab/geul-common/collaboration/campaign';
import {
  CampaignRecipientScope,
  CampaignStatus,
  CampaignTargetMode,
  type Campaign as ProtoCampaign,
  type CampaignRecipient as ProtoCampaignRecipient,
} from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { createCampaignClient } from '@/lib/api/server-client';
import type { CampaignListItem } from '@/lib/types/campaign/model';
import type { PaginatedQueryResult } from '@/lib/types/repository/result';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('campaign-actions');

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  document?: RichTextDocument;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  segmentId?: string;
  targetMode: CampaignTargetMode.ALL | CampaignTargetMode.SEGMENT;
  layoutId?: string;
  recipientScope: CampaignRecipientScopeValue;
  scheduledAt?: Date;
  sentAt?: Date;
  sentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignPreview {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface CampaignDeliveryStats {
  totalSent: number;
  totalSkipped: number;
  totalFailed: number;
  totalBlocked: number;
  totalSuppressed: number;
}

export interface CampaignDeliveryRecipient {
  email: string;
  memberId: string;
  status: string;
  sentAt?: Date;
  terminalAt?: Date;
  errorType?: string;
}

const DEFAULT_CAMPAIGN_SUBJECT = 'Untitled Campaign';

function campaignRecipientScopeFromProto(scope: CampaignRecipientScope): CampaignRecipientScopeValue {
  switch (scope) {
    case CampaignRecipientScope.SUBSCRIBED_USERS:
      return 'SUBSCRIBED_USERS';
    case CampaignRecipientScope.ALL_MATCHING_USERS:
      return 'ALL_MATCHING_USERS';
    default:
      throw new Error('Campaign has an invalid recipient scope');
  }
}

function campaignRecipientScopeToProto(scope: CampaignRecipientScopeValue): CampaignRecipientScope {
  switch (scope) {
    case 'SUBSCRIBED_USERS':
      return CampaignRecipientScope.SUBSCRIBED_USERS;
    case 'ALL_MATCHING_USERS':
      return CampaignRecipientScope.ALL_MATCHING_USERS;
  }
}

function protoStatusToString(status: CampaignStatus): 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' {
  switch (status) {
    case CampaignStatus.DRAFT:
      return 'draft';
    case CampaignStatus.SCHEDULED:
      return 'scheduled';
    case CampaignStatus.SENDING:
      return 'sending';
    case CampaignStatus.SENT:
      return 'sent';
    case CampaignStatus.FAILED:
      return 'failed';
    default:
      throw new Error('Campaign has an invalid lifecycle status');
  }
}

function mapCampaign(c: ProtoCampaign): Campaign {
  const segmentId = c.segmentId?.trim() || undefined;
  if (
    (c.targetMode === CampaignTargetMode.ALL && segmentId !== undefined) ||
    (c.targetMode === CampaignTargetMode.SEGMENT && segmentId === undefined) ||
    (c.targetMode !== CampaignTargetMode.ALL && c.targetMode !== CampaignTargetMode.SEGMENT)
  ) {
    throw new Error('Campaign has an invalid explicit target');
  }

  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    document: c.document,
    status: protoStatusToString(c.status),
    segmentId,
    targetMode: c.targetMode,
    layoutId: c.layoutId,
    recipientScope: campaignRecipientScopeFromProto(c.recipientScope),
    scheduledAt: c.scheduledAt ? timestampDate(c.scheduledAt) : undefined,
    sentAt: c.sentAt ? timestampDate(c.sentAt) : undefined,
    sentCount: c.sentCount,
    createdAt: c.createdAt ? timestampDate(c.createdAt) : new Date(),
    updatedAt: c.updatedAt ? timestampDate(c.updatedAt) : new Date(),
  };
}

function mapCampaignListItem(c: ProtoCampaign): CampaignListItem {
  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    status: protoStatusToString(c.status),
    sentAt: c.sentAt ? timestampDate(c.sentAt) : null,
    sentCount: c.sentCount,
    createdAt: c.createdAt ? timestampDate(c.createdAt) : new Date(),
  };
}

function mapCampaignRecipient(recipient: ProtoCampaignRecipient): CampaignDeliveryRecipient {
  return {
    email: recipient.email,
    memberId: recipient.memberId,
    status: recipient.status,
    sentAt: recipient.sentAt ? timestampDate(recipient.sentAt) : undefined,
    terminalAt: recipient.terminalAt ? timestampDate(recipient.terminalAt) : undefined,
    errorType: recipient.errorType || undefined,
  };
}

export async function listCampaignsAction(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
}): Promise<PaginatedQueryResult<CampaignListItem>> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;

  try {
    const client = await createCampaignClient();
    const response = await client.listCampaignsAdmin({
      pagination: {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      filters: options?.search ? [{ field: 'search', op: FilterOp.ILIKE, value: options.search }] : undefined,
      sorts: options?.sort?.map((s) => ({
        field: s.field,
        order: s.order === 'desc' ? SortOrder.DESC : SortOrder.ASC,
      })),
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.campaigns ?? []).map(mapCampaignListItem),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    logger.error('Failed to list campaigns', { error: err });
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function getCampaignAction(id: string): Promise<Campaign | null> {
  try {
    const client = await createCampaignClient();
    const response = await client.getCampaign({ id });
    if (!response.campaign) {
      return null;
    }
    return mapCampaign(response.campaign);
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    logger.error('Failed to get campaign', { error: err });
    return null;
  }
}

export async function getCampaignStatsAction(id: string): Promise<CampaignDeliveryStats | null> {
  try {
    const client = await createCampaignClient();
    const response = await client.getCampaignStats({ id });
    if (!response.stats) {
      return null;
    }
    return {
      totalSent: response.stats.totalSent,
      totalSkipped: response.stats.totalSkipped,
      totalFailed: response.stats.totalFailed,
      totalBlocked: response.stats.totalBlocked,
      totalSuppressed: response.stats.totalSuppressed,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return null;
    }
    logger.error('Failed to get campaign stats', { error: err });
    return null;
  }
}

export async function getCampaignRecipientsAction(
  id: string,
  limit: number = 100,
  offset: number = 0,
): Promise<{ recipients: CampaignDeliveryRecipient[]; total: number }> {
  try {
    const client = await createCampaignClient();
    const response = await client.getCampaignRecipients({ id, limit, offset });
    return {
      recipients: (response.recipients ?? []).map(mapCampaignRecipient),
      total: response.total,
    };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { recipients: [], total: 0 };
    }
    logger.error('Failed to get campaign recipients', { error: err });
    return { recipients: [], total: 0 };
  }
}

export async function createCampaignAction(
  name?: string,
  subject?: string,
): Promise<{ data?: { id: string }; error?: string }> {
  try {
    const client = await createCampaignClient();
    const normalizedName = name?.trim() || DEFAULT_CAMPAIGN_SUBJECT;
    const normalizedSubject = subject?.trim() || normalizedName;
    const response = await client.createCampaign({
      name: normalizedName,
      subject: normalizedSubject,
    });
    if (!response.campaign) {
      return { error: 'Failed to create campaign' };
    }
    revalidatePath('/admin/campaigns');
    return { data: { id: response.campaign.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    logger.error('Failed to create campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to create campaign' };
  }
}

export async function updateCampaignNameAction(
  id: string,
  name: string,
): Promise<{ name?: string; changed?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.updateCampaignName({ id, name });
    revalidatePath('/admin/campaigns');
    revalidatePath(`/campaigns/${id}`);
    return { name: response.name, changed: response.changed };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    logger.error('Failed to update campaign name', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to update campaign name' };
  }
}

export async function updateCampaignConfigurationAction(
  id: string,
  configuration: {
    targetMode: CampaignTargetMode.ALL | CampaignTargetMode.SEGMENT;
    segmentId: string | null;
    layoutId: string | null;
    recipientScope: CampaignRecipientScopeValue;
  },
): Promise<{ changed?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.updateCampaignConfiguration({
      id,
      targetMode: configuration.targetMode,
      segmentId: configuration.segmentId ?? undefined,
      layoutId: configuration.layoutId ?? undefined,
      recipientScope: campaignRecipientScopeToProto(configuration.recipientScope),
    });
    revalidatePath('/admin/campaigns');
    revalidatePath(`/campaigns/${id}`);
    return { changed: response.changed };
  } catch (err) {
    logger.error('Failed to update campaign configuration', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to update campaign configuration' };
  }
}

export async function deleteCampaignAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.deleteCampaign({ id });
    revalidatePath('/admin/campaigns');
    return { success: response.success };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.FailedPrecondition) {
        return { error: err.message };
      }
    }
    logger.error('Failed to delete campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to delete campaign' };
  }
}

export async function sendCampaignNowAction(
  id: string,
  recipientScope: CampaignRecipientScopeValue,
): Promise<{ recipientCount?: number; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.sendCampaignNow({
      id,
      recipientScope: campaignRecipientScopeToProto(recipientScope),
    });
    revalidatePath('/admin/campaigns');
    return {
      recipientCount: response.recipientCount,
    };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.FailedPrecondition) {
        return { error: err.message };
      }
    }
    logger.error('Failed to send campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to send campaign' };
  }
}

export async function previewCampaignAction(
  id: string,
  options?: {
    locale?: string | null;
    layoutId?: string | null;
    subject?: string | null;
    document?: LocalizedRichTextDocument | null;
  },
): Promise<CampaignPreview | null> {
  try {
    const client = await createCampaignClient();
    const response = await client.previewCampaign({
      id,
      locale: options?.locale ?? undefined,
      layoutId: options?.layoutId === undefined ? undefined : (options.layoutId ?? ''),
      subject: options?.subject ?? undefined,
      document: options?.document ?? undefined,
    });
    if (!response.preview) {
      return null;
    }
    return {
      subject: response.preview.subject,
      htmlContent: response.preview.htmlContent,
      textContent: response.preview.textContent,
    };
  } catch (err) {
    logger.error('Failed to preview campaign', { error: err });
    return null;
  }
}

export async function sendTestCampaignAction(
  id: string,
  email: string,
  locale?: string | null,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.sendTestCampaign({ id, email, locale: locale ?? undefined });
    return { success: response.success };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    logger.error('Failed to send test campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to send test email' };
  }
}

export async function scheduleCampaignAction(
  id: string,
  scheduledAt: Date,
  recipientScope: CampaignRecipientScopeValue,
): Promise<{ changed?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.scheduleCampaign({
      id,
      scheduledAt: timestampFromDate(scheduledAt),
      recipientScope: campaignRecipientScopeToProto(recipientScope),
    });
    revalidatePath('/admin/campaigns');
    return { changed: response.changed };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.FailedPrecondition) {
        return { error: err.message };
      }
    }
    logger.error('Failed to schedule campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to schedule campaign' };
  }
}

export async function cancelCampaignAction(id: string): Promise<{ changed?: boolean; error?: string }> {
  try {
    const client = await createCampaignClient();
    const response = await client.cancelCampaign({ id });
    revalidatePath('/admin/campaigns');
    return { changed: response.changed };
  } catch (err) {
    if (isConnectError(err)) {
      if (err.code === Code.Unauthenticated) {
        return { error: 'Unauthorized' };
      }
      if (err.code === Code.FailedPrecondition) {
        return { error: err.message };
      }
    }
    logger.error('Failed to cancel campaign', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to cancel campaign' };
  }
}
