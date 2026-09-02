import type { ReactNode } from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import satori, { type Font } from 'satori';
import sharp from 'sharp';
import type { ContentOgImageConfig, HomeOgImageConfig } from '@/lib/types/site-setting/config';
import { DEFAULT_CONTENT_OG_CONFIG, DEFAULT_HOME_OG_CONFIG } from './og-config';

export { DEFAULT_HOME_OG_CONFIG, DEFAULT_CONTENT_OG_CONFIG };

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// Gradient overlay for featured image (not configurable for simplicity)
const GRADIENT_OVERLAY = 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.2) 100%)';
const TITLE_TEXT_SHADOW = '0 2px 8px rgba(0,0,0,0.5)';

// Font cache to avoid re-reading files
const fontCache = new Map<string, Buffer>();

interface FontConfig {
  name: string;
  weight: 400 | 700;
  filename: string;
  system?: boolean;
}

// Local font files in lib/assets/fonts/
const FONT_CONFIGS: FontConfig[] = [
  { name: 'Noto Sans', weight: 400, filename: 'NotoSans-Regular.ttf' },
  { name: 'Noto Sans', weight: 700, filename: 'NotoSans-Bold.ttf' },
  { name: 'Noto Sans KR', weight: 400, filename: 'NotoSansKR-Regular.ttf' },
  { name: 'Noto Sans KR', weight: 700, filename: 'NotoSansKR-Bold.ttf' },
  { name: 'Noto Sans JP', weight: 400, filename: 'NotoSansJP-Regular.ttf' },
  { name: 'Noto Sans JP', weight: 700, filename: 'NotoSansJP-Bold.ttf' },
  { name: 'Noto Sans SC', weight: 400, filename: 'NotoSansSC-Regular.ttf' },
  { name: 'Noto Sans SC', weight: 700, filename: 'NotoSansSC-Bold.ttf' },
  { name: 'Noto Sans Arabic', weight: 400, filename: 'NotoSansArabic-Regular.ttf', system: true },
  { name: 'Noto Sans Arabic', weight: 700, filename: 'NotoSansArabic-Bold.ttf', system: true },
  { name: 'Noto Sans Thai', weight: 400, filename: 'NotoSansThai-Regular.ttf', system: true },
  { name: 'Noto Sans Thai', weight: 700, filename: 'NotoSansThai-Bold.ttf', system: true },
];

const FONTS_DIR = join(process.cwd(), 'lib/assets/fonts');

function loadFont(config: FontConfig): Buffer {
  const cacheKey = `${config.name}-${config.weight}`;

  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey)!;
  }

  const fontPath = config.system ? join('/usr/share/fonts/noto', config.filename) : join(FONTS_DIR, config.filename);
  const buffer = readFileSync(fontPath);
  fontCache.set(cacheKey, buffer);
  return buffer;
}

function loadFonts(): Font[] {
  const fonts: Font[] = [];

  for (const config of FONT_CONFIGS) {
    try {
      const data = loadFont(config);
      fonts.push({
        name: config.name,
        weight: config.weight,
        style: 'normal',
        data,
      });
    } catch {
      // Font loading failed - continue with other fonts
    }
  }

  return fonts;
}

export interface OgImageSettings {
  siteTitle: string;
  primaryColor: string;
  logoSvg?: string;
  featuredImageDataUrl?: string;
}

