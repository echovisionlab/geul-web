'use client';

import type { CSSProperties, ReactNode, Ref } from 'react';
import { Box, Paper, Text } from '@mantine/core';
import { TextButton } from '@/components/core/TextButton';

import './MapLibreMapView.css';

export interface MapAttributionViewModel {
  label: string;
  href: string;
}

export interface MapProviderOptionViewModel {
  id: string;
  label: string;
  icon: 'google' | 'naver';
}

export interface MapDirectionsViewModel {
  title: string;
  options: MapProviderOptionViewModel[];
}

export interface MapLibreMapViewProps {
  height: string | number;
  zIndex?: number;
  className?: string;
  backgroundColor: string;
  mapSurface: ReactNode;
  isReady: boolean;
  loadingSurface: ReactNode;
  attributionItems: MapAttributionViewModel[];
  attributionColor?: string;
  attributionFontSize?: number;
  directions: MapDirectionsViewModel | null;
  onCloseDirections: () => void;
  onSelectProvider: (providerId: string) => void;
  backdropZIndex: number;
  modalZIndex: number;
  printImageUrl: string | null;
  printPreviewAlt: string;
  containerRef: Ref<HTMLDivElement>;
}

function GoogleMapsIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function NaverMapsIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="#03C75A">
      <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z" />
    </svg>
  );
}

export function MapLibreMapView({
  height,
  zIndex,
  className,
  backgroundColor,
  mapSurface,
  isReady,
  loadingSurface,
  attributionItems,
  attributionColor,
  attributionFontSize,
  directions,
  onCloseDirections,
  onSelectProvider,
  backdropZIndex,
  modalZIndex,
  printImageUrl,
  printPreviewAlt,
  containerRef,
}: MapLibreMapViewProps) {
  return (
    <Box
      ref={containerRef}
      pos="relative"
      w="100%"
      h={height}
      style={{ zIndex } as CSSProperties}
      className={className}
    >
      {mapSurface}

      {!isReady ? (
        <Box
          pos="absolute"
          inset={0}
          style={{
            zIndex: 20,
            backgroundColor,
          }}
        >
          {loadingSurface}
        </Box>
      ) : null}

      <div
        className="mgl-attribution"
        style={{
          color: attributionColor,
          fontSize: attributionFontSize,
        }}
      >
        {attributionItems.map((item, index) => (
          <span key={item.href}>
            {index > 0 ? ' · ' : null}
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {item.label}
            </a>
          </span>
        ))}
      </div>

      {directions ? (
        <>
          <Box
            pos="absolute"
            inset={0}
            bg="rgba(0,0,0,0.5)"
            className="mgl-directions-modal__backdrop"
            style={{ zIndex: backdropZIndex }}
            onClick={onCloseDirections}
          />
          <Paper
            shadow="xl"
            radius={0}
            p="md"
            pos="absolute"
            className="mgl-directions-modal"
            style={{ zIndex: modalZIndex }}
          >
            <Text size="sm" fw={600} mb="sm">
              {directions.title}
            </Text>
            {directions.options.map((option) => (
              <TextButton
                key={option.id}
                size="xs"
                weight="medium"
                display="flex"
                fullWidth
                onClick={() => onSelectProvider(option.id)}
                className="mgl-directions-modal__option"
              >
                <span className="mgl-directions-modal__icon" aria-hidden="true">
                  {option.icon === 'google' ? <GoogleMapsIcon /> : <NaverMapsIcon />}
                </span>
                <span>{option.label}</span>
              </TextButton>
            ))}
          </Paper>
        </>
      ) : null}

      {printImageUrl ? <img src={printImageUrl} alt={printPreviewAlt} className="mgl-print-image" /> : null}
    </Box>
  );
}
