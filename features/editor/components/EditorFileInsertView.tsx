'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { DialogActions } from '@/components/core/Modal';
import { Text as DsText } from '@/components/core/Typography';
import { useId } from 'react';
import { IconFolder, IconUpload } from '@tabler/icons-react';

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
  /** Hide redundant guidance when the enclosing dialog already names the upload/library choices. */
  showDescription?: boolean;
}

/** Pure feature view. File validation, upload, and library state are owned by controllers. */
export function EditorFileInsertView({
  labels,
  onBrowse,
  onOpenLibrary,
  showLibraryAction = true,
  showDescription = true,
}: EditorFileInsertViewProps) {
  const descriptionId = useId();
  return (
    <DsLayoutStack gap="sm">
      {showDescription ? (
        <DsText id={descriptionId} size="xs" tone="secondary">
          {labels.description}
        </DsText>
      ) : null}
      <DialogActions>
        {showLibraryAction ? (
          <Button
            size="xs"
            tone="neutral"
            emphasis="low"
            leftSection={<IconFolder size="1em" />}
            onClick={onOpenLibrary}
          >
            {labels.openLibrary}
          </Button>
        ) : null}
        <Button
          size="xs"
          tone="neutral"
          emphasis="strong"
          leftSection={<IconUpload size="1em" />}
          aria-describedby={showDescription ? descriptionId : undefined}
          onClick={onBrowse}
        >
          {labels.browse}
        </Button>
      </DialogActions>
    </DsLayoutStack>
  );
}
