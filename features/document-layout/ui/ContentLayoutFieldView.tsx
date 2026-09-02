'use client';

import { SimpleGrid, Stack, Text } from '@mantine/core';
import { SegmentedControl } from '@/components/core/Input';
import type { DocumentChromeLayoutViewModel, DocumentContentHeightViewModel, DocumentLayoutViewModel } from './types';

export interface ContentLayoutFieldLabels {
  contentHeight: string;
  content: string;
  viewport: string;
  pageChrome: string;
  footer: string;
  flow: string;
  pinned: string;
}

export interface ContentLayoutFieldViewProps {
  value: DocumentLayoutViewModel;
  onChange: (value: DocumentLayoutViewModel) => void;
  labels: ContentLayoutFieldLabels;
  disabled?: boolean;
}

export function ContentLayoutFieldView({ value, onChange, labels, disabled }: ContentLayoutFieldViewProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <Stack gap={4}>
        <Text size="xs" fw={500}>
          {labels.contentHeight}
        </Text>
        <SegmentedControl
          fullWidth
          size="xs"
          value={value.contentHeight}
          disabled={disabled}
          data={[
            { label: labels.content, value: 'content' },
            { label: labels.viewport, value: 'viewport' },
          ]}
          onChange={(contentHeight) =>
            onChange({ ...value, contentHeight: contentHeight as DocumentContentHeightViewModel })
          }
        />
      </Stack>
      <Stack gap={4}>
        <Text size="xs" fw={500}>
          {labels.pageChrome}
        </Text>
        <SegmentedControl
          fullWidth
          size="xs"
          value={value.pageChrome}
          disabled={disabled}
          data={[
            { label: labels.flow, value: 'flow' },
            { label: labels.pinned, value: 'pinned' },
          ]}
          onChange={(pageChrome) => onChange({ ...value, pageChrome: pageChrome as DocumentChromeLayoutViewModel })}
        />
      </Stack>
      <Stack gap={4}>
        <Text size="xs" fw={500}>
          {labels.footer}
        </Text>
        <SegmentedControl
          fullWidth
          size="xs"
          value={value.footer}
          disabled={disabled}
          data={[
            { label: labels.flow, value: 'flow' },
            { label: labels.pinned, value: 'pinned' },
          ]}
          onChange={(footer) => onChange({ ...value, footer: footer as DocumentChromeLayoutViewModel })}
        />
      </Stack>
    </SimpleGrid>
  );
}
