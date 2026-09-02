'use client';

import { IconFolder, IconUpload } from '@tabler/icons-react';
import { Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';

export interface EditorFileInsertViewLabels {
  description: string;
  browse: string;
  openLibrary: string;
}

export interface EditorFileInsertViewProps {
  labels: EditorFileInsertViewLabels;
  onBrowse: () => void;
  onOpenLibrary: () => void;
  showLibraryAction?: boolean;
}

/** Pure feature view. File validation, upload, and library state are owned by controllers. */
export function EditorFileInsertView({
  labels,
  onBrowse,
  onOpenLibrary,
  showLibraryAction = true,
}: EditorFileInsertViewProps) {
  return (
    <Stack gap="md">
      <Text size="sm">{labels.description}</Text>
      <Group grow={showLibraryAction} gap="xs" wrap="nowrap">
        <Button size="sm" tone="neutral" emphasis="medium" leftSection={<IconUpload size={16} />} onClick={onBrowse}>
          {labels.browse}
        </Button>
        {showLibraryAction ? (
          <Button
            size="sm"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconFolder size={16} />}
            onClick={onOpenLibrary}
          >
            {labels.openLibrary}
          </Button>
        ) : null}
      </Group>
    </Stack>
  );
}
