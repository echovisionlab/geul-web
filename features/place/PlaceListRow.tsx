'use client';
import { Text as DsText } from '@/components/core/Typography';
import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import { IconFocus2, IconTrash } from '@tabler/icons-react';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import type { Coordinate } from '@/lib/types/common/coordinate';
import type { MapPlace } from '@/lib/types/map-place/model';

export interface PlaceListRowLabels {
  /** Badge shown on the place that matches the map center. */
  centerBadge: string;
  centered: string;
  setAsCenter: string;
  remove: string;
}

export interface PlaceListRowProps {
  place: MapPlace;
  isCenter: boolean;
  labels: PlaceListRowLabels;
  onCenter: (place: MapPlace) => void;
  onRemove: (placeId: string) => void;
}

/** A place matches the map center within about ten meters. */
export function isPlaceAtCenter(place: MapPlace, center: Coordinate): boolean {
  return Math.abs(place.coordinate.lat - center.lat) < 0.0001 && Math.abs(place.coordinate.lng - center.lng) < 0.0001;
}

/** Shared map-place row: name/address, center state and the center/remove commands. */
export function PlaceListRow({ place, isCenter, labels, onCenter, onRemove }: PlaceListRowProps) {
  return (
    <DsLayoutInline gap="xs" justify="between">
      <DsLayoutInset flexible space="none">
        <DsLayoutInline gap="xxs">
          <DsText size="sm" weight="medium" truncate flexible>
            {place.name}
          </DsText>
          {isCenter ? <LabelBadge tone="accent">{labels.centerBadge}</LabelBadge> : null}
        </DsLayoutInline>
        <DsText size="xs" tone="secondary" truncate>
          {place.address}
        </DsText>
      </DsLayoutInset>
      <DsLayoutInline gap="xxs">
        <IconButton
          pressed={isCenter}
          size="sm"
          onClick={() => onCenter(place)}
          label={isCenter ? labels.centered : labels.setAsCenter}
          title={isCenter ? labels.centered : labels.setAsCenter}
        >
          <IconFocus2 size={14} />
        </IconButton>
        <IconButton
          tone="danger"
          emphasis="low"
          size="sm"
          onClick={() => onRemove(place.id)}
          label={labels.remove}
          title={labels.remove}
        >
          <IconTrash size={14} />
        </IconButton>
      </DsLayoutInline>
    </DsLayoutInline>
  );
}
