import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { TextMarqueeView } from '@/features/page/blocks/text-marquee/View';
import { ImmersiveSceneView } from '@/features/page/blocks/immersive-scene/View';
import { PreviewFrame } from '../shared/PreviewFrame';

const items = Array.from({ length: 12 }, (_, index) => ({
  text: `Listening room ${index + 1} · artist archive`,
  href: `/artists/listening-room-${index + 1}`,
}));
const sceneProps = {
  minHeightPx: '360',
  heightVh: '120',
  loop: 'true',
  unitsJson: JSON.stringify([
    { id: 'opening', mesh: 'sphere', color: '#ffffff', attribution: '[Opening source](https://example.com/opening)' },
    { id: 'middle', mesh: 'box', color: '#777777', attribution: '[Middle source](https://example.com/middle)' },
    { id: 'ending', mesh: 'cone', color: '#bbbbbb', attribution: '[Ending source](https://example.com/ending)' },
  ]),
  copyJson: JSON.stringify([
    {
      id: 'opening',
      title: 'Opening',
      text: 'Authored opening information with a [reference](https://example.com/reference).',
    },
    {
      id: 'middle',
      title: 'Middle',
      text: 'Authored middle information, available without waiting for the animation.',
    },
    { id: 'ending', title: 'Ending', text: 'Authored ending information, available with motion reduced.' },
  ]),
};

function MotionPreview({ variant }: { variant: 'marquee' | 'immersive-autoplay' | 'immersive-scroll' }) {
  return (
    <PreviewFrame
      title="Public page motion"
      description="Actual public renderers with local authored content. Pause remains active after focus moves; motion reduction provides complete static items and opens all authored scene information. Theme and Locale affect the live UI controls. Artist links and scene references are fixture URLs; backend destinations and authored visual equivalence are outside this preview. The scene requests the production CDN/WebGL runtime and may render its existing fallback."
    >
      {variant === 'marquee' ? (
        <TextMarqueeView props={{ itemsJson: JSON.stringify(items), pauseOnHover: 'false', gap: 'sm' }} />
      ) : (
        <ImmersiveSceneView
          props={{ ...sceneProps, playback: variant === 'immersive-scroll' ? 'scroll' : 'autoplay' }}
        />
      )}
    </PreviewFrame>
  );
}

const meta = {
  title: 'Feature/Page/Motion',
  component: MotionPreview,
  tags: ['autodocs', 'a11y-smoke'],
  args: { variant: 'marquee' },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component:
          'Persistent motion controls and complete authored information in the production public Marquee and Immersive renderers. Review at mobile, tablet and desktop widths, with motion preference applied by the browser. This fixture does not certify 3D asset alternatives, external destinations or assistive technology behavior.',
      },
    },
  },
} satisfies Meta<typeof MotionPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Marquee: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const block = canvasElement.querySelector('[data-block-type="marquee"]')!;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await expect(block).toHaveAttribute('data-static', 'true');
    } else {
      await userEvent.click(canvas.getByRole('button'));
      await expect(block).toHaveAttribute('data-static', 'true');
    }
    const staticItems = block.querySelector('[data-marquee-static-items]')!;
    await expect(within(staticItems as HTMLElement).getAllByRole('link')).toHaveLength(items.length);
    await expect(staticItems).toHaveTextContent(items.at(-1)!.text);
  },
};

async function readScene({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const trigger = await canvas.findByRole('button', {
    expanded: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(trigger);
  }
  await expect(canvasElement.querySelector('[data-immersive-scene]')).toHaveAttribute('data-motion-paused', 'true');
  const information = canvasElement.querySelector('[data-immersive-scene-information-unit="ending"]')!;
  await expect(information).toBeVisible();
  await expect(information).toHaveTextContent('Authored ending information');
  await expect(within(information as HTMLElement).getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/ending',
  );
}
export const ImmersiveAutoplay: Story = { args: { variant: 'immersive-autoplay' }, play: readScene };
export const ImmersiveScroll: Story = { args: { variant: 'immersive-scroll' }, play: readScene };