function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.substring(0, maxLength - 3)}...`;
}

interface OgTemplateProps {
  title: string;
  settings: OgImageSettings;
  config: ContentOgImageConfig;
}

function OgImageTemplate({ title, settings, config }: OgTemplateProps): ReactNode {
  const truncatedTitle = truncateTitle(title, config.title.maxLength);
  const hasFeaturedImage = !!settings.featuredImageDataUrl;
  const { title: titleConfig, logo: logoConfig, siteTitle: siteTitleConfig } = config;

  const fontSize =
    truncatedTitle.length > titleConfig.fontSizeThreshold ? titleConfig.fontSizeSmall : titleConfig.fontSizeLarge;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: config.darkBackground,
        fontFamily: 'Noto Sans Arabic, Noto Sans Thai, Noto Sans KR, Noto Sans JP, Noto Sans SC, Noto Sans',
      }}
    >
      {/* Featured image overlays the configured canvas color when present */}
      {hasFeaturedImage ? (
        <img
          src={settings.featuredImageDataUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : null}

      {/* Gradient overlay for text readability */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: hasFeaturedImage ? GRADIENT_OVERLAY : 'transparent',
        }}
      />

      {/* Title - centered */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: `${titleConfig.padding.top}px ${titleConfig.padding.right}px ${titleConfig.padding.bottom}px ${titleConfig.padding.left}px`,
        }}
      >
        <div
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: titleConfig.fontWeight,
            color: titleConfig.color,
            textAlign: 'center',
            lineHeight: titleConfig.lineHeight,
            wordBreak: 'keep-all',
            textShadow: hasFeaturedImage ? TITLE_TEXT_SHADOW : 'none',
          }}
        >
          {truncatedTitle}
        </div>
      </div>

      {/* Logo or site title - bottom right */}
      <div
        style={{
          position: 'absolute',
          bottom: logoConfig.position.bottom,
          right: logoConfig.position.right,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {settings.logoSvg ? (
          <img
            src={settings.logoSvg}
            width={logoConfig.width}
            height={logoConfig.height}
            style={{ objectFit: 'contain' }}
            alt=""
          />
        ) : (
          <div
            style={{
              fontSize: `${siteTitleConfig.fontSize}px`,
              fontWeight: siteTitleConfig.fontWeight,
              color: siteTitleConfig.color,
              opacity: siteTitleConfig.opacity,
            }}
          >
            {settings.siteTitle}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Generate an OG image as PNG buffer (for content: post/page/work)
 */
export async function generateOgImage(
  title: string,
  settings: OgImageSettings,
  config: ContentOgImageConfig = DEFAULT_CONTENT_OG_CONFIG,
): Promise<Buffer> {
  const fonts = loadFonts();

  if (fonts.length === 0) {
    throw new Error('No fonts loaded for OG image generation');
  }

  const template = OgImageTemplate({ title, settings, config });

  const svg = await satori(template, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });

  // Convert SVG to WebP using Sharp
  const webpBuffer = await sharp(Buffer.from(svg)).webp({ lossless: true }).toBuffer();

  return webpBuffer;
}

interface HomeOgTemplateProps {
  settings: OgImageSettings;
  config: HomeOgImageConfig;
}

function HomeOgImageTemplate({ settings, config }: HomeOgTemplateProps): ReactNode {
  const hasFeaturedImage = !!settings.featuredImageDataUrl;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: config.darkBackground,
        fontFamily: 'Noto Sans Arabic, Noto Sans Thai, Noto Sans KR, Noto Sans JP, Noto Sans SC, Noto Sans',
      }}
    >
      {hasFeaturedImage ? (
        <img
          src={settings.featuredImageDataUrl}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : null}
      {hasFeaturedImage ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.36)',
          }}
        />
      ) : null}
      {settings.logoSvg ? (
        <img
          src={settings.logoSvg}
          width={config.logo.width}
          height={config.logo.height}
          style={{ objectFit: 'contain', position: 'relative' }}
          alt=""
        />
      ) : (
        <div
          style={{
            position: 'relative',
            fontSize: `${config.siteTitle.fontSize}px`,
            fontWeight: config.siteTitle.fontWeight,
            color: config.siteTitle.color,
            textAlign: 'center',
          }}
        >
          {settings.siteTitle}
        </div>
      )}
    </div>
  );
}

/**
 * Generate a homepage OG image (logo-centered, no title)
 */
export async function generateHomeOgImage(
  settings: OgImageSettings,
  config: HomeOgImageConfig = DEFAULT_HOME_OG_CONFIG,
): Promise<Buffer> {
  const fonts = loadFonts();

  if (fonts.length === 0) {
    throw new Error('No fonts loaded for OG image generation');
  }

  const template = HomeOgImageTemplate({ settings, config });

  const svg = await satori(template, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });

  // Convert SVG to WebP using Sharp
  const webpBuffer = await sharp(Buffer.from(svg)).webp({ lossless: true }).toBuffer();

  return webpBuffer;
}
