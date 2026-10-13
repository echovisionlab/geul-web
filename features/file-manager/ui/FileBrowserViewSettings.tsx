'use client';

import { useId } from 'react';
import { IconAdjustments } from '@tabler/icons-react';
import { Popover } from '@/components/core/Popover';
import { IconButton } from '@/components/core/IconButton';
import { NativeRange } from '@/components/core/Input/NativeRange';
import { Button } from '@/components/core/Button';
import { Heading, Text } from '@/components/core/Typography';
import { LayoutStack, LayoutInline } from '@/components/core/Layout';
import {
  defaultFileBrowserViewSettings,
  type FileBrowserViewOptions,
  type FileBrowserViewSettings,
} from './file-browser-view-settings';

const iconSizes = ['small', 'medium', 'large'] as const;
const gridSpacings = ['compact', 'standard', 'comfortable'] as const;

/** View configuration sits with the view toggle and shares Core controls across browsers. */
export function FileBrowserViewSettingsControl({ options, grid }: { options: FileBrowserViewOptions; grid: boolean }) {
  const headingId = useId();
  const { value, labels, onChange } = options;
  const change = <K extends keyof FileBrowserViewSettings>(key: K, next: FileBrowserViewSettings[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <Popover placement="bottom-end" size="compact">
      <Popover.Target>
        <IconButton label={labels.title} emphasis="low" tone="neutral">
          <IconAdjustments aria-hidden />
        </IconButton>
      </Popover.Target>
      <Popover.Dropdown padding="compact" aria-labelledby={headingId}>
        <LayoutStack gap="xxs">
          <Heading level={2} scale={6} id={headingId}>
            {labels.title}
          </Heading>
          <LayoutStack gap="none">
            <LayoutInline justify="between" gap="xs" wrap="nowrap">
              <Text size="xs">{labels.iconSize}</Text>
              <Text size="xs" tone="secondary">
                {labels[value.iconSize]}
              </Text>
            </LayoutInline>
            <NativeRange
              label={labels.iconSize}
              min={0}
              max={2}
              step={1}
              value={iconSizes.indexOf(value.iconSize)}
              valueText={labels[value.iconSize]}
              disabled={!grid}
              onChange={(next) => change('iconSize', iconSizes[next])}
            />
          </LayoutStack>
          <LayoutStack gap="none">
            <LayoutInline justify="between" gap="xs" wrap="nowrap">
              <Text size="xs">{labels.spacing}</Text>
              <Text size="xs" tone="secondary">
                {labels[value.spacing]}
              </Text>
            </LayoutInline>
            <NativeRange
              label={labels.spacing}
              min={0}
              max={2}
              step={1}
              value={gridSpacings.indexOf(value.spacing)}
              valueText={labels[value.spacing]}
              disabled={!grid}
              onChange={(next) => change('spacing', gridSpacings[next])}
            />
          </LayoutStack>
          <LayoutStack gap="none">
            <LayoutInline justify="between" gap="xs" wrap="nowrap">
              <Text size="xs">{labels.columns}</Text>
              <Text size="xs" tone="secondary">
                {value.columns === 'auto' ? labels.auto : value.columns}
              </Text>
            </LayoutInline>
            <NativeRange
              label={labels.columns}
              min={0}
              max={12}
              step={1}
              value={value.columns === 'auto' ? 0 : value.columns}
              valueText={value.columns === 'auto' ? labels.auto : String(value.columns)}
              disabled={!grid}
              onChange={(next) => change('columns', next === 0 ? 'auto' : (next as FileBrowserViewSettings['columns']))}
            />
          </LayoutStack>
          <LayoutInline justify="end" gap="none">
            <Button
              size="xs"
              tone="neutral"
              emphasis="medium"
              onClick={() => onChange({ ...defaultFileBrowserViewSettings, viewMode: value.viewMode })}
            >
              {labels.reset}
            </Button>
          </LayoutInline>
        </LayoutStack>
      </Popover.Dropdown>
    </Popover>
  );
}
