'use client';

import { useId } from 'react';
import { SectionCard as EditorDsSectionCard } from '@/components/core/Section';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { Spinner as Loader } from '@/components/core/Display';
import { StatusBadge, type StatusTone } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Progress } from '@/components/core/Progress';

interface MediaProcessingSurfaceProps {
  id?: string;
  label: string;
  /** Identifies the file whose processing state and recovery actions belong to this group. */
  accessibleLabel?: string;
  /** Settled lifecycle tone; pending processing always renders the accent tone. */
  tone: StatusTone;
  progress: number;
  pending: boolean;
  minHeight?: number;
  resumeTitle?: string;
  resumeDescription?: string;
  resumeActionLabel?: string;
  resumeActionId?: string;
  onResumeAction?: () => void;
  cancelActionLabel?: string;
  cancelActionId?: string;
  cancelActionLoading?: boolean;
  onCancelAction?: () => void;
}

export function MediaProcessingSurface({
  id,
  label,
  accessibleLabel,
  tone,
  progress,
  pending,
  minHeight = 88,
  resumeTitle,
  resumeDescription,
  resumeActionLabel,
  resumeActionId,
  onResumeAction,
  cancelActionLabel,
  cancelActionId,
  cancelActionLoading = false,
  onCancelAction,
}: MediaProcessingSurfaceProps) {
  const statusId = useId();
  const descriptionId = useId();
  const hasResumeAction = Boolean(resumeActionLabel && onResumeAction);
  const hasCancelAction = Boolean(cancelActionLabel && onCancelAction);

  return (
    <div
      id={id}
      role="group"
      aria-label={accessibleLabel}
      aria-labelledby={accessibleLabel ? undefined : statusId}
      style={{ minHeight, width: '100%' }}
    >
      <EditorDsSectionCard padding="md">
        <DsLayoutStack gap="xs" fill="inline">
          <StatusBadge
            id={statusId}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            size="sm"
            tone={pending ? 'accent' : tone}
            appearance="soft"
            leftSection={pending ? <Loader size="xs" /> : undefined}
          >
            {label}
          </StatusBadge>
          <Progress
            value={progress}
            size="sm"
            tone={pending ? 'accent' : tone}
            activity={pending ? 'pending' : 'idle'}
            aria-label={label}
          />
          {resumeTitle || hasResumeAction || hasCancelAction ? (
            <DsLayoutStack gap="xxs">
              {resumeTitle ? (
                <DsText size="xs" weight="strong">
                  {resumeTitle}
                </DsText>
              ) : null}
              {resumeDescription ? (
                <DsText id={descriptionId} size="xs" tone="secondary">
                  {resumeDescription}
                </DsText>
              ) : null}
              {hasResumeAction || hasCancelAction ? (
                <DsLayoutInline gap="xxs">
                  {hasResumeAction ? (
                    <Button
                      aria-describedby={resumeDescription ? descriptionId : undefined}
                      id={resumeActionId}
                      size="xs"
                      tone="neutral"
                      emphasis="medium"
                      onClick={onResumeAction}
                    >
                      {resumeActionLabel}
                    </Button>
                  ) : null}
                  {hasCancelAction ? (
                    <Button
                      id={cancelActionId}
                      aria-describedby={resumeDescription ? descriptionId : undefined}
                      size="xs"
                      tone="danger"
                      emphasis="low"
                      loading={cancelActionLoading}
                      onClick={onCancelAction}
                    >
                      {cancelActionLabel}
                    </Button>
                  ) : null}
                </DsLayoutInline>
              ) : null}
            </DsLayoutStack>
          ) : null}
        </DsLayoutStack>
      </EditorDsSectionCard>
    </div>
  );
}
