'use server';

import { queryResult, type QueryResult } from '@/lib/api/query-result';

import { revalidatePath } from 'next/cache';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
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
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
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
  memberCriteriaId?: string;
  targetMode: CampaignTargetMode.ALL | CampaignTargetMode.MEMBER_CRITERIA;
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
  const memberCriteriaId = c.memberCriteriaId?.trim() || undefined;
  if (
    (c.targetMode === CampaignTargetMode.ALL && memberCriteriaId !== undefined) ||
    (c.targetMode === CampaignTargetMode.MEMBER_CRITERIA && memberCriteriaId === undefined) ||
    (c.targetMode !== CampaignTargetMode.ALL && c.targetMode !== CampaignTargetMode.MEMBER_CRITERIA)
  ) {
    throw new Error('Campaign has an invalid explicit target');
  }

  return {
    id: c.id,
    name: c.name,
    subject: c.subject,
    document: c.document,
    status: protoStatusToString(c.status),
    memberCriteriaId,
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
}): Promise<QueryResult<PaginatedQueryResult<CampaignListItem>>> {
  return queryResult(async () => {
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
      logger.error('Failed to list campaigns', { error: err });
      throw err;
    }
  });
}

export async function getCampaignAction(id: string): Promise<QueryResult<Campaign | null>> {
  return queryResult(async () => {
    try {
      const client = await createCampaignClient();
      const response = await client.getCampaign({ id });
      if (!response.campaign) {
        return null;
      }
      return mapCampaign(response.campaign);
    } catch (err) {
      logger.error('Failed to get campaign', { error: err });
      throw err;
    }
  });
}

export async function getCampaignStatsAction(id: string): Promise<QueryResult<CampaignDeliveryStats | null>> {
  return queryResult(async () => {
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
      logger.error('Failed to get campaign stats', { error: err });
      throw err;
    }
  });
}

export async function getCampaignRecipientsAction(
  id: string,
  limit: number = 100,
  offset: number = 0,
): Promise<QueryResult<{ recipients: CampaignDeliveryRecipient[]; total: number }>> {
  return queryResult(async () => {
    try {
      const client = await createCampaignClient();
      const response = await client.getCampaignRecipients({ id, limit, offset });
      return {
        recipients: (response.recipients ?? []).map(mapCampaignRecipient),
        total: response.total,
      };
    } catch (err) {
      logger.error('Failed to get campaign recipients', { error: err });
      throw err;
    }
  });
}

export async function createCampaignAction(
  name?: string,
  subject?: string,
): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'campaign',
    'createCampaignAction',
    async () => {
      const client = await createCampaignClient();
      const normalizedName = name?.trim() || DEFAULT_CAMPAIGN_SUBJECT;
      const normalizedSubject = subject?.trim() || normalizedName;
      const response = await client.createCampaign({
        name: normalizedName,
        subject: normalizedSubject,
      });
      if (!response.campaign) {
        throw new Error('Failed to create campaign');
      }
      revalidatePath('/admin/campaigns');
      return { data: { id: response.campaign.id } };
    },
    { fallback: 'Failed to create campaign' },
  );
}

export async function updateCampaignNameAction(
  id: string,
  name: string,
  editorOrigin?: string,
): Promise<ActionResult<{ name: string; changed: boolean }>> {
  return runAction(
    'campaign',
    'updateCampaignNameAction',
    async () => {
      const client = await createCampaignClient(editorOrigin);
      const response = await client.updateCampaignName({ id, name });
      revalidatePath('/admin/campaigns');
      revalidatePath(`/campaigns/${id}`);
      return { name: response.name, changed: response.changed };
    },
    { fallback: 'Failed to update campaign name' },
  );
}

export type CampaignConfigurationPatch =
  | {
      targetMode: CampaignTargetMode.ALL | CampaignTargetMode.MEMBER_CRITERIA;
      memberCriteriaId: string | null;
      layoutId?: never;
      recipientScope?: never;
    }
  | {
      layoutId: string | null;
      targetMode?: never;
      memberCriteriaId?: never;
      recipientScope?: never;
    }
  | {
      recipientScope: CampaignRecipientScopeValue;
      targetMode?: never;
      memberCriteriaId?: never;
      layoutId?: never;
    };

