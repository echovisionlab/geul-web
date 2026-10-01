'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import { serializePostRecoverySnapshot, type PostRecoveryDraft } from './post-recovery-download';
import type { PostConfigPatch } from './post-config-save';

export interface PostConfigDocumentRecovery {
  snapshot: BlockRoomRecoverySnapshot;
  draft?: PostRecoveryDraft;
}

export interface PostConfigRecoveryCopy {
  postId: string;
  expectedConfigurationRevision: string;
  patch: PostConfigPatch;
  documentRecovery?: PostConfigDocumentRecovery;
}

export function serializePostConfigRecoveryCopy(copy: PostConfigRecoveryCopy): string {
  const { documentRecovery, ...settingsCopy } = copy;
  let serializedDocumentRecovery: unknown;
  if (documentRecovery) {
    if (documentRecovery.snapshot.documentType !== 'post' || documentRecovery.snapshot.entityId !== copy.postId) {
      throw new Error('Post configuration recovery cannot include another Post document.');
    }
    serializedDocumentRecovery = JSON.parse(
      serializePostRecoverySnapshot(documentRecovery.snapshot, documentRecovery.draft),
    );
  }

  return JSON.stringify(
    {
      version: 1,
      kind: 'post-configuration-recovery',
      ...settingsCopy,
      ...(serializedDocumentRecovery === undefined ? {} : { documentRecovery: serializedDocumentRecovery }),
    },
    null,
    2,
  );
}

export function downloadPostConfigRecoveryCopy(
  copy: PostConfigRecoveryCopy,
  getDocumentRecovery?: () => PostConfigDocumentRecovery | null,
): void {
  const documentRecovery = getDocumentRecovery ? getDocumentRecovery() : copy.documentRecovery;
  const exportCopy = {
    postId: copy.postId,
    expectedConfigurationRevision: copy.expectedConfigurationRevision,
    patch: copy.patch,
    ...(documentRecovery ? { documentRecovery } : {}),
  };
  const blob = new Blob([serializePostConfigRecoveryCopy(exportCopy)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `post-configuration-recovery-${copy.postId}.json`;
  anchor.style.display = 'none';
  window.document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function PostConfigConflictRecoveryNotice({
  copy,
  getDocumentRecovery,
}: {
  copy: PostConfigRecoveryCopy | null;
  getDocumentRecovery?: () => PostConfigDocumentRecovery | null;
}) {
  const t = useTranslations('pageEditor.localRecovery');

  if (!copy) {
    return null;
  }

  return (
    <Stack gap="xs" role="status">
      <Text size="sm">{t('message')}</Text>
      <Button
        type="button"
        tone="neutral"
        emphasis="medium"
        onClick={() => downloadPostConfigRecoveryCopy(copy, getDocumentRecovery)}
      >
        {t('action')}
      </Button>
    </Stack>
  );
}
