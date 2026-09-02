// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapCalloutView, type MapCalloutViewProps } from './MapCalloutView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseProps: MapCalloutViewProps = {
  callout: {
    id: 'studio',
    ariaLabel: 'Studio',
    primaryText: 'Studio',
    secondaryLines: ['Seoul', '37.500000 / 127.100000'],
  },
  direction: 'right',
  stackOffsetY: 0,
  colors: {
    lineColor: '#2563eb',
    hoverLineColor: '#1d4ed8',
    textColor: '#111827',
    hoverTextColor: '#000000',
    descriptionColor: '#4b5563',
    hoverDescriptionColor: '#111827',
    backgroundColor: '#ffffff',
    hoverBackgroundColor: '#f8fafc',
  },
  layout: { scale: 1, offsetX: 2, offsetY: 4 },
  containerWidth: 960,
  clickable: true,
  onClick: vi.fn(),
  onHoverChange: vi.fn(),
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('MapCalloutView', () => {
  it('renders its serializable view model and emits pointer intent', () => {
    act(() => root.render(<MapCalloutView {...baseProps} />));

    const callout = host.querySelector<HTMLElement>('.mgl-callout');
    expect(callout?.dataset.placeId).toBe('studio');
    expect(callout?.getAttribute('aria-label')).toBe('Studio');
    expect(host.textContent).toContain('37.500000 / 127.100000');

    act(() => callout?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(baseProps.onClick).toHaveBeenCalledOnce();
  });
});
