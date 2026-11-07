'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { queryResult } from '@/lib/api/query-result';

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

export async function createLabelDraftAction(): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(
    'label-actions',
    'createLabelDraftAction',
    async () => {
      const client = await createLabelClient();
      const name = await getLocalizedNewEntityName('label');
      const label = await client.createLabel({
        name,
      });
      revalidatePath('/admin/labels');
      return { data: { id: label.id } };
    },
    { fallback: 'Failed to create label draft' },
  );
}

export async function deleteLabelAction(id: string, previewRevision: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'deleteLabelAction',
    async () => {
      const client = await createLabelClient();
      await client.deleteLabel({ id, previewRevision });
      revalidatePath('/admin/labels');
      return { success: true as const };
    },
    { fallback: 'Failed to delete label' },
  );
}

export async function previewDeleteLabelAction(id: string) {
  return queryResult(async () => {
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
  });
}

export async function listLabelParticipantsAction(labelId: string) {
  return queryResult(async () => {
    const client = await createLabelClient();
    const response = await client.listLabelParticipants({ labelId });
    return (response.participants ?? []).map((participant) => ({
      memberId: participant.member?.id ?? '',
      nickname: participant.member?.nickname ?? '',
      avatarUrl: participant.member?.avatarAsset?.url ?? null,
      role: participant.role,
      hasEffectiveAuthority: participant.hasEffectiveAuthority,
    }));
  });
}

export async function setLabelParticipantAction(
  labelId: string,
  memberId: string,
  role: LabelParticipantRole,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'setLabelParticipantAction',
    async () => {
      const client = await createLabelClient();
      await client.setLabelParticipant({ labelId, memberId, role });
      return { success: true as const };
    },
    { fallback: 'Failed to update participant' },
  );
}

export async function setLabelParentAction(
  labelId: string,
  parentLabelId: string | null,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'setLabelParentAction',
    async () => {
      const client = await createLabelClient();
      await client.setLabelParent({ labelId, parentLabelId: parentLabelId ?? undefined });
      return { success: true as const };
    },
    {
      fallback: 'Failed to update the parent Label',
      messages: { [Code.NotFound]: 'Label not found or you cannot manage it' },
    },
  );
}

export async function removeLabelParticipantAction(
  labelId: string,
  memberId: string,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'removeLabelParticipantAction',
    async () => {
      const client = await createLabelClient();
      await client.removeLabelParticipant({ labelId, memberId });
      return { success: true as const };
    },
    { fallback: 'Failed to remove participant' },
  );
}

export async function publishLabelAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'publishLabelAction',
    async () => {
      const client = await createLabelClient();
      await client.publishLabel({ id });
      revalidatePath('/admin/labels');
      return { success: true as const };
    },
    { fallback: 'Failed to publish label', messages: { [Code.NotFound]: 'Label not found' } },
  );
}

export async function unpublishLabelAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'unpublishLabelAction',
    async () => {
      const client = await createLabelClient();
      await client.unpublishLabel({ id });
      revalidatePath('/admin/labels');
      return { success: true as const };
    },
    { fallback: 'Failed to unpublish label', messages: { [Code.NotFound]: 'Label not found' } },
  );
}

// === Logo Actions ===

export async function setLabelLogoAction(
  labelId: string,
  fileId: string,
  variant?: ThemeAssetVariantName,
): Promise<ActionResult<{ url?: string }>> {
  return runAction(
    'label-actions',
    'setLabelLogoAction',
    async () => {
      const client = await createLabelClient();
      const protoVariant = themeAssetVariantFromName(variant);
      const response = await client.setLabelImage({ labelId, fileId, variant: protoVariant });
      const url =
        protoVariant === ThemeAssetVariant.DARK ? response.imageDarkAsset?.url : response.imageLightAsset?.url;
      return { url };
    },
    {
      fallback: 'Failed to set label logo',
      messages: {
        [Code.NotFound]: 'Label or file not found',
        [Code.PermissionDenied]: 'No permission to edit this label',
      },
    },
  );
}

export async function deleteLabelLogoAction(
  labelId: string,
  variant?: ThemeAssetVariantName,
): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'label-actions',
    'deleteLabelLogoAction',
    async () => {
      const client = await createLabelClient();
      await client.deleteLabelImage({ labelId, variant: themeAssetVariantFromName(variant) });
      return { success: true as const };
    },
    { fallback: 'Failed to delete label logo' },
  );
}

export async function listLabelsForBlockAction(input: {
  sortBy?: 'name' | 'published_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  requestedLocale?: string | null;
}) {
  return queryResult(async () => {
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
      throw err;
    }
  });
}

export async function getLabelsForBlockByIdsAction(input: { ids: string[]; requestedLocale?: string | null }) {
  return queryResult(async () => {
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
      throw err;
    }
  });
}
