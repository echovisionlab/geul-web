import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicMapPlacesByIdsAction } from '@/lib/actions/map-place';
import type { PageContent } from '@/lib/types/page-content';
import { localizePageMapContent } from './page-map-localization';

vi.mock('@/lib/actions/map-place', () => ({
  getPublicMapPlacesByIdsAction: vi.fn(),
}));

const mockedGetPublicMapPlacesByIdsAction = vi.mocked(getPublicMapPlacesByIdsAction);

describe('localizePageMapContent', () => {
  beforeEach(() => {
    mockedGetPublicMapPlacesByIdsAction.mockReset();
  });

  it('replaces top-level map section places with localized data', async () => {
    mockedGetPublicMapPlacesByIdsAction.mockResolvedValue([
      {
        id: 'place-1',
        name: '리마 아르마스 광장',
        address: '리마, 페루',
        lat: 1,
        lng: 2,
        googlePlaceId: null,
        addressComponents: null,
        imageUrl: null,
      },
    ]);

    const content: PageContent = {
      sections: [
        {
          id: 'section-1',
          type: 'map',
          settings: {},
          props: {
            mapPlaceIds: 'place-1',
            mapViewConfig: {
              center: { lat: 1, lng: 2 },
              zoom: 10,
              places: [
                {
                  id: 'place-1',
                  name: 'Plaza de Armas de Lima',
                  address: 'Lima, Peru',
                  lat: 1,
                  lng: 2,
                },
              ],
            },
          },
        },
      ],
    };

    const result = await localizePageMapContent(content, 'ko');

    expect(mockedGetPublicMapPlacesByIdsAction).toHaveBeenCalledWith(['place-1'], 'ko');
    expect(result?.sections[0].props?.mapViewConfig).toMatchObject({
      places: [{ id: 'place-1', name: '리마 아르마스 광장', address: '리마, 페루' }],
    });
  });

  it('replaces nested columns map section places with localized data', async () => {
    mockedGetPublicMapPlacesByIdsAction.mockResolvedValue([
      {
        id: 'place-2',
        name: '현지화된 장소',
        address: '현지화된 주소',
        lat: 3,
        lng: 4,
        googlePlaceId: null,
        addressComponents: null,
        imageUrl: null,
      },
    ]);

    const content: PageContent = {
      sections: [
        {
          id: 'columns-1',
          type: 'columns',
          settings: {},
          props: {},
          columns: [
            {
              id: 'column-1',
              sections: [
                {
                  id: 'map-1',
                  type: 'map',
                  settings: {},
                  props: {
                    mapPlaceIds: 'place-2',
                    mapViewConfig: {
                      center: { lat: 3, lng: 4 },
                      zoom: 10,
                      places: [
                        {
                          id: 'place-2',
                          name: 'Source Name',
                          address: 'Source Address',
                          lat: 3,
                          lng: 4,
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await localizePageMapContent(content, 'ko');
    const nestedMap = result?.sections[0].columns?.[0].sections[0];

    expect(nestedMap?.props?.mapViewConfig).toMatchObject({
      places: [{ id: 'place-2', name: '현지화된 장소', address: '현지화된 주소' }],
    });
  });

  it('returns original content when requested locale is not set', async () => {
    const content: PageContent = {
      sections: [
        {
          id: 'section-1',
          type: 'map',
          settings: {},
          props: {
            mapPlaceIds: 'place-1',
            mapViewConfig: { places: [] },
          },
        },
      ],
    };

    const result = await localizePageMapContent(content, null);

    expect(result).toBe(content);
    expect(mockedGetPublicMapPlacesByIdsAction).not.toHaveBeenCalled();
  });
});
