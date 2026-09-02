'use client';

import { IconHistory } from '@tabler/icons-react';
import { Group, Loader, ScrollArea, Stack, Text, Timeline } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { ConfirmModal } from '@/components/core/Modal';
import { Tooltip } from '@/components/core/Tooltip';

export interface VersionHistoryItemViewModel {
  id: string;
  version: number;
  versionLabel: string;
  title: string;
  sourceLocaleLabel: string;
  createdAtLabel: string;
  createdAtTooltip?: string;
  contributorLabel: string;
}

export interface VersionHistoryDrawerViewLabels {
  title: string;
  close: string;
  loading: string;
  empty: string;
  restore: string;
  restoreTitle: string;
  restoreBody: string;
  cancel: string;
}

export interface VersionHistoryDrawerViewProps {
  opened: boolean;
  onClose: () => void;
  versions: readonly VersionHistoryItemViewModel[];
  labels: VersionHistoryDrawerViewLabels;
  loading: boolean;
  restoring: boolean;
  canRestore: boolean;
  selectedVersionId: string | null;
  restoreConfirmationOpened: boolean;
  onSelectVersion: (versionId: string) => void;
  onCloseRestoreConfirmation: () => void;
  onRestore: () => void;
}

export function VersionHistoryDrawerView({
  opened,
  onClose,
  versions,
  labels,
  loading,
  restoring,
  canRestore,
  selectedVersionId,
  restoreConfirmationOpened,
  onSelectVersion,
  onCloseRestoreConfirmation,
  onRestore,
}: VersionHistoryDrawerViewProps) {
  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        placement="right"
        size="compact"
        closeLabel={labels.close}
        title={
          <Group gap="xs">
            <IconHistory size={18} />
            <Text fw={600}>{labels.title}</Text>
          </Group>
        }
      >
        <Stack gap="md" h="100%">
          {loading ? (
            <Stack align="center" py="xl">
              <Loader size="sm" aria-label={labels.loading} />
            </Stack>
          ) : versions.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {labels.empty}
            </Text>
          ) : (
            <ScrollArea flex={1} style={{ minHeight: 0 }}>
              <Timeline active={0} bulletSize={24} lineWidth={2}>
                {versions.map((version) => (
                  <Timeline.Item key={version.id} title={version.versionLabel}>
                    <Stack gap={2}>
                      <Text size="sm" lineClamp={1}>
                        {version.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {version.sourceLocaleLabel}
                      </Text>
                      <Group gap="xs">
                        <Tooltip label={version.createdAtTooltip ?? ''} disabled={!version.createdAtTooltip}>
                          <Text size="xs" c="dimmed">
                            {version.createdAtLabel}
                          </Text>
                        </Tooltip>
                        <Text size="xs" c="dimmed">
                          {version.contributorLabel}
                        </Text>
                      </Group>
                      <Button
                        emphasis="low"
                        size="xs"
                        onClick={() => onSelectVersion(version.id)}
                        disabled={!canRestore}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {labels.restore}
                      </Button>
                    </Stack>
                  </Timeline.Item>
                ))}
              </Timeline>
            </ScrollArea>
          )}
        </Stack>
      </Drawer>

      <ConfirmModal
        opened={restoreConfirmationOpened}
        onClose={onCloseRestoreConfirmation}
        onConfirm={onRestore}
        title={labels.restoreTitle}
        message={labels.restoreBody}
        confirmLabel={labels.restore}
        cancelLabel={labels.cancel}
        closeLabel={labels.close}
        confirmTone="accent"
        loading={restoring}
        confirmDisabled={!canRestore || !selectedVersionId}
        centered
        size="compact"
      />
    </>
  );
}
