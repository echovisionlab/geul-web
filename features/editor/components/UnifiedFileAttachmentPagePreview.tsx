'use client';

import { IconPaperclip } from '@tabler/icons-react';
import { Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { ContentModal } from '@/components/core/Modal';
import { Tabs } from '@/components/core/Tabs';
import { FileBlockView } from '@/features/editor/blocks/FileBlock/FileBlockView';
import {
  EditorFileInsertView,
  type EditorFileInsertViewLabels,
} from '@/features/editor/components/EditorFileInsertView';
import {
  EditorFileLibraryPickerView,
  type EditorFileLibraryPickerViewProps,
} from '@/features/editor/components/EditorFileLibraryPickerView';

export interface UnifiedFileAttachmentPagePreviewLabels {
  pageEyebrow: string;
  pageTitle: string;
  editorLabel: string;
  editorBody: string;
  slashAction: string;
  modalTitle: string;
  close: string;
  emptyBlockTitle: string;
  emptyBlockDescription: string;
  uploadTab: string;
  libraryTab: string;
}

export interface UnifiedFileAttachmentPagePreviewProps {
  labels: UnifiedFileAttachmentPagePreviewLabels;
  insertLabels: EditorFileInsertViewLabels;
  pickerProps: EditorFileLibraryPickerViewProps;
  opened: boolean;
  step: 'upload' | 'library';
  onOpen: () => void;
  onClose: () => void;
  onBrowse: () => void;
  onOpenLibrary: () => void;
  onBackToUpload: () => void;
}

/** Pure integrated preview of the Page editor and unified file attachment feature. */
export function UnifiedFileAttachmentPagePreview({
  labels,
  insertLabels,
  pickerProps,
  opened,
  step,
  onOpen,
  onClose,
  onBrowse,
  onOpenLibrary,
  onBackToUpload,
}: UnifiedFileAttachmentPagePreviewProps) {
  return (
    <Box maw={1120} mx="auto">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
            {labels.pageEyebrow}
          </Text>
          <Title order={2}>{labels.pageTitle}</Title>
        </Stack>

        <Paper withBorder radius={0} p="xl">
          <Stack gap="lg">
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {labels.editorLabel}
              </Text>
              <Button
                size="xs"
                tone="neutral"
                emphasis="medium"
                leftSection={<IconPaperclip size={15} />}
                onClick={onOpen}
              >
                {labels.slashAction}
              </Button>
            </Group>
            <Text>{labels.editorBody}</Text>
            <FileBlockView
              kind="empty"
              emptyTitle={labels.emptyBlockTitle}
              emptyDescription={labels.emptyBlockDescription}
              loadingLabel=""
              onActivate={onOpen}
            />
          </Stack>
        </Paper>
      </Stack>

      <ContentModal
        id="unified-file-attachment-preview"
        opened={opened}
        onClose={onClose}
        title={labels.modalTitle}
        closeLabel={labels.close}
        centered
        size="workspace"
      >
        <Tabs
          value={step}
          onChange={(value) => (value === 'library' ? onOpenLibrary() : onBackToUpload())}
          style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0 }}
        >
          <Tabs.List>
            <Tabs.Tab value="upload">{labels.uploadTab}</Tabs.Tab>
            <Tabs.Tab value="library">{labels.libraryTab}</Tabs.Tab>
          </Tabs.List>
          <Box style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, paddingTop: 'var(--mantine-spacing-md)' }}>
            {step === 'upload' ? (
              <EditorFileInsertView
                labels={insertLabels}
                onBrowse={onBrowse}
                onOpenLibrary={onOpenLibrary}
                showLibraryAction={false}
              />
            ) : (
              <EditorFileLibraryPickerView {...pickerProps} />
            )}
          </Box>
        </Tabs>
      </ContentModal>
    </Box>
  );
}
