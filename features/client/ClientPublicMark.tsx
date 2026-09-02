'use client';

import { Anchor, Text } from '@mantine/core';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';

export interface ClientPublicMarkProps {
  name: string;
  website?: string | null;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  height?: number;
  maxWidth?: number;
}

export function ClientPublicMark({
  name,
  website,
  logoUrl,
  logoLightUrl,
  logoDarkUrl,
  height = 24,
  maxWidth = 96,
}: ClientPublicMarkProps) {
  const hasLogo = Boolean(logoUrl || logoLightUrl || logoDarkUrl);
  if (hasLogo) {
    const logo = (
      <ThemedAssetImage
        fallbackUrl={logoUrl}
        lightUrl={logoLightUrl}
        darkUrl={logoDarkUrl}
        alt={name}
        height={height}
        style={{ height, maxWidth }}
      />
    );
    return website ? (
      <Anchor
        href={website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={name}
        style={{ display: 'inline-flex' }}
      >
        {logo}
      </Anchor>
    ) : (
      logo
    );
  }

  return website ? (
    <Anchor href={website} target="_blank" rel="noopener noreferrer" size="sm">
      {name}
    </Anchor>
  ) : (
    <Text size="sm" component="span">
      {name}
    </Text>
  );
}
