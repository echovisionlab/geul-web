'use client';

import { SectionCard as EditorDsSectionCard } from '@/components/core/Section';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { IconPaperclip } from '@tabler/icons-react';

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
    <div style={{ maxWidth: 1120, marginInline: 'auto' }}>
      <DsLayoutStack gap="lg">
        <DsLayoutStack gap="xxs">
          <DsText size="xs" casing="uppercase" tone="secondary" weight="strong">
            {labels.pageEyebrow}
          </DsText>
          <DsHeading level={2}>{labels.pageTitle}</DsHeading>
        </DsLayoutStack>

        <EditorDsSectionCard withBorder padding="xl">
          <DsLayoutStack gap="lg">
            <DsLayoutInline justify="between">
              <DsText size="sm" weight="strong">
                {labels.editorLabel}
              </DsText>
              <Button
                size="xs"
                tone="neutral"
                emphasis="medium"
                leftSection={<IconPaperclip size={15} />}
                onClick={onOpen}
              >
                {labels.slashAction}
              </Button>
            </DsLayoutInline>
            <DsText>{labels.editorBody}</DsText>
            <FileBlockView
              kind="empty"
              emptyTitle={labels.emptyBlockTitle}
              emptyDescription={labels.emptyBlockDescription}
              loadingLabel=""
              onActivate={onOpen}
            />
          </DsLayoutStack>
        </EditorDsSectionCard>
      </DsLayoutStack>

      <ContentModal
        id="unified-file-attachment-preview"
        opened={opened}
        onClose={onClose}
        title={labels.modalTitle}
        closeLabel={labels.close}
        centered
        size="workspace"
      >
        <Tabs value={step} onChange={(value) => (value === 'library' ? onOpenLibrary() : onBackToUpload())} fill>
          <Tabs.List>
            <Tabs.Tab value="upload">{labels.uploadTab}</Tabs.Tab>
            <Tabs.Tab value="library">{labels.libraryTab}</Tabs.Tab>
          </Tabs.List>
          <div style={{ ...{ display: 'flex', flex: '1 1 auto', minHeight: 0, paddingTop: 'var(--geul-spacing-md)' } }}>
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
          </div>
        </Tabs>
      </ContentModal>
    </div>
  );
}
