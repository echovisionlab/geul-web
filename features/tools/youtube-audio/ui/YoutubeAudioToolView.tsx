'use client';

import { useId, type ReactNode, type SubmitEvent } from 'react';
import { IconBrandYoutube, IconLink, IconTrash } from '@tabler/icons-react';
import { Group, Stack } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import { StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Field } from '@/components/core/Field';
import { TextInput } from '@/components/core/Input';
import { PageHeader } from '@/components/core/PageHeader';
import { SectionCard, SectionHeader } from '@/components/core/Section';

export interface YoutubeAudioToolLabels {
  title: string;
  description: string;
  sourceTitle: string;
  sourceDescription: string;
  urlLabel: string;
  urlDescription: string;
  urlPlaceholder: string;
  resolve: string;
  resolving: string;
  ready: string;
  clear: string;
}

export interface YoutubeAudioToolViewProps {
  labels: YoutubeAudioToolLabels;
  url: string;
  resolving: boolean;
  error: string | null;
  resolvedTitle: string | null;
  converter: ReactNode;
  onUrlChange: (value: string) => void;
  onResolve: () => void;
  onClear: () => void;
}

export function YoutubeAudioToolView({
  labels,
  url,
  resolving,
  error,
  resolvedTitle,
  converter,
  onUrlChange,
  onResolve,
  onClear,
}: YoutubeAudioToolViewProps) {
  const sourceTitleId = useId();
  const urlId = useId();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onResolve();
  };

  return (
    <Stack gap="xl" data-youtube-audio-tool>
      <PageHeader title={labels.title} description={labels.description} />

      <SectionCard component="section" aria-labelledby={sourceTitleId}>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <SectionHeader
              title={<span id={sourceTitleId}>{labels.sourceTitle}</span>}
              description={labels.sourceDescription}
              actions={resolvedTitle ? <StatusBadge tone="positive">{labels.ready}</StatusBadge> : undefined}
            />
            <Field label={labels.urlLabel} description={labels.urlDescription} htmlFor={urlId} error={error} required>
              <TextInput
                id={urlId}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder={labels.urlPlaceholder}
                value={url}
                disabled={resolving}
                leftSection={<IconLink aria-hidden size={17} />}
                onChange={(event) => onUrlChange(event.currentTarget.value)}
              />
            </Field>
            {resolvedTitle ? (
              <Alert tone="positive" icon={<IconBrandYoutube aria-hidden size={18} />}>
                {resolvedTitle}
              </Alert>
            ) : null}
            <Group justify="flex-end">
              {resolvedTitle ? (
                <Button
                  type="button"
                  tone="neutral"
                  emphasis="low"
                  leftSection={<IconTrash aria-hidden size={16} />}
                  disabled={resolving}
                  onClick={onClear}
                >
                  {labels.clear}
                </Button>
              ) : null}
              <Button
                type="submit"
                loading={resolving}
                disabled={url.trim().length === 0}
                leftSection={<IconBrandYoutube aria-hidden size={18} />}
              >
                {resolving ? labels.resolving : labels.resolve}
              </Button>
            </Group>
          </Stack>
        </form>
      </SectionCard>

      {converter}
    </Stack>
  );
}
