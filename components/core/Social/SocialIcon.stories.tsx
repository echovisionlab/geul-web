import type { Meta, StoryObj } from '@storybook/nextjs';
import { Anchor, Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';

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
  title: 'Core/Social',
  component: SocialIcon,
  tags: ['core-social'],
  parameters: { layout: 'centered' },
  args: {
    platform: 'instagram',
    size: 24,
    colorMode: 'currentColor',
  },
};

export default meta;
type Story = StoryObj<typeof SocialIcon>;

function ThemeAwareBrandIcons() {
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg">
      {darkVariantPlatforms.map((platform) => (
        <Stack key={platform} gap={6} align="center">
          <SocialIcon platform={platform} size={32} colorMode="brand" data-testid={`${platform}-theme-icon`} />
          <Text size="xs">{getSocialIconLabel(platform)}</Text>
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export const RepresentativePlatforms: Story = {
  render: () => (
    <Group gap="lg">
      {representativePlatforms.map((platform) => (
        <Stack key={platform} gap={6} align="center">
          <SocialIcon platform={platform} size={28} colorMode="brand" />
          <Text size="xs">{getSocialIconLabel(platform)}</Text>
        </Stack>
      ))}
    </Group>
  ),
};

export const AllPlatforms: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} spacing="lg" data-testid="all-platforms">
      {SOCIAL_ICON_PLATFORMS.map((platform) => (
        <Stack key={platform} gap={6} align="center" data-platform={platform}>
          <SocialIcon platform={platform} size={26} colorMode="brand" />
          <Text size="xs" ta="center">
            {getSocialIconLabel(platform)}
          </Text>
        </Stack>
      ))}
    </SimpleGrid>
  ),
};

export const BrandColorsLight: Story = {
  globals: { theme: 'light' },
  parameters: { layout: 'padded' },
  render: () => <ThemeAwareBrandIcons />,
};

export const BrandColorsDark: Story = {
  globals: { theme: 'dark' },
  parameters: { layout: 'padded' },
  render: () => <ThemeAwareBrandIcons />,
};

export const AccessibleInteractiveLink: Story = {
  render: () => (
    <Box p="md">
      <Anchor href="https://bandcamp.com" target="_blank" rel="noopener noreferrer" aria-label="Open Bandcamp">
        <SocialIcon platform="bandcamp" size={32} colorMode="hoverBrand" />
      </Anchor>
    </Box>
  ),
};
