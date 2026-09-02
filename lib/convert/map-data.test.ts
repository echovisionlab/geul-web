import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { injectMapData } from './map-data';

const getPlacesByIdsMock = vi.fn();
const resolveThemesByIdsMock = vi.fn();

vi.mock('@/lib/actions/map-place', () => ({
  getPublicMapPlacesByIdsAction: (...args: unknown[]) => getPlacesByIdsMock(...args),
}));

vi.mock('@/lib/actions/map-theme', () => ({
  resolvePublicMapThemesByIdsAction: (...args: unknown[]) => resolveThemesByIdsMock(...args),
}));

beforeEach(() => {
  getPlacesByIdsMock.mockResolvedValue([
    {
      id: 'place-1',
      name: 'Polarfront Lab',
      address: 'Seoul',
      lat: 37.5,
      lng: 127,
    },
  ]);
  resolveThemesByIdsMock.mockResolvedValue([
    {
      requestedThemeId: 'theme-deleted',
      theme: {
        id: 'theme-default',
        name: 'Current Default',
        settings: DEFAULT_THEME_SETTINGS,
        lightVariant: { id: 'default-light', ...DEFAULT_LIGHT_VARIANT },
        darkVariant: { id: 'default-dark', ...DEFAULT_DARK_VARIANT },
      },
    },
  ]);
});

describe('map data hydration', () => {
  it('looks up by the stored requested ID and renders the actual resolved Theme', async () => {
    const html = await injectMapData(
      '<div class="map-block" data-map-place-ids="place-1" data-theme-id="theme-deleted"></div>',
    );
    const document = new JSDOM(html).window.document;
    const serialized = document.querySelector('.map-block')?.getAttribute('data-map-view-config');
    const config = JSON.parse(serialized ?? '{}');

    expect(resolveThemesByIdsMock).toHaveBeenCalledWith(['theme-deleted']);
    expect(config.theme.id).toBe('theme-default');
    expect(config.theme.lightVariant.backgroundColor).toBe(DEFAULT_LIGHT_VARIANT.backgroundColor);
    expect(config.theme.darkVariant.backgroundColor).toBe(DEFAULT_DARK_VARIANT.backgroundColor);
  });

  it('does not normalize a whitespace-wrapped Theme ID before batch resolution', async () => {
    resolveThemesByIdsMock.mockRejectedValueOnce(new Error('invalid Theme ID'));

    await expect(
      injectMapData('<div class="map-block" data-map-place-ids="place-1" data-theme-id=" theme-deleted "></div>'),
    ).rejects.toThrow('invalid Theme ID');

    expect(resolveThemesByIdsMock).toHaveBeenCalledWith([' theme-deleted ']);
  });
});
