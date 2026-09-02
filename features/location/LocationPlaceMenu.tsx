'use client';

import type { CSSProperties } from 'react';
import { IconChevronDown, IconExternalLink, IconMapPin } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Text, type TextProps } from '@mantine/core';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { TextButton } from '@/components/core/TextButton';
import { MAP_LINK_PROVIDERS, openMapProviderLink } from '@/features/map/utils/provider-links';
import { formatLocationPlace, type LocationPlaceSummary } from '@/lib/utils/location-place';
import classes from './LocationPlaceMenu.module.css';

interface LocationPlaceMenuProps {
  place: LocationPlaceSummary;
  textColor?: string;
  textSize?: TextProps['size'];
  iconSize?: number;
  variant?: 'details' | 'name';
  showIcon?: boolean;
  showChevron?: boolean;
  fallbackLabel?: string;
  hoverAccent?: boolean;
}

export function LocationPlaceMenu({
  place,
  textColor = 'inherit',
  textSize = 'sm',
  iconSize = 14,
  variant = 'details',
  showIcon = true,
  showChevron = true,
  fallbackLabel,
  hoverAccent = variant === 'name',
}: LocationPlaceMenuProps) {
  const tCommon = useTranslations('common');
  const formattedPlace = formatLocationPlace(place);
  const compactLabel = formattedPlace.name || fallbackLabel || tCommon('labels.coordinates');
  const isDetailed = variant === 'details';
  const locationAriaLabel = formattedPlace.name
    ? `${formattedPlace.name}. ${tCommon('labels.latitude')} ${formattedPlace.latitude}. ${tCommon('labels.longitude')} ${formattedPlace.longitude}.`
    : `${tCommon('labels.latitude')} ${formattedPlace.latitude}. ${tCommon('labels.longitude')} ${formattedPlace.longitude}.`;

  const triggerStyle = textColor
    ? ({
        '--text-button-color': textColor,
        '--text-button-hover-color': hoverAccent ? 'var(--mantine-primary-color-filled)' : textColor,
      } as CSSProperties)
    : undefined;

  return (
    <DropdownMenu size="wide" placement="bottom-start" portal>
      <DropdownMenu.Target>
        <TextButton
          type="button"
          appearance="default"
          size={textSize === 'xs' ? 'xs' : textSize === 'md' ? 'md' : 'sm'}
          display="block"
          aria-label={`${tCommon('actions.openIn')} ${locationAriaLabel}`}
          className={classes.trigger}
          style={triggerStyle}
          data-hover-accent={hoverAccent ? 'true' : 'false'}
        >
          <Group gap={6} wrap="nowrap" align={isDetailed ? 'flex-start' : 'center'}>
            {showIcon && <IconMapPin size={iconSize} style={{ flexShrink: 0, marginTop: 2 }} />}
            {isDetailed ? (
              <span
                style={{
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {formattedPlace.name && (
                  <Text
                    size={textSize}
                    c="inherit"
                    span
                    style={{
                      display: 'block',
                      overflowWrap: 'anywhere',
                      fontWeight: 600,
                      lineHeight: 1.35,
                    }}
                  >
                    {formattedPlace.name}
                  </Text>
                )}
                <Text
                  size={textSize}
                  c="inherit"
                  span
                  style={{
                    display: 'block',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.35,
                  }}
                >
                  {`${tCommon('labels.latitude')} ${formattedPlace.latitude}`}
                </Text>
                <Text
                  size={textSize}
                  c="inherit"
                  span
                  style={{
                    display: 'block',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.35,
                  }}
                >
                  {`${tCommon('labels.longitude')} ${formattedPlace.longitude}`}
                </Text>
              </span>
            ) : (
              <Text size={textSize} c="inherit" span className={classes.compactLabel}>
                {compactLabel}
              </Text>
            )}
            {showChevron && <IconChevronDown size={12} style={{ flexShrink: 0 }} />}
          </Group>
        </TextButton>
      </DropdownMenu.Target>

      <DropdownMenu.Dropdown>
        <DropdownMenu.Label>{tCommon('actions.openIn')}</DropdownMenu.Label>
        {MAP_LINK_PROVIDERS.map((provider) => (
          <DropdownMenu.Item
            key={provider.id}
            icon={<IconExternalLink size={14} />}
            onClick={() => {
              openMapProviderLink(provider.buildPlaceLink(place));
            }}
          >
            {provider.label}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
