'use client';

import { LayoutInline as DsLayoutInline, LayoutStack } from '@/components/core/Layout';

import { IconExternalLink, IconMapPin } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Text, type TextProps, type TextTone } from '@/components/core/Typography';
// View pages load menu code on first interaction.
import { OnDemandDropdownMenu as DropdownMenu } from '@/components/core/DropdownMenu/OnDemandDropdownMenu';
import { TextButton } from '@/components/core/TextButton';
import { MAP_LINK_PROVIDERS, openMapProviderLink } from '@/features/map/utils/provider-links';
import { formatLocationPlace, type LocationPlaceSummary } from '@/lib/utils/location-place';

interface LocationPlaceMenuProps {
  place: LocationPlaceSummary;
  textColor?: TextTone;
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

  return (
    <DropdownMenu size="wide" placement="bottom-start" portal>
      <DropdownMenu.Target>
        <TextButton
          type="button"
          appearance="default"
          tone={textColor}
          size={textSize === 'xs' ? 'xs' : textSize === 'md' ? 'md' : 'sm'}
          display="block"
          indicator={showChevron ? 'menu' : undefined}
          aria-label={`${tCommon('actions.openIn')} ${locationAriaLabel}`}
          data-hover-accent={hoverAccent ? 'true' : 'false'}
        >
          <DsLayoutInline gap="xxs" wrap="nowrap" align={isDetailed ? 'start' : 'center'}>
            {showIcon && (
              <DsLayoutInline gap="none" shrink={false}>
                <IconMapPin size={iconSize} />
              </DsLayoutInline>
            )}
            {isDetailed ? (
              <LayoutStack flexible gap="none">
                {formattedPlace.name && (
                  <Text size={textSize} tone="inherit" as="div" wrap="anywhere" weight="strong">
                    {formattedPlace.name}
                  </Text>
                )}
                <Text size={textSize} tone="inherit" as="div" wrap="anywhere">
                  {`${tCommon('labels.latitude')} ${formattedPlace.latitude}`}
                </Text>
                <Text size={textSize} tone="inherit" as="div" wrap="anywhere">
                  {`${tCommon('labels.longitude')} ${formattedPlace.longitude}`}
                </Text>
              </LayoutStack>
            ) : (
              <Text size={textSize} tone="inherit" wrap="anywhere">
                {compactLabel}
              </Text>
            )}
          </DsLayoutInline>
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
