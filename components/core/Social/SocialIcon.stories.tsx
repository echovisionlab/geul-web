import {
  LayoutGrid as DsLayoutGrid,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { useTranslations } from 'next-intl';

import { getSocialIconLabel, SocialIcon, type SocialPlatform } from './SocialIcon';
import { SOCIAL_ICON_PLATFORMS } from './platforms';

const representativePlatforms: SocialPlatform[] = ['facebook', 'instagram', 'youtube', 'github', 'spotify', 'bandcamp'];
const darkVariantPlatforms: SocialPlatform[] = [
  'github',
  'twitter',
  'tiktok',
  'threads',
  'medium',
  'patreon',
  'discogs',
  'tidal',
  'letterboxd',
  'mixcloud',
  'bandcamp',
];

const meta: Meta<typeof SocialIcon> = {
  title: 'Core/Data Display/SocialIcon',
  component: SocialIcon,
  tags: ['core-social'],
  parameters: { layout: 'centered' },
  args: {
    platform: 'instagram',
    size: 'xl',
    colorMode: 'currentColor',
  },
};

export default meta;
type Story = StoryObj<typeof SocialIcon>;

function ThemeAwareBrandIcons() {
  return (
    <DsLayoutGrid columns={{ base: 2, sm: 4 }} gap="lg">
      {darkVariantPlatforms.map((platform) => (
        <DsLayoutStack key={platform} gap="xxs" align="center">
          <SocialIcon platform={platform} size="xl" colorMode="brand" data-testid={`${platform}-theme-icon`} />
          <DsText size="xs">{getSocialIconLabel(platform)}</DsText>
        </DsLayoutStack>
      ))}
    </DsLayoutGrid>
  );
}

export const RepresentativePlatforms: Story = {
  render: () => (
    <DsLayoutInline gap="lg">
      {representativePlatforms.map((platform) => (
        <DsLayoutStack key={platform} gap="xxs" align="center">
          <SocialIcon platform={platform} size="xl" colorMode="brand" />
          <DsText size="xs">{getSocialIconLabel(platform)}</DsText>
        </DsLayoutStack>
      ))}
    </DsLayoutInline>
  ),
};

export const AllPlatforms: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <DsLayoutGrid columns={{ base: 2, sm: 4, md: 6 }} gap="lg" data-testid="all-platforms">
      {SOCIAL_ICON_PLATFORMS.map((platform) => (
        <DsLayoutStack key={platform} gap="xxs" align="center" data-platform={platform}>
          <SocialIcon platform={platform} size="xl" colorMode="brand" />
          <DsText size="xs" align="center">
            {getSocialIconLabel(platform)}
          </DsText>
        </DsLayoutStack>
      ))}
    </DsLayoutGrid>
  ),
};

export const ThemeAwareBrandColors: Story = {
  parameters: { layout: 'padded' },
  render: () => <ThemeAwareBrandIcons />,
};

function InteractiveLink() {
  const t = useTranslations('common.actions');
  return (
    <div style={{ padding: 'var(--geul-spacing-md)' }}>
      <Anchor
        href="https://bandcamp.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t('open')}: Bandcamp`}
      >
        <SocialIcon platform="bandcamp" size="xl" colorMode="hoverBrand" />
      </Anchor>
    </div>
  );
}

export const AccessibleInteractiveLink: Story = {
  render: () => <InteractiveLink />,
};

export const SharedSizeScale: Story = {
  render: () => (
    <DsLayoutInline gap="lg" align="center">
      {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
        <DsLayoutStack key={size} gap="xxs" align="center">
          <SocialIcon platform="github" size={size} colorMode="brand" />
          <DsText size="xs">{size}</DsText>
        </DsLayoutStack>
      ))}
    </DsLayoutInline>
  ),
};

/** Sign-in identities: Google keeps its four fixed segment colors in brand mode; currentColor draws one color. */
export const SignInIdentities: Story = {
  render: () => (
    <DsLayoutInline gap="lg" align="center">
      {(['brand', 'currentColor'] as const).map((colorMode) =>
        (['google', 'github'] as const).map((platform) => (
          <DsLayoutStack key={`${platform}-${colorMode}`} gap="xxs" align="center">
            <SocialIcon platform={platform} size="xl" colorMode={colorMode} />
            <DsText size="xs">
              {platform} · {colorMode}
            </DsText>
          </DsLayoutStack>
        )),
      )}
    </DsLayoutInline>
  ),
};
