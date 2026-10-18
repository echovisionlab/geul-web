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
  it('keeps inert callouts readable without exposing a dead button or tab stop', () => {
    act(() => root.render(<MapCalloutView {...baseProps} clickable={false} />));
    const callout = host.querySelector<HTMLElement>('.mgl-callout')!;
    expect(callout.hasAttribute('role')).toBe(false);
    expect(callout.hasAttribute('tabindex')).toBe(false);
    expect(callout.hasAttribute('aria-label')).toBe(false);
    expect(callout.textContent).toContain('Studio');
    expect(callout.textContent).toContain('Seoul');
    expect(callout.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    act(() => callout.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(baseProps.onClick).not.toHaveBeenCalled();
  });

  it('describes secondary place fields separately from the command name and supports button keys', () => {
    act(() => root.render(<MapCalloutView {...baseProps} />));
    const callout = host.querySelector<HTMLElement>('.mgl-callout')!;
    const described = callout
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toEqual(['Seoul', '37.500000 / 127.100000']);
    expect(callout.getAttribute('aria-label')).toBe('Studio');
    act(() => callout.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(baseProps.onClick).toHaveBeenCalledOnce();
  });

  it('preserves native link identity and does not treat Space as link activation', () => {
    act(() => root.render(<MapCalloutView {...baseProps} callout={{ ...baseProps.callout, href: '/works/studio' }} />));
    const callout = host.querySelector<HTMLElement>('.mgl-callout')!;
    expect(callout.getAttribute('href')).toBe('/works/studio');
    expect(callout.hasAttribute('role')).toBe(false);
    act(() => callout.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(baseProps.onClick).not.toHaveBeenCalled();
    act(() => callout.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(baseProps.onClick).toHaveBeenCalledOnce();
  });
});
