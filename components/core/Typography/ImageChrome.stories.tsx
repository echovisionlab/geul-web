import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { ImageChrome } from './ImageChrome';
import { Heading, Text } from './Typography';
import { MediaImage } from '../MediaImage';
function ImagePreview({ shade = 'card' }: { shade?: 'none' | 'card' | 'header' }) {
  const text = useStorybookText();
  return (
    <div style={{ position: 'relative', width: 420, maxWidth: '100%', height: 240 }}>
      <MediaImage src="/storybook/media/video-poster.jpg" alt="" fill fit="cover" />
      <ImageChrome placement="cover" shade={shade} inset="md" gap="xs">
        <Heading level={2} contrast="image">
          {text('Project details')}
        </Heading>
        <Text contrast="image">{text('Preview')}</Text>
      </ImageChrome>
    </div>
  );
}
const meta = {
  title: 'Core/Data Display/ImageChrome',
  component: ImagePreview,
  args: { shade: 'card' },
  argTypes: { shade: { control: 'select', options: ['none', 'card', 'header'] } },
} satisfies Meta<typeof ImagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Card: Story = {};
export const Header: Story = { args: { shade: 'header' } };
export const ContentContrast: Story = { args: { shade: 'none' } };
