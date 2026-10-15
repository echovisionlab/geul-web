import { withFeatureLabels } from '@/stories/feature-localization';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { createTranslator } from 'next-intl';
import { expect, within } from 'storybook/test';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { ListViewShell } from './ListViewShell';

function ratioImage(width: number, height: number) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#172554"/><rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="#22d3ee" stroke-width="8"/><circle cx="${width / 2}" cy="${height / 2}" r="40" fill="#fbbf24"/><text x="50%" y="75%" fill="white" text-anchor="middle" font-size="24">${width}:${height}</text></svg>`)}`;
}

const meta: Meta<typeof ListViewShell> = {
  title: 'Feature/Page/List Image Ratios',
  component: ListViewShell,
  decorators: [withFeatureLabels({ project: (_args, t) => ({ emptyLabel: t('common.messages.noPostsFound') }) })],
  parameters: { layout: 'padded' },
  args: {
    items: [
      { id: 'wide', href: '/wide', title: 'Landscape 16:9', imageUrl: ratioImage(640, 360) },
      { id: 'tall', href: '/tall', title: 'Portrait 2:3', imageUrl: ratioImage(240, 360) },
    ],
    className: '',
    emptyLabel: 'Empty',
    layout: 'grid',
    columns: 2,
    showImage: true,
    imageAspectRatio: 'auto',
    carouselLoop: false,
    carouselIndicators: false,
  },
};
export default meta;
type Story = StoryObj<typeof ListViewShell>;
export const OriginalRatios: Story = {};
export const SquareCrop: Story = { args: { imageAspectRatio: '1:1' } };
export const ListOriginalRatios: Story = { args: { layout: 'list' } };
export const CardsOriginalRatios: Story = { args: { layout: 'cards' } };
export const CarouselOriginalRatios: Story = { args: { layout: 'carousel' } };

export const MissingTitleSemantics: Story = {
  args: { items: [{ id: 'untitled', href: '/untitled', title: null, imageUrl: null }], layout: 'list' },
  tags: ['a11y-author'],
  play: async ({ canvasElement, globals }) => {
    const locale = normalizeLocale(globals.locale) ?? DEFAULT_LOCALE;
    const { default: messages } = await import(`../../../messages/${locale}.json`);
    const t = createTranslator({ locale, messages, namespace: 'common.states' });
    const canvas = within(canvasElement);
    const links = canvas.getAllByRole('link');
    await expect(canvas.getByRole('list')).toBeVisible();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1);
    for (const link of links) {
      await expect(link).toHaveAccessibleName(t('untitled'));
      await expect(link).toHaveAttribute('href', '/untitled');
      await expect(link.textContent).toBe('');
    }
  },
};
