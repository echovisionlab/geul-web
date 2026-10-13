'use client';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  type Space,
  type Responsive,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { NavigationLink as Anchor } from '@/components/core/Navigation';
import { IconButton, type IconButtonProps } from '@/components/core/IconButton';
// The catalog-free renderer keeps the platform catalog on the server; glyphs come from Core prepareSocialIcon.
import { SocialIconGlyph } from '@/components/core/Social/SocialIconGlyph';
import type { PreparedSocialIcon, SocialIconColorMode, SocialIconSize, SocialPlatform } from '@/components/core/Social';
// Public chrome: hint surfaces load on first hover/focus (same markup and behaviour as Tooltip).
import { OnDemandTooltip as Tooltip } from '@/components/core/Tooltip/OnDemandTooltip';
export interface SocialLinkDisplayViewModel {
  key: string;
  platform: SocialPlatform;
  url: string;
  label: string;
  glyph: PreparedSocialIcon;
}
export interface SocialLinksDisplayViewProps {
  entries: SocialLinkDisplayViewModel[];
  iconSize?: SocialIconSize;
  gap?: Responsive<Space>;
  showLabels?: boolean;
  variant?: 'icon' | 'button' | 'list';
  iconColor?: SocialIconColorMode;
  iconButtonSize?: IconButtonProps['size'];
  iconButtonEmphasis?: IconButtonProps['emphasis'];
}
export function SocialLinksDisplayView({
  entries,
  iconSize = 'lg',
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
      <DsLayoutStack gap={gap}>
        {entries.map(({ key, url, label, glyph }) => (
          <Anchor
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            appearance="quiet"
            tone="secondary"
            aria-label={label}
          >
            <DsLayoutInline gap="xs" wrap="nowrap">
              <SocialIconGlyph icon={glyph} size={iconSize} colorMode={iconColor} />
              {showLabels ? <DsText size="sm">{label}</DsText> : null}
            </DsLayoutInline>
          </Anchor>
        ))}
      </DsLayoutStack>
    );
  }
  if (variant === 'button') {
    return (
      <DsLayoutInline gap={gap}>
        {entries.map(({ key, url, label, glyph }) => (
          <Tooltip key={key} label={label}>
            <IconButton
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              emphasis={iconButtonEmphasis}
              size={iconButtonSize}
              tone="neutral"
              aria-label={label}
            >
              <SocialIconGlyph icon={glyph} size={iconSize} colorMode={iconColor} />
            </IconButton>
          </Tooltip>
        ))}
      </DsLayoutInline>
    );
  }
  return (
    <DsLayoutInline gap={gap}>
      {entries.map(({ key, url, label, glyph }) => (
        <Tooltip key={key} label={label}>
          <Anchor href={url} target="_blank" rel="noopener noreferrer" tone="secondary" aria-label={label}>
            <SocialIconGlyph icon={glyph} size={iconSize} colorMode={iconColor} />
          </Anchor>
        </Tooltip>
      ))}
    </DsLayoutInline>
  );
}
