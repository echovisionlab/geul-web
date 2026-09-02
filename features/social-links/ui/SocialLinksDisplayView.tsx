'use client';

import { Anchor, Group, Stack, Text, type MantineSpacing } from '@mantine/core';
import { IconButton, type IconButtonProps } from '@/components/core/IconButton';
import { SocialIcon, type SocialIconColorMode, type SocialPlatform } from '@/components/core/Social';
import { Tooltip } from '@/components/core/Tooltip';
import classes from './SocialLinksDisplay.module.css';

export interface SocialLinkDisplayViewModel {
  key: string;
  platform: SocialPlatform;
  url: string;
  label: string;
}

export interface SocialLinksDisplayViewProps {
  entries: SocialLinkDisplayViewModel[];
  iconSize?: number;
  gap?: MantineSpacing;
  showLabels?: boolean;
  variant?: 'icon' | 'button' | 'list';
  iconColor?: SocialIconColorMode;
  iconButtonSize?: IconButtonProps['size'];
  iconButtonEmphasis?: IconButtonProps['emphasis'];
}

export function SocialLinksDisplayView({
  entries,
  iconSize = 18,
  gap = 'xs',
  showLabels = false,
  variant = 'icon',
  iconColor = 'hoverBrand',
  iconButtonSize = 'sm',
  iconButtonEmphasis = 'low',
}: SocialLinksDisplayViewProps) {
  if (entries.length === 0) {
    return null;
  }

  if (variant === 'list') {
    return (
      <Stack gap={gap}>
        {entries.map(({ key, platform, url, label }) => (
          <Anchor
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className={classes.socialLink}
            aria-label={label}
          >
            <Group gap="xs" wrap="nowrap">
              <SocialIcon platform={platform} size={iconSize} colorMode={iconColor} />
              {showLabels ? <Text size="sm">{label}</Text> : null}
            </Group>
          </Anchor>
        ))}
      </Stack>
    );
  }

  if (variant === 'button') {
    return (
      <Group gap={gap}>
        {entries.map(({ key, platform, url, label }) => (
          <Tooltip key={key} label={label}>
            <IconButton
              component="a"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              emphasis={iconButtonEmphasis}
              size={iconButtonSize}
              aria-label={label}
              className={classes.socialButton}
            >
              <SocialIcon platform={platform} size={iconSize} colorMode={iconColor} />
            </IconButton>
          </Tooltip>
        ))}
      </Group>
    );
  }

  return (
    <Group gap={gap}>
      {entries.map(({ key, platform, url, label }) => (
        <Tooltip key={key} label={label}>
          <Anchor
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={classes.socialLink}
            aria-label={label}
          >
            <SocialIcon platform={platform} size={iconSize} colorMode={iconColor} />
          </Anchor>
        </Tooltip>
      ))}
    </Group>
  );
}
