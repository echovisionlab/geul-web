import type { Meta, StoryObj } from '@storybook/nextjs';
import { FloatingPanel } from './FloatingPanel';
import { IconButton } from '../IconButton';
import { IconGripVertical } from '@tabler/icons-react';
import { LayoutInset, LayoutStack, LayoutInline } from '../Layout';
import { Text } from '../Typography';
import { localizedRender } from '../../../.storybook/fixture-i18n';
const meta = {
  parameters: { canvasInset: 'none' },
  title: 'Core/Overlays/FloatingPanel',
  component: FloatingPanel,
  args: {
    label: 'Assistant',
    initialPosition: { top: 80, left: 40 },
    dragHandleSelector: '[data-drag-handle]',
    excludeDragHandleSelector: 'button:not([data-interaction="drag-handle"]),a,input',
  },
} satisfies Meta<typeof FloatingPanel>;
export default meta;
export const Drag: StoryObj<typeof meta> = {
  render: localizedRender((args) => (
    <FloatingPanel {...args}>
      <LayoutInset space="md">
        <LayoutStack gap="sm">
          <LayoutInline as="header" data-drag-handle gap="xs">
            <IconButton
              label="Move assistant"
              interaction="drag-handle"
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            >
              <IconGripVertical aria-hidden />
            </IconButton>
            <Text weight="strong">Assistant</Text>
          </LayoutInline>
          <Text>Drag the handle or use its arrow keys to move this panel.</Text>
        </LayoutStack>
      </LayoutInset>
    </FloatingPanel>
  )),
};
