import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMapThemeClient, createPublicMapThemeClient } from '@/lib/api/server-client';
import type { ThemeSettings } from '@/lib/types/map-theme/model';
import { createMapThemeAction, listMapThemesAction, resolvePublicMapThemesByIdsAction } from './map-theme';

const listMapThemesMock = vi.fn();
const createMapThemeMock = vi.fn();
const resolveByIdsMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  createMapThemeClient: vi.fn(),
  createPublicMapThemeClient: vi.fn(),
}));

const settings: ThemeSettings = {
  calloutScale: 1,
  calloutOffsetX: 0,
  calloutOffsetY: 0,
  calloutFields: ['name', 'address'],
  attributionFontSize: 11,
  showAreaLabels: true,
  showPoiLabels: false,
};

function variant(id: string) {
  return {
    id,
    backgroundColor: '#ffffff',
    waterColor: '#0000ff',
    landColor: '#eeeeee',
    roadColor: '#cccccc',
    buildingFillColor: '#dddddd',
    buildingStrokeEnabled: false,
    buildingStrokeColor: '#bbbbbb',
    calloutLineColor: '#111111',
    calloutHoverLineColor: '#222222',
    calloutTextColor: '#111111',
    calloutHoverTextColor: '#222222',
    calloutDescriptionColor: '#333333',
    calloutHoverDescriptionColor: '#444444',
    calloutBackgroundColor: '#ffffff',
    calloutHoverBackgroundColor: '#eeeeee',
    attributionColor: '#111111',
    labelTextColor: '#111111',
    clusterColor: '#555555',
    clusterHoverColor: '#666666',
    clusterTextColor: '#ffffff',
    clusterTextHoverColor: '#ffffff',
  };
}

function theme(id: string) {
  return {
    id,
    name: `Theme ${id}`,
    settings,
    lightVariant: variant(`${id}-light`),
    darkVariant: variant(`${id}-dark`),
  };
}

beforeEach(() => {
  listMapThemesMock.mockReset();
  createMapThemeMock.mockReset();
  resolveByIdsMock.mockReset();
  vi.mocked(createMapThemeClient).mockResolvedValue({
    listMapThemes: listMapThemesMock,
    createMapTheme: createMapThemeMock,
  } as never);
  vi.mocked(createPublicMapThemeClient).mockReturnValue({ resolveByIds: resolveByIdsMock } as never);
});

describe('map theme actions', () => {
  it('returns required variant pairs and the dedicated default ID', async () => {
    listMapThemesMock.mockResolvedValue({
      themes: [theme('theme-default')],
      defaultMapThemeId: 'theme-default',
    });

    await expect(listMapThemesAction()).resolves.toMatchObject({
      defaultMapThemeId: 'theme-default',
      themes: [
        {
          id: 'theme-default',
          lightVariant: { id: 'theme-default-light', scheme: 'light' },
          darkVariant: { id: 'theme-default-dark', scheme: 'dark' },
        },
      ],
    });
  });

  it('preserves requested IDs while returning the actual fallback Theme', async () => {
    resolveByIdsMock.mockResolvedValue({
      results: [{ requestedThemeId: 'theme-deleted', theme: theme('theme-default') }],
    });

    await expect(resolvePublicMapThemesByIdsAction(['theme-deleted'])).resolves.toMatchObject([
      {
        requestedThemeId: 'theme-deleted',
        theme: { id: 'theme-default' },
      },
    ]);
    expect(resolveByIdsMock).toHaveBeenCalledWith({ requestedThemeIds: ['theme-deleted'] });
  });

  it('ignores protobuf runtime metadata in public Map Theme responses', async () => {
    const publicTheme = theme('theme-public');
    resolveByIdsMock.mockResolvedValue({
      results: [
        {
          $typeName: 'api.open.v1.ResolveMapThemesByIdsResult',
          requestedThemeId: 'theme-public',
          theme: {
            ...publicTheme,
            $typeName: 'api.open.v1.MapTheme',
            settings: { ...publicTheme.settings, $typeName: 'api.open.v1.MapThemeSettings' },
            lightVariant: { ...publicTheme.lightVariant, $typeName: 'api.open.v1.MapThemeVariant' },
            darkVariant: { ...publicTheme.darkVariant, $typeName: 'api.open.v1.MapThemeVariant' },
          },
        },
      ],
    });

    await expect(resolvePublicMapThemesByIdsAction(['theme-public'])).resolves.toMatchObject([
      {
        requestedThemeId: 'theme-public',
        theme: { id: 'theme-public' },
      },
    ]);
  });

  it('fails explicitly when a required variant is absent', async () => {
    listMapThemesMock.mockResolvedValue({
      themes: [{ ...theme('broken'), darkVariant: undefined }],
      defaultMapThemeId: 'broken',
    });

    await expect(listMapThemesAction()).rejects.toThrow('missing its dark variant');
  });

  it('creates light and dark variants in one request', async () => {
    createMapThemeMock.mockResolvedValue({ id: 'theme-new' });
    const lightVariant = { ...variant('ignored'), scheme: 'light' as const };
    const darkVariant = { ...variant('ignored'), scheme: 'dark' as const };
    const { id: _lightId, ...lightInput } = lightVariant;
    const { id: _darkId, ...darkInput } = darkVariant;

    await expect(
      createMapThemeAction({
        name: '  New Theme  ',
        settings,
        lightVariant: lightInput,
        darkVariant: darkInput,
      }),
    ).resolves.toEqual({ data: { id: 'theme-new' } });

    expect(createMapThemeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Theme',
        lightVariant: expect.objectContaining({ backgroundColor: '#ffffff' }),
        darkVariant: expect.objectContaining({ backgroundColor: '#ffffff' }),
      }),
    );
  });

  it('rejects an unsafe color before calling the API', async () => {
    const lightVariant = { ...variant('ignored'), scheme: 'light' as const };
    const darkVariant = { ...variant('ignored'), scheme: 'dark' as const };
    const { id: _lightId, ...lightInput } = lightVariant;
    const { id: _darkId, ...darkInput } = darkVariant;

    const result = await createMapThemeAction({
      name: 'Unsafe Theme',
      settings,
      lightVariant: { ...lightInput, backgroundColor: 'url(javascript:alert(1))' },
      darkVariant: darkInput,
    });

    expect(result.error).toBeTruthy();
    expect(createMapThemeMock).not.toHaveBeenCalled();
  });
});
