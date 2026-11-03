// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { CreatePlaceModal } from './CreatePlaceModal';

const googleApi = vi.hoisted(() => ({ geocode: vi.fn(), fetchFields: vi.fn() }));
const geocoding = {
  Geocoder: class {
    geocode = googleApi.geocode;
  },
};
const places = {
  Place: class {
    displayName = 'Google Place';
    formattedAddress = 'Google Address';
    fetchFields = googleApi.fetchFields;
  },
};
vi.mock('@vis.gl/react-google-maps', () => ({
  useMapsLibrary: (name: string) => (name === 'geocoding' ? geocoding : places),
}));
vi.mock('@/features/map/MapProvider', () => ({ MapProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/map/BaseMap', () => ({
  BaseMap: ({
    onClick,
    onPoiClick,
  }: {
    onClick: (lat: number, lng: number) => void;
    onPoiClick: (id: string, lat: number, lng: number) => void;
  }) => (
    <div aria-label="Map">
      <button type="button" onClick={() => onClick(1, 1)}>
        Choose first location
      </button>
      <button type="button" onClick={() => onClick(2, 2)}>
        Choose second location
      </button>
      <button type="button" onClick={() => onPoiClick('google-place-1', 37.5, 127)}>
        Pick place
      </button>
    </div>
  ),
}));
vi.mock('@/features/map/Marker', () => ({ Marker: () => null }));

afterEach(() => vi.resetAllMocks());

describe('CreatePlaceModal', () => {
  it('submits manual fields without requesting a map and retains the draft until its owner closes', async () => {
    const onSubmit = vi.fn();
    const { user } = render(<CreatePlaceModal localOnly opened onClose={vi.fn()} onSubmit={onSubmit} />);
    expect(screen.queryByRole('button', { name: 'Pick place' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.paste('Manual place');
    await user.click(screen.getByRole('textbox', { name: 'Address' }));
    await user.paste('Manual address');
    await user.click(screen.getByRole('button', { name: 'Create & Add' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Manual place', address: 'Manual address', googlePlaceId: null }),
    );
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Manual address');
  });

  it('updates the address input without reading a cleared change event', async () => {
    const { user } = render(<CreatePlaceModal localOnly opened onClose={vi.fn()} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('textbox', { name: 'Address' }));
    await user.paste('Seoul, South Korea');
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Seoul, South Korea');
  });

  it('clears a selected Google place ID when coordinates are edited manually', async () => {
    googleApi.fetchFields.mockResolvedValue(undefined);
    const onSubmit = vi.fn();
    const { user } = render(<CreatePlaceModal opened onClose={vi.fn()} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Pick place' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Google Place'));
    const latitude = screen.getByRole('textbox', { name: 'Latitude' });
    await user.clear(latitude);
    await user.type(latitude, '37.6');
    await user.click(screen.getByRole('button', { name: 'Create & Add' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lat: 37.6, lng: 127, googlePlaceId: null }));
  });

  it('ignores an earlier geocode response after a newer location has resolved', async () => {
    let finishFirst!: (result: unknown) => void;
    let finishSecond!: (result: unknown) => void;
    googleApi.geocode
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishSecond = resolve;
        }),
      );
    const { user } = render(<CreatePlaceModal opened onClose={vi.fn()} onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Choose first location' }));
    await user.click(screen.getByRole('button', { name: 'Choose second location' }));
    await act(async () =>
      finishSecond({ results: [{ formatted_address: 'Current address', address_components: [] }] }),
    );
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Current address');
    await act(async () => finishFirst({ results: [{ formatted_address: 'Old address', address_components: [] }] }));
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveValue('Current address');
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('2');
  });
});
