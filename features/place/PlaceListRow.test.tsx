// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { MapPlace } from '@/lib/types/map-place/model';
import { PlaceListRow, isPlaceAtCenter } from './PlaceListRow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const place = { id: 'p1', name: 'Studio', address: '1 Main St', coordinate: { lat: 37.5, lng: 127 } } as MapPlace;
const labels = { centerBadge: 'Center', centered: 'Centered', setAsCenter: 'Set as center', remove: 'Remove' };

it('matches the map center within the shared tolerance', () => {
  expect(isPlaceAtCenter(place, { lat: 37.50005, lng: 127.00005 })).toBe(true);
  expect(isPlaceAtCenter(place, { lat: 37.501, lng: 127 })).toBe(false);
});

it('names the center/remove commands, shows the center state and forwards both commands', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onCenter = vi.fn();
  const onRemove = vi.fn();
  const render = (isCenter: boolean) =>
    act(() =>
      root.render(
        <TestProviders>
          <PlaceListRow place={place} isCenter={isCenter} labels={labels} onCenter={onCenter} onRemove={onRemove} />
        </TestProviders>,
      ),
    );
  render(false);
  expect(host.textContent).toContain('Studio');
  expect(host.textContent).toContain('1 Main St');
  expect(host.textContent).not.toContain('Center');
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Set as center"]')?.click());
  expect(onCenter).toHaveBeenCalledWith(place);
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Remove"]')?.click());
  expect(onRemove).toHaveBeenCalledWith('p1');
  render(true);
  expect(host.textContent).toContain('Center');
  expect(host.querySelector('button[aria-label="Centered"]')?.getAttribute('aria-pressed')).toBe('true');
  act(() => root.unmount());
  host.remove();
});
