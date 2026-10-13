// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapNavigation, type MapNavigationProps } from './MapNavigation';
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
});
const labels = { group: 'Map', zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetNorth: 'North' };
describe('MapNavigation commands', () => {
  it('owns accessible native controls and forwards the original event', () => {
    const zoom = vi.fn();
    const north = vi.fn();
    act(() =>
      root.render(
        <MapNavigation
          labels={labels}
          onZoomIn={zoom}
          onZoomOut={() => {}}
          onResetNorth={north}
          position="bottom-left"
        />,
      ),
    );
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!;
    act(() => button.click());
    expect(zoom).toHaveBeenCalledOnce();
    expect(zoom.mock.calls[0][0].nativeEvent).toBeInstanceOf(MouseEvent);
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label="North"]')!.click());
    expect(north).toHaveBeenCalledOnce();
    expect(host.querySelector('[role=group]')?.getAttribute('aria-label')).toBe('Map');
  });
  it('blocks a zoom command at its domain bound and removes styling bypass props', () => {
    const zoom = vi.fn();
    const props = {
      labels,
      onZoomIn: zoom,
      onZoomOut: () => {},
      onResetNorth: () => {},
      zoomInDisabled: true,
      style: { color: 'red' },
      className: 'foreign',
    } as unknown as MapNavigationProps;
    act(() => root.render(<MapNavigation {...props} />));
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!;
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(zoom).not.toHaveBeenCalled();
    const navigation = host.querySelector('[role=group]') as HTMLElement;
    expect(navigation.style.cssText).toBe('');
    expect(navigation.className).not.toContain('foreign');
  });
});
