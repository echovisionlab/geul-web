import type { Meta, StoryObj } from '@storybook/nextjs';
import { PublicEntityPreview } from '@/stories/shared/PublicEntityPreview';
const meta = {
  title: 'Pages/Public/Entities',
  component: PublicEntityPreview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicEntityPreview>;
export default meta;
export const Artist: StoryObj<typeof meta> = { args: { domain: 'artist' } };
export const ArtistEmpty: StoryObj<typeof meta> = { args: { domain: 'artist', empty: true } };
export const Label: StoryObj<typeof meta> = { args: { domain: 'label' } };
export const LabelEmpty: StoryObj<typeof meta> = { args: { domain: 'label', empty: true } };
export const Release: StoryObj<typeof meta> = { args: { domain: 'release' } };
export const ReleaseEmpty: StoryObj<typeof meta> = { args: { domain: 'release', empty: true } };
