// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { CreatePlaceModal } from './CreatePlaceModal';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => null,
}));

vi.mock('@/features/map/MapProvider', () => ({
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/map/BaseMap', () => ({
  BaseMap: ({ children }: { children?: ReactNode }) => <div data-testid="base-map">{children}</div>,
}));

vi.mock('@/features/map/Marker', () => ({
  Marker: () => <div data-testid="marker" />,
}));

vi.mock('@/features/place/PlacesAutocomplete', () => ({
  PlacesAutocomplete: ({
    onPlaceSelect,
  }: {
    onPlaceSelect: (result: {
      name: string;
      address: string;
      coordinate: { lat: number; lng: number };
      placeId: string;
      addressComponents: null;
    }) => void;
  }) => (
    <button
      type="button"
      data-testid="places-autocomplete"
      onClick={() =>
        onPlaceSelect({
          name: 'Google Place',
          address: 'Google Address',
          coordinate: { lat: 37.5, lng: 127 },
          placeId: 'google-place-1',
          addressComponents: null,
        })
      }
    >
      Pick place
    </button>
  ),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CreatePlaceModal', () => {
  it('updates the address input without reading from a cleared change event', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <CreatePlaceModal opened onClose={vi.fn()} onSubmit={vi.fn()} />
        </TestProviders>,
      );
    });

    const addressInput = document.querySelector('input[placeholder="Full address"]') as HTMLInputElement | null;

    expect(addressInput).not.toBeNull();

    act(() => {
      setInputValue(addressInput!, 'Seoul, South Korea');
    });

    expect(addressInput?.value).toBe('Seoul, South Korea');
  });

  it('clears a selected Google place ID when coordinates are edited manually', () => {
    const onSubmit = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders>
          <CreatePlaceModal opened onClose={vi.fn()} onSubmit={onSubmit} />
        </TestProviders>,
      );
    });

    const pickPlaceButton = document.querySelector('[data-testid="places-autocomplete"]') as HTMLButtonElement | null;

    expect(pickPlaceButton).not.toBeNull();

    act(() => {
      pickPlaceButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const latitudeInput = Array.from(document.querySelectorAll('input')).find((input) => input.value === '37.5') as
      HTMLInputElement | undefined;

    expect(latitudeInput).toBeDefined();

    act(() => {
      setInputValue(latitudeInput!, '37.6');
    });

    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Create & Add'),
    ) as HTMLButtonElement | undefined;

    expect(submitButton).toBeDefined();

    act(() => {
      submitButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 37.6,
        lng: 127,
        googlePlaceId: null,
      }),
    );
  });
});
