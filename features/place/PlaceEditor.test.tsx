// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { PlaceEditorFormState } from '@/lib/types/map-place/model';
import { PlaceEditor } from './PlaceEditor';

const authoringHeaderSpy = vi.hoisted(() => vi.fn());
const placeDetailFormSpy = vi.hoisted(() => vi.fn());

vi.mock('@/features/authoring/EditorHeader', () => ({
  EditorHeader: (props: {
    title?: string;
    isConnected?: boolean;
    isSynced?: boolean;
    hideConnectionStatus?: boolean;
    hideStatus?: boolean;
    actionItems?: Array<{
      key: string;
      label: string;
      disabled?: boolean;
      onClick?: () => void;
    }>;
  }) => {
    authoringHeaderSpy(props);
    return (
      <div data-testid="default-place-header">
        {props.actionItems?.map((item) => (
          <button
            key={item.key}
            type="button"
            data-testid={`header-action-${item.key}`}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
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
  PlaceDetailForm: ({
    formState,
    onFormChange,
  }: {
    formState: {
      name: string;
      address: string;
      lat: number;
      lng: number;
      googlePlaceId: string | null;
      addressComponents: {
        street?: string;
        city?: string;
        region?: string;
        country?: string;
        postalCode?: string;
      } | null;
    };
    onFormChange: (state: typeof formState) => void;
  }) => {
    placeDetailFormSpy(formState);
    return (
      <div data-testid="place-detail-form">
        <button
          type="button"
          data-testid="change-name"
          onClick={() => onFormChange({ ...formState, name: 'Updated name' })}
        >
          Change name
        </button>
        <button
          type="button"
          data-testid="change-address"
          onClick={() => onFormChange({ ...formState, address: 'Updated address' })}
        >
          Change address
        </button>
        <button type="button" data-testid="set-latitude-zero" onClick={() => onFormChange({ ...formState, lat: 0 })}>
          Set latitude to zero
        </button>
        <button
          type="button"
          data-testid="clear-address-components"
          onClick={() => onFormChange({ ...formState, addressComponents: null })}
        >
          Clear address components
        </button>
      </div>
    );
  },
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
  placeDetailFormSpy.mockReset();
});

describe('PlaceEditor', () => {
  const initialData = {
    name: 'Default header place',
    address: 'Seoul',
    lat: 37.5665,
    lng: 126.978,
    googlePlaceId: 'google-place-1',
    addressComponents: { city: 'Seoul', country: 'Korea' },
  };

  function renderPlaceEditor(
    onSubmit: (updates: Partial<PlaceEditorFormState>) => Promise<boolean>,
    data = initialData,
    identity = 'place-1',
  ) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders locale="en">
          <PlaceEditor key={identity} initialData={data} onSubmit={onSubmit} onBack={vi.fn()} />
        </TestProviders>,
      );
    });
  }

  function click(testId: string) {
    act(() => {
      container?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
    });
  }

  it('uses the canonical translated authoring header', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <TestProviders locale="en">
          <PlaceEditor
            initialData={{ ...initialData, googlePlaceId: null, addressComponents: null }}
            onSubmit={vi.fn().mockResolvedValue(true)}
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

  it('submits only fields changed from the initial baseline', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderPlaceEditor(onSubmit);

    click('change-name');
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Updated name' });
  });

  it('includes zero coordinates and an explicit address-component clear in the patch', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderPlaceEditor(onSubmit);

    click('set-latitude-zero');
    click('clear-address-components');
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenCalledWith({ lat: 0, addressComponents: null });
  });

  it('keeps input entered during a save and advances the baseline only to submitted values', async () => {
    let finishSave: ((success: boolean) => void) | undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve;
        }),
    );
    renderPlaceEditor(onSubmit);

    click('change-name');
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenNthCalledWith(1, { name: 'Updated name' });

    click('change-address');
    await act(async () => {
      finishSave?.(true);
      await Promise.resolve();
    });
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });

    expect(onSubmit).toHaveBeenNthCalledWith(2, { address: 'Updated address' });
  });

  it('ignores a late same-place query result after the draft has changed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderPlaceEditor(onSubmit);
    click('change-name');

    act(() => {
      root?.render(
        <TestProviders locale="en">
          <PlaceEditor
            key="place-1"
            initialData={{ ...initialData, name: 'New server name', address: 'New server address' }}
            onSubmit={onSubmit}
            onBack={vi.fn()}
          />
        </TestProviders>,
      );
    });
    expect(placeDetailFormSpy.mock.calls.at(-1)?.[0].name).toBe('Updated name');

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Updated name' });
  });

  it('resets the draft and baseline when the place identity changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderPlaceEditor(onSubmit);
    click('change-name');

    const nextPlace = { ...initialData, name: 'Second place', address: 'Busan' };
    act(() => {
      root?.render(
        <TestProviders locale="en">
          <PlaceEditor key="place-2" initialData={nextPlace} onSubmit={onSubmit} onBack={vi.fn()} />
        </TestProviders>,
      );
    });
    expect(placeDetailFormSpy.mock.calls.at(-1)?.[0].name).toBe('Second place');

    click('change-name');
    await act(async () => {
      container?.querySelector<HTMLButtonElement>('[data-testid="header-action-save"]')?.click();
      await Promise.resolve();
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Updated name' });
  });
});
