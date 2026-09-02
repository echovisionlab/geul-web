'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { create } from '@bufbuild/protobuf';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  FilterOp,
  FilterSpecSchema,
  SortSpecSchema,
  type SortOrder,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { ThemeAssetVariant } from '@echovisionlab/geul-proto/secure/common_pb.ts';
import { LabelParticipantRole } from '@echovisionlab/geul-proto/secure/label_pb.ts';
import { createLabelClient, createPublicLabelClientWithAuth } from '@/lib/api/server-client';
import { getLocalizedNewEntityName } from '@/lib/i18n/default-entity-name.server';
import { createLogger } from '@/lib/utils/logger';
import { themedAssetRefUrl } from '@/lib/utils/asset-ref';

export type ThemeAssetVariantName = 'light' | 'dark';

const logger = createLogger('label-actions');

function themeAssetVariantFromName(variant?: ThemeAssetVariantName): ThemeAssetVariant {
  return variant === 'dark' ? ThemeAssetVariant.DARK : ThemeAssetVariant.LIGHT;
}

export async function createLabelDraftAction(): Promise<{
  data?: { id: string };
  error?: string;
}> {
  try {
    const client = await createLabelClient();
    const name = await getLocalizedNewEntityName('label');
    const label = await client.createLabel({
      name,
    });
    revalidatePath('/admin/labels');
    return { data: { id: label.id } };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to create label draft' };
  }
}

export async function deleteLabelAction(
  id: string,
  previewRevision: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.deleteLabel({ id, previewRevision });
    revalidatePath('/admin/labels');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete label' };
  }
}

export async function previewDeleteLabelAction(id: string) {
  try {
    const client = await createLabelClient();
    const response = await client.previewDeleteLabel({ id });
    return {
      revision: response.revision,
      impacts: (response.impacts ?? []).map((impact) => ({
        kind: impact.kind,
        entityId: impact.entityId,
        displayName: impact.displayName,
      })),
      childLabelCount: response.childLabelCount,
      artistCount: response.artistCount,
      programEventCount: response.programEventCount,
      releaseCount: response.releaseCount,
    };
  } catch {
    return null;
  }
}

export async function listLabelParticipantsAction(labelId: string) {
  try {
    const client = await createLabelClient();
    const response = await client.listLabelParticipants({ labelId });
    return (response.participants ?? []).map((participant) => ({
      memberId: participant.member?.id ?? '',
      nickname: participant.member?.nickname ?? '',
      avatarUrl: participant.member?.avatarAsset?.url ?? null,
      role: participant.role,
      hasEffectiveAuthority: participant.hasEffectiveAuthority,
    }));
  } catch {
    return [];
  }
}

export async function setLabelParticipantAction(
  labelId: string,
  memberId: string,
  role: LabelParticipantRole,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.setLabelParticipant({ labelId, memberId, role });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update participant' };
  }
}

export async function removeLabelParticipantAction(
  labelId: string,
  memberId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.removeLabelParticipant({ labelId, memberId });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to remove participant' };
  }
}

export async function publishLabelAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.publishLabel({ id });
    revalidatePath('/admin/labels');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Label not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to publish label' };
  }
}

export async function unpublishLabelAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.unpublishLabel({ id });
    revalidatePath('/admin/labels');
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Label not found' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to unpublish label' };
  }
}

// === Logo Actions ===

export async function setLabelLogoAction(
  labelId: string,
  fileId: string,
  variant?: ThemeAssetVariantName,
): Promise<{ url?: string; error?: string }> {
  try {
    const client = await createLabelClient();
    const protoVariant = themeAssetVariantFromName(variant);
    const response = await client.setLabelImage({ labelId, fileId, variant: protoVariant });
    const url = protoVariant === ThemeAssetVariant.DARK ? response.imageDarkAsset?.url : response.imageLightAsset?.url;
    return { url };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Label or file not found' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to edit this label' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to set label logo' };
  }
}

export async function deleteLabelLogoAction(
  labelId: string,
  variant?: ThemeAssetVariantName,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createLabelClient();
    await client.deleteLabelImage({ labelId, variant: themeAssetVariantFromName(variant) });
    return { success: true };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete label logo' };
  }
}

export async function listLabelsForBlockAction(input: {
  sortBy?: 'name' | 'published_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  try {
    const client = await createPublicLabelClientWithAuth(input.requestedLocale);
    const limit = input.limit ?? 12;
    const offset = input.offset ?? 0;
    const response = await client.list({
      pagination: { limit, offset },
      sorts: [
        create(SortSpecSchema, {
          field: input.sortBy ?? 'name',
          order: (input.sortOrder === 'desc' ? 2 : 1) as SortOrder,
        }),
      ],
    });

    return {
      labels: (response.labels ?? []).map((label) => ({
        id: label.id,
        name: label.name,
        slug: label.slug ?? null,
        imageUrl: themedAssetRefUrl(label.imageLightAsset, label.imageDarkAsset),
        imageLightUrl: label.imageLightAsset?.url ?? null,
        imageDarkUrl: label.imageDarkAsset?.url ?? null,
        countryCode: label.countryCode ?? null,
        publishedAt: label.publishedAt ? timestampDate(label.publishedAt) : null,
      })),
      pagination: {
        total: response.pagination?.total ?? 0,
        limit,
        offset,
      },
    };
  } catch (err) {
    logger.error('Failed to list labels for page block', { error: err });
    return {
      labels: [],
      pagination: {
        total: 0,
        limit: input.limit ?? 12,
        offset: input.offset ?? 0,
      },
    };
  }
}

export async function getLabelsForBlockByIdsAction(input: { ids: string[]; requestedLocale?: string | null }) {
  if (input.ids.length === 0) {
    return [];
  }

  try {
    const client = await createPublicLabelClientWithAuth(input.requestedLocale);
    const ids = [...new Set(input.ids)];
    const response = await client.list({
      pagination: { limit: ids.length },
      filters: [create(FilterSpecSchema, { field: 'id', op: FilterOp.IN, values: ids })],
    });
    const byId = new Map(
      (response.labels ?? []).map((label) => [
        label.id,
        {
          id: label.id,
          name: label.name,
          slug: label.slug ?? null,
          imageUrl: themedAssetRefUrl(label.imageLightAsset, label.imageDarkAsset),
          imageLightUrl: label.imageLightAsset?.url ?? null,
          imageDarkUrl: label.imageDarkAsset?.url ?? null,
          countryCode: label.countryCode ?? null,
          publishedAt: label.publishedAt ? timestampDate(label.publishedAt) : null,
          website: label.website ?? null,
        },
      ]),
    );

    return ids.flatMap((id) => {
      const label = byId.get(id);
      return label ? [label] : [];
    });
  } catch (err) {
    logger.error('Failed to get labels for page block', { error: err });
    return [];
  }
}
