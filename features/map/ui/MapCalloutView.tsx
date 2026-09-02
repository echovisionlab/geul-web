'use client';

import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react';

export interface MapCalloutViewModel {
  id: string;
  href?: string;
  ariaLabel: string;
  primaryText: string;
  secondaryLines: string[];
}

export interface MapCalloutColors {
  lineColor: string;
  hoverLineColor: string;
  textColor: string;
  hoverTextColor: string;
  descriptionColor: string;
  hoverDescriptionColor: string;
  backgroundColor: string;
  hoverBackgroundColor: string;
}

export interface MapCalloutLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface MapCalloutViewProps {
  callout: MapCalloutViewModel;
  direction: 'left' | 'right';
  stackOffsetY: number;
  colors: MapCalloutColors;
  layout: MapCalloutLayout;
  containerWidth: number;
  clickable: boolean;
  onClick: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

const BASE_DIAGONAL = 93;
const BASE_LINE_LENGTH = 150;

function createCalloutHtml({
  callout,
  direction,
  colors,
  layout,
  containerWidth,
  stackOffsetY,
}: Pick<
  MapCalloutViewProps,
  'callout' | 'direction' | 'colors' | 'layout' | 'containerWidth' | 'stackOffsetY'
>): string {
  const screenScale = containerWidth / 1920;
  const totalScale = screenScale * layout.scale;
  const diagonalLength = BASE_DIAGONAL * totalScale;
  const lineLength = BASE_LINE_LENGTH * totalScale;
  const diagonalOffset = Math.round(diagonalLength * Math.SQRT1_2);
  const horizontalLength = Math.round(lineLength);
  const path =
    direction === 'right'
      ? `M 0 0 L ${diagonalOffset} ${-diagonalOffset} L ${diagonalOffset + horizontalLength} ${-diagonalOffset}`
      : `M 0 0 L ${-diagonalOffset} ${-diagonalOffset} L ${-diagonalOffset - horizontalLength} ${-diagonalOffset}`;
  const svgWidth = (diagonalOffset + horizontalLength + 10) * 2;
  const viewBox = `-${svgWidth / 2} -${diagonalOffset + 10} ${svgWidth} ${diagonalOffset + 15}`;
  const cardOffsetX = diagonalOffset + horizontalLength + layout.offsetX;
  const cardOffsetY = diagonalOffset + layout.offsetY + stackOffsetY;
  const secondaryHtml = callout.secondaryLines.map((text) => `<div class="mgl-callout__line">${text}</div>`).join('');
  const hrefAttr = callout.href ? ` href="${callout.href}"` : '';
  const interactiveAttrs = callout.href ? '' : ' role="button" tabindex="0"';
  const labelAttr = ` aria-label="${callout.ariaLabel.replace(/"/g, '&quot;')}"`;

  return `
    <a class="mgl-callout mgl-callout--${direction}" data-place-id="${callout.id}"${hrefAttr}${interactiveAttrs}${labelAttr} style="--callout-line-color: ${colors.lineColor}; --callout-hover-line-color: ${colors.hoverLineColor}; --callout-text-color: ${colors.textColor}; --callout-hover-text-color: ${colors.hoverTextColor}; --callout-desc-color: ${colors.descriptionColor}; --callout-hover-desc-color: ${colors.hoverDescriptionColor}; --callout-bg-color: ${colors.backgroundColor}; --callout-hover-bg-color: ${colors.hoverBackgroundColor}; --callout-offset-x: ${cardOffsetX}px; --callout-offset-y: ${cardOffsetY}px; --callout-line-length: ${horizontalLength}px;">
      <div class="mgl-callout__pin"></div>
      <svg class="mgl-callout__lines" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" style="width: ${svgWidth}px; height: ${diagonalOffset + 15}px; transform: translate(-${svgWidth / 2}px, -${diagonalOffset + 10}px);">
        <path class="mgl-callout__path" d="${path}" stroke="var(--callout-line-color)" stroke-width="1.5" fill="none"/>
      </svg>
      <div class="mgl-callout__card">
        <div class="mgl-callout__name">${callout.primaryText}</div>
        ${secondaryHtml}
      </div>
    </a>
  `;
}

export function MapCalloutView({
  callout,
  direction,
  stackOffsetY,
  colors,
  layout,
  containerWidth,
  clickable,
  onClick,
  onHoverChange,
}: MapCalloutViewProps) {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      if (!clickable) {
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest('.mgl-callout')) {
        event.stopPropagation();
        if (!callout.href) {
          event.preventDefault();
        }
        onClickRef.current();
      }
    },
    [callout.href, clickable],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!clickable || (event.key !== 'Enter' && event.key !== ' ')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClickRef.current();
    },
    [clickable],
  );

  const html = useMemo(
    () =>
      createCalloutHtml({
        callout,
        direction,
        colors,
        layout,
        containerWidth,
        stackOffsetY,
      }),
    [callout, colors, containerWidth, direction, layout, stackOffsetY],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onPointerDown={handlePointerDown}
      onPointerEnter={() => onHoverChange?.(true)}
      onPointerLeave={() => onHoverChange?.(false)}
      onKeyDown={handleKeyDown}
      onFocus={() => onHoverChange?.(true)}
      onBlur={() => onHoverChange?.(false)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