export async function updateCampaignConfigurationAction(
  id: string,
  configuration: CampaignConfigurationPatch,
  editorOrigin?: string,
): Promise<ActionResult<{ changed: boolean }>> {
  return runAction(
    'campaign',
    'updateCampaignConfigurationAction',
    async () => {
      const client = await createCampaignClient(editorOrigin);
      const patch = {
        ...(configuration.targetMode !== undefined
          ? {
              targetMode: configuration.targetMode,
              // An empty optional string is the explicit null/clear for the pair.
              memberCriteriaId: configuration.memberCriteriaId ?? '',
            }
          : {}),
        ...(configuration.layoutId !== undefined ? { layoutId: configuration.layoutId ?? '' } : {}),
        ...(configuration.recipientScope !== undefined
          ? { recipientScope: campaignRecipientScopeToProto(configuration.recipientScope) }
          : {}),
      };
      const response = await client.updateCampaignConfiguration({
        id,
        ...patch,
      });
      revalidatePath('/admin/campaigns');
      revalidatePath(`/campaigns/${id}`);
      return { changed: response.changed };
    },
    { fallback: 'Failed to update campaign configuration' },
  );
}

export async function deleteCampaignAction(id: string): Promise<ActionResult<{ success: boolean }>> {
  return runAction(
    'campaign',
    'deleteCampaignAction',
    async () => {
      const client = await createCampaignClient();
      const response = await client.deleteCampaign({ id });
      revalidatePath('/admin/campaigns');
      return { success: response.success };
    },
    { fallback: 'Failed to delete campaign' },
  );
}

export async function sendCampaignNowAction(
  id: string,
  recipientScope: CampaignRecipientScopeValue,
): Promise<ActionResult<{ recipientCount: number }>> {
  return runAction(
    'campaign',
    'sendCampaignNowAction',
    async () => {
      const client = await createCampaignClient();
      const response = await client.sendCampaignNow({
        id,
        recipientScope: campaignRecipientScopeToProto(recipientScope),
      });
      revalidatePath('/admin/campaigns');
      return {
        recipientCount: response.recipientCount,
      };
    },
    { fallback: 'Failed to send campaign' },
  );
}

export async function previewCampaignAction(
  id: string,
  options?: {
    locale?: string | null;
    layoutId?: string | null;
    subject?: string | null;
    document?: LocalizedRichTextDocument | null;
  },
): Promise<QueryResult<CampaignPreview | null>> {
  return queryResult(async () => {
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
      throw err;
    }
  });
}

export async function sendTestCampaignAction(
  id: string,
  email: string,
  locale?: string | null,
): Promise<ActionResult<{ success: boolean }>> {
  return runAction(
    'campaign',
    'sendTestCampaignAction',
    async () => {
      const client = await createCampaignClient();
      const response = await client.sendTestCampaign({ id, email, locale: locale ?? undefined });
      return { success: response.success };
    },
    { fallback: 'Failed to send test email', privateValues: [email] },
  );
}

export async function scheduleCampaignAction(
  id: string,
  scheduledAt: Date,
  recipientScope: CampaignRecipientScopeValue,
): Promise<ActionResult<{ changed: boolean }>> {
  return runAction(
    'campaign',
    'scheduleCampaignAction',
    async () => {
      const client = await createCampaignClient();
      const response = await client.scheduleCampaign({
        id,
        scheduledAt: timestampFromDate(scheduledAt),
        recipientScope: campaignRecipientScopeToProto(recipientScope),
      });
      revalidatePath('/admin/campaigns');
      return { changed: response.changed };
    },
    { fallback: 'Failed to schedule campaign' },
  );
}

export async function cancelCampaignAction(id: string): Promise<ActionResult<{ changed: boolean }>> {
  return runAction(
    'campaign',
    'cancelCampaignAction',
    async () => {
      const client = await createCampaignClient();
      const response = await client.cancelCampaign({ id });
      revalidatePath('/admin/campaigns');
      return { changed: response.changed };
    },
    { fallback: 'Failed to cancel campaign' },
  );
}
