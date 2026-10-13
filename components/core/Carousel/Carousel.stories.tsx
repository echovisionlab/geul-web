import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { SectionCard } from '../Section';
import { Text } from '../Typography';
import { Carousel } from './Carousel';
const meta: Meta<typeof Carousel> = {
  title: 'Core/Navigation/Carousel',
  component: Carousel,
  parameters: { canvasInset: 'none', layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof Carousel>;
function Preview({ loop = false, multiple = false }: { loop?: boolean; multiple?: boolean }) {
  const t = useStorybookText();
  return (
    <Carousel
      loop={loop}
      withIndicators
      slideSize={multiple ? { base: '100%', sm: '50%', md: '33.333%' } : '100%'}
      labels={{
        region: t('Content'),
        previous: t('Previous page'),
        next: t('Next page'),
        slide: (page) => t('Page {page}', { page }),
      }}
    >
      {[1, 2, 3, 4].map((page) => (
        <SectionCard key={page}>
          <Text>{t('Page {page}', { page })}</Text>
        </SectionCard>
      ))}
    </Carousel>
  );
}
export const Single: Story = {
  render: () => <Preview />,
  tags: ['a11y-core-structure'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const slides = canvasElement.querySelectorAll('[data-geul-carousel-slide]');
    await waitFor(() => expect(slides[1]).toHaveAttribute('inert'));
    const next = canvas.getAllByRole('button').at(-1)!;
    await userEvent.click(next);
    await waitFor(() => expect(slides[1]).not.toHaveAttribute('inert'));
    await waitFor(() => expect(slides[0]).toHaveAttribute('aria-hidden', 'true'));
    await expect(next).toHaveFocus();
  },
};
export const Responsive: Story = { render: () => <Preview multiple /> };
export const Loop: Story = { render: () => <Preview loop multiple /> };
