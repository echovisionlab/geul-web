'use client';

import { Box, Group, Loader, Stack, Text } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Progress } from '@/components/core/Progress';

interface MediaProcessingSurfaceProps {
  id?: string;
  label: string;
  color: string;
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
  color,
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
  const hasResumeAction = Boolean(resumeActionLabel && onResumeAction);
  const hasCancelAction = Boolean(cancelActionLabel && onCancelAction);

  return (
    <Box
      id={id}
      style={{
        minHeight,
        width: '100%',
        borderRadius: 0,
        border: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <Stack gap={8} style={{ width: '100%' }}>
        <StatusBadge
          size="sm"
          tone={statusToneFromColor(color)}
          appearance="soft"
          leftSection={pending ? <Loader size={10} /> : undefined}
        >
          {label}
        </StatusBadge>
        <Progress
          value={progress}
          size="sm"
          tone={statusToneFromColor(color)}
          animated={pending}
          striped={pending}
          aria-label={label}
        />
        {resumeTitle || hasResumeAction || hasCancelAction ? (
          <Stack gap={6}>
            {resumeTitle ? (
              <Text size="xs" fw={600}>
                {resumeTitle}
              </Text>
            ) : null}
            {resumeDescription ? (
              <Text size="xs" c="dimmed">
                {resumeDescription}
              </Text>
            ) : null}
            {hasResumeAction || hasCancelAction ? (
              <Group gap={6}>
                {hasResumeAction ? (
                  <Button id={resumeActionId} size="xs" tone="neutral" emphasis="medium" onClick={onResumeAction}>
                    {resumeActionLabel}
                  </Button>
                ) : null}
                {hasCancelAction ? (
                  <Button
                    id={cancelActionId}
                    size="xs"
                    tone="danger"
                    emphasis="low"
                    loading={cancelActionLoading}
                    onClick={onCancelAction}
                  >
                    {cancelActionLabel}
                  </Button>
                ) : null}
              </Group>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
