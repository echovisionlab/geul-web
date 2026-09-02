'use client';

import { Anchor, List, Stack, Text } from '@mantine/core';
import { ConfirmModal } from '@/components/core/Modal';

export interface ArtistDeleteImpactViewModel {
  domain: number;
  entityId: string;
  label: string;
  relationCount: number;
}

export interface ArtistDeletePreviewViewModel {
  revision: string;
  totalRelationCount: number;
  impacts: ArtistDeleteImpactViewModel[];
}

interface ArtistDeleteDialogViewProps {
  opened: boolean;
  artistName: string;
  preview: ArtistDeletePreviewViewModel | null;
  previewLoading: boolean;
  previewError?: string | null;
  deleting: boolean;
  labels: {
    title: string;
    confirm: string;
    cancel: string;
    close: string;
    loading: string;
    failed: string;
    confirmation: string;
    relationSummary: string;
  };
  onClose: () => void;
  onConfirm: () => void;
}

export function ArtistDeleteDialogView({
  opened,
  artistName,
  preview,
  previewLoading,
  previewError,
  deleting,
  labels,
  onClose,
  onConfirm,
}: ArtistDeleteDialogViewProps) {
  return (
    <ConfirmModal
      opened={opened}
      onClose={onClose}
      onConfirm={onConfirm}
      title={labels.title}
      message={
        <Stack gap="sm">
          <Text>{labels.confirmation.replace('{name}', artistName)}</Text>
          {previewLoading ? <Text c="dimmed">{labels.loading}</Text> : null}
          {previewError ? <Text c="red">{previewError || labels.failed}</Text> : null}
          {preview ? (
            <>
              <Text>{labels.relationSummary.replace('{count}', String(preview.totalRelationCount))}</Text>
              {preview.impacts.length > 0 ? (
                <List spacing="xs">
                  {preview.impacts.map((impact) => {
                    const href = artistImpactHref(impact.domain, impact.entityId);
                    const content = `${impact.label} (${impact.relationCount})`;
                    return (
                      <List.Item key={`${impact.domain}:${impact.entityId}`}>
                        {href ? <Anchor href={href}>{content}</Anchor> : <Text span>{content}</Text>}
                      </List.Item>
                    );
                  })}
                </List>
              ) : null}
            </>
          ) : null}
        </Stack>
      }
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      loading={deleting}
      confirmDisabled={!preview || previewLoading || Boolean(previewError)}
      size="large"
    />
  );
}

function artistImpactHref(domain: number, entityId: string): string | null {
  switch (domain) {
    case 1:
      return `/artists/${entityId}`;
    case 2:
      return `/labels/${entityId}`;
    case 3:
      return `/events/${entityId}`;
    case 4:
      return `/releases/${entityId}`;
    case 6:
      return `/works/${entityId}`;
    default:
      return null;
  }
}
