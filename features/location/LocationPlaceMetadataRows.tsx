'use client';
import { Text as DsText, type TextTone } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutVisibility } from '@/components/core/Layout';
import { PublicMetadataRow, type MetadataTextSize } from '@/components/core/PublicMetadata';
import { formatLocationPlace, type LocationPlaceSummary } from '@/lib/utils/location-place';
import { LocationPlaceMenu } from './LocationPlaceMenu';
export type CoordinateVisibilityMode = 'always' | 'desktop' | 'never';
interface LocationPlaceMetadataRowsProps {
  place: LocationPlaceSummary;
  labelColor?: TextTone;
  valueColor?: TextTone;
  textSize?: MetadataTextSize;
  coordinateVisibility?: CoordinateVisibilityMode;
}
interface MetadataRowProps {
  label: string;
  value: ReactNode;
  labelColor: TextTone;
  textSize: MetadataTextSize;
}
function MetadataRow({ label, value, labelColor, textSize }: MetadataRowProps) {
  return (
    <PublicMetadataRow label={label} labelColor={labelColor} size={textSize}>
      {value}
    </PublicMetadataRow>
  );
}
export function LocationPlaceMetadataRows({
  place,
  labelColor = 'secondary',
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
          <DsText size={textSize} tone={valueColor} wrap="anywhere">
            {value}
          </DsText>
        }
      />
    );
    if (coordinateVisibility === 'desktop') {
      return <LayoutVisibility visibleFrom="sm">{row}</LayoutVisibility>;
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
