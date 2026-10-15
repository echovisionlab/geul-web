import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutInline, LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { FileTypeIcon } from './FileTypeIcon';
const meta = {
  title: 'Core/Data Display/FileTypeIcon',
  component: FileTypeIcon,
  args: { file: { mimeType: 'audio/wav' } },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FileTypeIcon>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Types: Story = {
  render: () => (
    <LayoutInline gap="lg" wrap="wrap">
      {['image/png', 'audio/wav', 'video/mp4', 'application/pdf', 'text/plain', 'application/octet-stream'].map(
        (mimeType) => (
          <LayoutStack key={mimeType} align="center" gap="xs">
            <FileTypeIcon file={{ mimeType }} size="preview" />
            <Text size="xs">{mimeType}</Text>
          </LayoutStack>
        ),
      )}
    </LayoutInline>
  ),
};
