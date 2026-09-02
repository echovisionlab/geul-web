// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PlaceEditor } from './PlaceEditor';

const authoringHeaderSpy = vi.hoisted(() => vi.fn());

vi.mock('@/features/authoring/EditorHeader', () => ({
  EditorHeader: (props: unknown) => {
    authoringHeaderSpy(props);
    return <div data-testid="default-place-header" />;
  },
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: () => null,
}));

vi.mock('@/features/map/MapProvider', () => ({
  MapProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/map/BaseMap', () => ({
  BaseMap: ({ children }: { children: ReactNode }) => <div data-testid="base-map">{children}</div>,
}));

vi.mock('@/features/map/Marker', () => ({
  Marker: () => <div data-testid="marker" />,
}));

vi.mock('./PlacesAutocomplete', () => ({
  PlacesAutocomplete: () => <div data-testid="places-autocomplete" />,
}));

vi.mock('./PlaceDetailForm', () => ({
  PlaceDetailForm: () => <div data-testid="place-detail-form" />,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }),
});

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
  authoringHeaderSpy.mockReset();
});

describe('PlaceEditor', () => {
  it('uses the canonical translated authoring header', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders locale="en">
          <PlaceEditor
            initialData={{
              name: 'Default header place',
              address: 'Seoul',
              lat: 37.5665,
              lng: 126.978,
              googlePlaceId: null,
              addressComponents: null,
            }}
            onSubmit={vi.fn()}
            onBack={vi.fn()}
          />
        </TestProviders>,
      );
    });

    expect(document.querySelector('[data-testid="default-place-header"]')).not.toBeNull();
    expect(authoringHeaderSpy).toHaveBeenCalled();
    expect(authoringHeaderSpy.mock.calls.at(-1)?.[0]).toMatchObject({
      title: 'Default header place',
      isConnected: true,
      isSynced: true,
      hideConnectionStatus: true,
      hideStatus: true,
    });
  });
});
