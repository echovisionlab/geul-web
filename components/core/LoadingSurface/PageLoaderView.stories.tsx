import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, within } from 'storybook/test';
import { SectionCard } from '../Section';
import { PageLoaderView } from './PageLoaderView';

const meta: Meta<typeof PageLoaderView> = {
  title: 'Core/Feedback/PageLoaderView',
  component: PageLoaderView,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A centered configured image with compact Text xs phase text. The required nonblank message supplies visible text, including when the image is absent or fails. imageAlt names the image and status independently. Fill placement preserves the absolute positioned-parent contract; flow placement reserves its own height in a section. Site PageLoader owns translation, deterministic first-image selection, CDN resolution and unoptimized GIF/SVG delivery. Local fixtures are static; set imageSrc and imageUnoptimized in Controls to review an observed public GIF.',
      },
    },
  },
  decorators: [
    (Story, { args }) => (
      <div style={{ position: 'relative', height: args.placement === 'flow' ? 'auto' : 320 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    contrast: { control: 'radio', options: ['standard', 'inverse'] },
    placement: { control: 'radio', options: ['fill', 'flow'] },
    imageSrc: { control: 'text' },
    imageUnoptimized: { control: 'boolean' },
  },
  args: {
    imageAlt: 'Loading page',
    message: 'Loading',
    imageUnoptimized: true,
  },
};

export default meta;
type Story = StoryObj<typeof PageLoaderView>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Loading page' })).toHaveTextContent(/^Loading$/);
  },
};

export const WithMessage: Story = {
  args: { message: 'Loading the latest content…' },
};

export const WithResolvedImage: Story = {
  args: {
    imageSrc: '/storybook/media/video-poster.jpg',
    message: 'Preparing your workspace…',
  },
};

export const FailedImage: Story = {
  args: { imageSrc: '/storybook/media/missing-loader.gif' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toHaveTextContent('Loading');
  },
};

export const FlowRegion: Story = {
  args: {
    placement: 'flow',
    extent: 'section',
    imageSrc: '/storybook/media/video-poster.jpg',
    message: 'Loading this section…',
  },
  render: (args) => (
    <section>
      <p>Section content before the wait</p>
      <PageLoaderView {...args} />
      <p>Section content after the wait</p>
    </section>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status');
    const before = canvas.getByText('Section content before the wait').getBoundingClientRect();
    const after = canvas.getByText('Section content after the wait').getBoundingClientRect();
    const region = status.getBoundingClientRect();
    await expect(getComputedStyle(status).position).toBe('relative');
    await expect(region.height).toBeGreaterThanOrEqual(200);
    await expect(region.top).toBeGreaterThanOrEqual(before.bottom);
    await expect(after.top).toBeGreaterThanOrEqual(region.bottom);
  },
};

/** Named region heights replace caller pixel values; `container` follows a parent that reserves height. */
export const Extents: Story = {
  render: (args) => (
    <div>
      {(['compact', 'section', 'tall'] as const).map((extent) => (
        <SectionCard key={extent} withBorder padding="none">
          <PageLoaderView
            {...args}
            placement="flow"
            extent={extent}
            imageAlt={`Loading ${extent}`}
            message={`Loading ${extent}`}
          />
        </SectionCard>
      ))}
      <SectionCard withBorder padding="none">
        <div style={{ position: 'relative', height: 96 }}>
          <PageLoaderView {...args} extent="container" imageAlt="Loading container" message="Loading container" />
        </div>
      </SectionCard>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const height = (name: string) =>
      within(canvasElement)
        .getByRole('status', { name: `Loading ${name}` })
        .getBoundingClientRect().height;
    const statuses = within(canvasElement).getAllByRole('status');
    await expect(statuses).toHaveLength(4);
    await expect(height('compact')).toBeGreaterThanOrEqual(120);
    await expect(height('section')).toBeGreaterThanOrEqual(200);
    await expect(height('tall')).toBeGreaterThanOrEqual(320);
    await expect(height('container')).toBe(96);
  },
};

export const InverseOverlay: Story = {
  args: {
    contrast: 'inverse',
    imageSrc: '/storybook/media/video-poster.jpg',
    message: 'Submitting your response…',
  },
  render: (args) => (
    <SectionCard padding="none" border="none">
      <SectionCard padding="none" border="none" appearance="overlay">
        <div style={{ position: 'relative', height: 320 }}>
          <PageLoaderView {...args} />
        </div>
      </SectionCard>
    </SectionCard>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const status = canvas.getByRole('status', { name: 'Loading page' });
    await expect(status).toHaveAttribute('data-contrast', 'inverse');
    await expect(canvas.getByText('Submitting your response…')).toHaveStyle({ color: 'rgb(255, 255, 255)' });
    await expect(canvas.getByRole('img', { name: 'Loading page' })).toBeVisible();
  },
};
