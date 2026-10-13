'use client';
import { Text as DsText } from '@/components/core/Typography';
import { SegmentedControl } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
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
    <LayoutInline gap="md" align="start" wrap="wrap">
      <LayoutStack gap="xxs" align="start">
        <DsText size="xs" weight="medium">
          {labels.contentHeight}
        </DsText>
        <SegmentedControl
          aria-label={labels.contentHeight}
          size="xs"
          density="compact"
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
      </LayoutStack>
      <LayoutStack gap="xxs" align="start">
        <DsText size="xs" weight="medium">
          {labels.pageChrome}
        </DsText>
        <SegmentedControl
          aria-label={labels.pageChrome}
          size="xs"
          density="compact"
          value={value.pageChrome}
          disabled={disabled}
          data={[
            { label: labels.flow, value: 'flow' },
            { label: labels.pinned, value: 'pinned' },
          ]}
          onChange={(pageChrome) => onChange({ ...value, pageChrome: pageChrome as DocumentChromeLayoutViewModel })}
        />
      </LayoutStack>
      <LayoutStack gap="xxs" align="start">
        <DsText size="xs" weight="medium">
          {labels.footer}
        </DsText>
        <SegmentedControl
          aria-label={labels.footer}
          size="xs"
          density="compact"
          value={value.footer}
          disabled={disabled}
          data={[
            { label: labels.flow, value: 'flow' },
            { label: labels.pinned, value: 'pinned' },
          ]}
          onChange={(footer) => onChange({ ...value, footer: footer as DocumentChromeLayoutViewModel })}
        />
      </LayoutStack>
    </LayoutInline>
  );
}
