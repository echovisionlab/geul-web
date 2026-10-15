import { useState } from 'react';
import {
  LayoutInline as StoryLayoutInline,
  LayoutStack as StoryLayoutStack,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';

import { localizedRender } from '@/.storybook/fixture-i18n';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Separator as Divider, ScrollArea } from '@/components/core/Display';
import { Button } from '../Button';
import { Textarea } from '../Input';
import { Popover } from './Popover';

const meta: Meta<typeof Popover> = {
  title: 'Core/Overlays/Popover',
  component: Popover,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: localizedRender(() => (
    <Popover portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Open details
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <DsText size="sm">A focused surface for supporting information and actions.</DsText>
      </Popover.Dropdown>
    </Popover>
  )),
};

function ControlledPopover() {
  const [open, setOpen] = useState(true);
  return (
    <Popover open={open} onOpenChange={setOpen} portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Controlled popover
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <DsText size="sm">The owning feature controls this open state.</DsText>
      </Popover.Dropdown>
    </Popover>
  );
}
export const ControlledOpen: Story = { render: localizedRender(() => <ControlledPopover />) };

export const Compact: Story = {
  render: localizedRender(() => (
    <Popover defaultOpen size="compact" placement="bottom-end" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Section settings
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="compact">
        <DsLayoutStack gap="xxs">
          <DsText size="sm" weight="medium">
            Section settings
          </DsText>
          <DsText size="sm">Compact surfaces fit short forms and local settings.</DsText>
        </DsLayoutStack>
      </Popover.Dropdown>
    </Popover>
  )),
};

export const Wide: Story = {
  render: localizedRender(() => (
    <Popover defaultOpen size="wide" placement="bottom-start" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Filter fields
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="none">
        <div style={{ minHeight: 240 }}>
          <StoryLayoutInline align="stretch" gap="none" wrap="nowrap">
            <div style={{ width: 180, padding: 'var(--geul-spacing-sm)' }}>
              <StoryLayoutStack gap="xs">
                <DsText size="sm" weight="medium">
                  Fields
                </DsText>
                <DsText size="sm">Status</DsText>
                <DsText size="sm">Created date</DsText>
                <DsText size="sm">Owner</DsText>
              </StoryLayoutStack>
            </div>
            <Divider orientation="vertical" />
            <DsLayoutInset space="sm">
              <DsLayoutStack gap="xs" flexible>
                <DsText size="sm" weight="medium">
                  Status
                </DsText>
                <DsText size="sm" tone="secondary">
                  Configure the selected field in the wider editing panel.
                </DsText>
              </DsLayoutStack>
            </DsLayoutInset>
          </StoryLayoutInline>
        </div>
      </Popover.Dropdown>
    </Popover>
  )),
};

export const LongContent: Story = {
  render: localizedRender(() => (
    <Popover defaultOpen portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Review activity
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="compact">
        <ScrollArea size="standard">
          <DsLayoutStack gap="xs">
            {Array.from({ length: 20 }, (_, index) => (
              <div style={{ paddingBlock: 4 }} key={index}>
                <DsText size="sm">Activity item {index + 1}</DsText>
                <DsText size="xs" tone="secondary">
                  Supporting detail remains readable inside bounded feature content.
                </DsText>
              </div>
            ))}
          </DsLayoutStack>
        </ScrollArea>
      </Popover.Dropdown>
    </Popover>
  )),
};

export const BottomEndPlacement: Story = {
  render: localizedRender(() => (
    <Popover defaultOpen placement="bottom-end" portal={false}>
      <Popover.Target>
        <Button tone="neutral" emphasis="medium">
          Prompt settings
        </Button>
      </Popover.Target>
      <Popover.Dropdown padding="compact">
        <DsLayoutStack gap="xxs">
          <Textarea label="Prompt" minRows={2} />
        </DsLayoutStack>
      </Popover.Dropdown>
    </Popover>
  )),
};
