import type { Meta, StoryObj } from '@storybook/nextjs';
import { localizedRender, localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import { Disclosure } from '../Disclosure';
import { LayoutStack } from '../Layout';
import { SortableSurface, type SortableSurfaceProps } from './SortableSurface';

function SurfaceExample(props: SortableSurfaceProps) {
  const text = useStorybookText();
  return localizeFixtureTree(
    <div style={{ width: 280 }}>
      <SortableSurface {...props}>
        <Disclosure label="Address details" density="compact" withDivider={false} />
      </SortableSurface>
    </div>,
    text,
  );
}

const resting = { transform: null, transition: undefined, isDragging: false };
const meta = {
  title: 'Core/Interaction/SortableSurface',
  component: SortableSurface,
  parameters: { layout: 'centered' },
  args: { motion: resting },
  render: localizedRender((args) => <SurfaceExample {...args} />),
} satisfies Meta<typeof SortableSurface>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {};
export const Dragging: Story = { args: { motion: { ...resting, isDragging: true } } };
export const SameGeometry: Story = {
  render: localizedRender((args) => (
    <LayoutStack gap="md">
      <SurfaceExample {...args} motion={resting} />
      <SurfaceExample {...args} motion={{ ...resting, isDragging: true }} />
    </LayoutStack>
  )),
};
