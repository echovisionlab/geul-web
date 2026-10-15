'use client';
import type { MouseEvent } from 'react';
import type { OverlayPresentationProps } from '../overlay-contract';
import { SectionCard } from '../Section';
import { IconButton } from '../IconButton';
import { IconPlus, IconMinus, IconCompass } from '@tabler/icons-react';
import classes from './MapNavigation.module.css';
export interface MapNavigationProps extends OverlayPresentationProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  labels: { group: string; zoomIn: string; zoomOut: string; resetNorth: string };
  onZoomIn: (event: MouseEvent<HTMLElement>) => void;
  onZoomOut: (event: MouseEvent<HTMLElement>) => void;
  onResetNorth: (event: MouseEvent<HTMLElement>) => void;
  zoomInDisabled?: boolean;
  zoomOutDisabled?: boolean;
}
export function MapNavigation({
  position = 'top-right',
  labels,
  onZoomIn,
  onZoomOut,
  onResetNorth,
  zoomInDisabled,
  zoomOutDisabled,
}: MapNavigationProps) {
  if (!['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(position)) {
    throw new TypeError('Unknown map navigation position');
  }
  return (
    <div className={classes.navigation} data-geul-map-position={position} role="group" aria-label={labels.group}>
      <SectionCard padding="xxs" layout="stack">
        <IconButton
          size="xs"
          label={labels.zoomIn}
          disabled={zoomInDisabled}
          onClick={onZoomIn}
          data-map-command="zoom-in"
        >
          <IconPlus size="1em" aria-hidden />
        </IconButton>
        <IconButton
          size="xs"
          label={labels.zoomOut}
          disabled={zoomOutDisabled}
          onClick={onZoomOut}
          data-map-command="zoom-out"
        >
          <IconMinus size="1em" aria-hidden />
        </IconButton>
        <IconButton size="xs" label={labels.resetNorth} onClick={onResetNorth} data-map-command="reset-north">
          <IconCompass size="1em" aria-hidden />
        </IconButton>
      </SectionCard>
    </div>
  );
}
