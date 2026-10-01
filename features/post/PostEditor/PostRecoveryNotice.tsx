'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import type { BlockRoomRecoverySnapshot } from '@/lib/collab/block-room-recovery';
import { downloadPostRecoverySnapshot, type PostRecoveryDraft } from './post-recovery-download';

export function PostRecoveryNotice({
  snapshot,
  draft,
}: {
  snapshot: BlockRoomRecoverySnapshot;
  draft?: PostRecoveryDraft;
}) {
  const t = useTranslations('pageEditor.localRecovery');
  return (
    <Stack gap="xs" role="status">
      <Text size="sm">{t('message')}</Text>
      <Button
        type="button"
        tone="neutral"
        emphasis="medium"
        onClick={() => downloadPostRecoverySnapshot(snapshot, draft)}
      >
        {t('action')}
      </Button>
    </Stack>
  );
}
