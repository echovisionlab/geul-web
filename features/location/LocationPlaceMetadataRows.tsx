'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Box, Text, type TextProps } from '@mantine/core';
import { PublicMetadataRow } from '@/components/core/PublicMetadata';
import { formatLocationPlace, type LocationPlaceSummary } from '@/lib/utils/location-place';
import { LocationPlaceMenu } from './LocationPlaceMenu';

export type CoordinateVisibilityMode = 'always' | 'desktop' | 'never';

interface LocationPlaceMetadataRowsProps {
  place: LocationPlaceSummary;
  labelColor?: string;
  valueColor?: string;
  textSize?: TextProps['size'];
  coordinateVisibility?: CoordinateVisibilityMode;
}

interface MetadataRowProps {
  label: string;
  value: ReactNode;
  labelColor: string;
  textSize: TextProps['size'];
}

function MetadataRow({ label, value, labelColor, textSize }: MetadataRowProps) {
  return (
    <PublicMetadataRow label={label} labelColor={labelColor} labelSize={textSize}>
      {value}
    </PublicMetadataRow>
  );
}

export function LocationPlaceMetadataRows({
  place,
  labelColor = 'dimmed',
  valueColor = 'inherit',
  textSize = 'sm',
  coordinateVisibility = 'always',
}: LocationPlaceMetadataRowsProps) {
  const tCommon = useTranslations('common');
  const formattedPlace = formatLocationPlace(place);
  const locationName = formattedPlace.name || tCommon('labels.coordinates');

  const renderCoordinateRow = (label: string, value: string) => {
    if (coordinateVisibility === 'never') {
      return null;
    }

    const row = (
      <MetadataRow
        label={label}
        labelColor={labelColor}
        textSize={textSize}
        value={
          <Text size={textSize} c={valueColor} style={{ overflowWrap: 'anywhere' }}>
            {value}
          </Text>
        }
      />
    );

    if (coordinateVisibility === 'desktop') {
      return <Box visibleFrom="sm">{row}</Box>;
    }

    return row;
  };

  return (
    <>
      <MetadataRow
        label={tCommon('labels.location')}
        labelColor={labelColor}
        textSize={textSize}
        value={
          <LocationPlaceMenu
            place={place}
            variant="name"
            textColor={valueColor}
            textSize={textSize}
            showIcon={false}
            showChevron={false}
            fallbackLabel={locationName}
          />
        }
      />
      {renderCoordinateRow(tCommon('labels.latitude'), formattedPlace.latitude)}
      {renderCoordinateRow(tCommon('labels.longitude'), formattedPlace.longitude)}
    </>
  );
}
