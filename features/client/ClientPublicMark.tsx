'use client';

import { Text as DsText } from '@/components/core/Typography';

import { useEffect, useRef, useState } from 'react';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import classes from './ClientPublicMark.module.css';

export interface ClientPublicMarkProps {
  name: string;
  website?: string | null;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
}

/** Wordmarks and square symbols read at a similar weight when they cover a similar area. */
const LOGO_AREA = 20 * 60;
const LOGO_MIN_HEIGHT = 12;
const LOGO_MAX_HEIGHT = 24;
const LOGO_MAX_WIDTH = 104;

export function opticalLogoSize(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const aspect = naturalWidth / naturalHeight;
  let height = Math.min(LOGO_MAX_HEIGHT, Math.max(LOGO_MIN_HEIGHT, Math.sqrt(LOGO_AREA / aspect)));
  if (height * aspect > LOGO_MAX_WIDTH) {
    height = LOGO_MAX_WIDTH / aspect;
  }
  return { width: Math.round(height * aspect), height: Math.round(height) };
}

function OpticalLogo({ name, logoUrl, logoLightUrl, logoDarkUrl }: ClientPublicMarkProps) {
  const frame = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const image = frame.current?.querySelector('img');
    if (!image) {
      return;
    }
    const measure = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setSize(opticalLogoSize(image.naturalWidth, image.naturalHeight));
      }
    };
    if (image.complete) {
      measure();
    }
    image.addEventListener('load', measure);
    return () => image.removeEventListener('load', measure);
  }, [logoUrl, logoLightUrl, logoDarkUrl]);

  return (
    <span ref={frame} className={classes.logo} data-measured={size ? '' : undefined}>
      <ThemedAssetImage
        fallbackUrl={logoUrl}
        lightUrl={logoLightUrl}
        darkUrl={logoDarkUrl}
        alt={name}
        style={size ?? { height: 20, width: 'auto', maxWidth: LOGO_MAX_WIDTH }}
      />
    </span>
  );
}

/**
 * A client in the public metadata voice: its logo at an optical size, neutral until the link is
 * engaged; the name when there is no logo. Either is the single link to the client's website.
 */
export function ClientPublicMark(props: ClientPublicMarkProps) {
  const { name, website, logoUrl, logoLightUrl, logoDarkUrl } = props;
  const hasLogo = Boolean(logoUrl || logoLightUrl || logoDarkUrl);
  if (hasLogo) {
    const logo = <OpticalLogo {...props} />;
    return website ? (
      <Anchor href={website} target="_blank" rel="noopener noreferrer" aria-label={name} appearance="block">
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
    <DsText size="sm" as="span">
      {name}
    </DsText>
  );
}
