import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicMapPlacesByIdsAction } from '@/lib/actions/map-place';
import { resolvePublicMapThemesByIdsAction } from '@/lib/actions/map-theme';
import type { Block, PageContent } from '@/lib/types/page-content';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import {
  hydrateBlocksWithFreshMediaUrls,
  hydratePostBlockMediaContent,
  hydratePageContentWithFreshMediaUrls,
} from './media-content-hydration';

vi.mock('@/lib/actions/map-place', () => ({
  getPublicMapPlacesByIdsAction: vi.fn(),
}));
vi.mock('@/lib/actions/map-theme', () => ({
  resolvePublicMapThemesByIdsAction: vi.fn(),
}));

const mockedGetPublicMapPlacesByIdsAction = vi.mocked(getPublicMapPlacesByIdsAction);
const mockedResolvePublicMapThemesByIdsAction = vi.mocked(resolvePublicMapThemesByIdsAction);

describe('media-content-hydration', () => {
  beforeEach(() => {
    mockedGetPublicMapPlacesByIdsAction.mockReset();
    mockedResolvePublicMapThemesByIdsAction.mockReset();
    mockedGetPublicMapPlacesByIdsAction.mockResolvedValue([]);
    mockedResolvePublicMapThemesByIdsAction.mockResolvedValue([]);
  });

  it('materializes a public map viewport without requiring place references', () => {
    const [map] = hydrateBlocksWithFreshMediaUrls(
      [
        {
          id: 'map-without-places',
          type: 'map',
          props: {
            mapPlaceIds: '',
            centerLat: '35.6812',
            centerLng: '139.7671',
            zoom: '12',
          },
        },
      ],
      {},
    );

    expect(map?.props.mapViewConfig).toMatchObject({
      center: { lat: 35.6812, lng: 139.7671 },
      zoom: 12,
      places: [],
      theme: null,
    });
  });

  it('hydrates the single file block by canonical MIME without changing its durable type', () => {
    const blocks: Block[] = [
      { id: 'image', type: 'file', props: { fileId: 'image-file', name: '' } },
      { id: 'audio', type: 'file', props: { fileId: 'audio-file', name: 'Authored audio title' } },
      { id: 'video', type: 'file', props: { fileId: 'video-file', name: '' } },
      { id: 'document', type: 'file', props: { fileId: 'document-file', name: '' } },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(
      blocks,
      {
        'image-file': mediaDeliveryFixture({
          fileId: 'image-file',
          fileName: 'cover',
          extension: 'webp',
          mimeType: 'image/webp',
          fileSize: BigInt(100),
          thumbnailUrl: 'https://fresh.example/cover.webp',
        }),
        'audio-file': mediaDeliveryFixture({
          fileId: 'audio-file',
          fileName: 'field',
          extension: 'wav',
          mimeType: 'audio/wav',
          fileSize: BigInt(200),
          durationSeconds: 12,
          playbackUrl: 'https://fresh.example/field.m3u8',
        }),
        'video-file': mediaDeliveryFixture({
          fileId: 'video-file',
          fileName: 'walkthrough',
          extension: 'mp4',
          mimeType: 'video/mp4',
          fileSize: BigInt(300),
          playbackUrl: 'https://fresh.example/walkthrough.m3u8',
          thumbnailUrl: 'https://fresh.example/walkthrough.webp',
        }),
        'document-file': mediaDeliveryFixture({
          fileId: 'document-file',
          fileName: 'notes',
          extension: 'pdf',
          mimeType: 'application/pdf',
          fileSize: BigInt(400),
          downloadUrl: 'https://fresh.example/notes.pdf',
        }),
      },
      new Map(),
      new Map(),
      false,
    );

    expect(result.map((block) => block.type)).toEqual(['file', 'file', 'file', 'file']);
    expect(result[0].props).toMatchObject({
      fileName: 'cover.webp',
      name: 'cover',
      mimeType: 'image/webp',
      size: '100',
      url: 'https://fresh.example/cover.webp',
    });
    expect(result[1].props).toMatchObject({
      fileName: 'field.wav',
      name: 'Authored audio title',
      mimeType: 'audio/wav',
      duration: '12',
      hlsUrl: 'https://fresh.example/field.m3u8',
    });
    expect(result[2].props).toMatchObject({
      fileName: 'walkthrough.mp4',
      mimeType: 'video/mp4',
      hlsUrl: 'https://fresh.example/walkthrough.m3u8',
      thumbnailUrl: 'https://fresh.example/walkthrough.webp',
    });
    expect(result[3].props).toMatchObject({
      fileName: 'notes.pdf',
      mimeType: 'application/pdf',
      url: '',
    });
    expect(result[3].props).not.toHaveProperty('downloadUrl');
    expect(result[3].props).not.toHaveProperty('downloadAction');
  });

  it('hydrates audio playback and access state without exposing eager original URLs', () => {
    const blocks: Block[] = [
      {
        id: 'audio-1',
        type: 'file',
        props: {
          fileId: 'file-a',
          url: 'https://stale.example/original.mp3',
          hlsUrl: 'https://stale.example/master.m3u8',
          waveformUrl: 'https://stale.example/waveform.json',
          spectrogramUrl: 'https://stale.example/spectrogram.png',
          duration: '123',
        },
      },
      {
        id: 'audio-2',
        type: 'file',
        props: {
          fileId: 'file-b',
          duration: '45',
        },
      },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(
      blocks,
      {
        'file-a': mediaDeliveryFixture({
          fileId: 'file-a',
          mimeType: 'audio/mpeg',
          downloadUrl: 'https://fresh.example/download-a.mp3',
          playbackUrl: 'https://fresh.example/a/master.m3u8',
          waveformUrl: 'https://fresh.example/a/waveform.json',
          spectrogramUrl: 'https://fresh.example/a/spectrogram.png',
        }),
        'file-b': mediaDeliveryFixture({
          fileId: 'file-b',
          mimeType: 'audio/mpeg',
          downloadUrl: 'https://fresh.example/download-b.mp3',
          playbackUrl: 'https://fresh.example/b/master.m3u8',
          waveformUrl: 'https://fresh.example/b/waveform.json',
          spectrogramUrl: 'https://fresh.example/b/spectrogram.png',
        }),
      },
      new Map(),
      new Map(),
      false,
    )!;

    expect(result[0].props.originalUrl).toBe('');
    expect(result[0].props.url).toBe('');
    expect(result[0].props.hlsUrl).toBe('https://fresh.example/a/master.m3u8');
    expect(result[0].props.waveformUrl).toBe('https://fresh.example/a/waveform.json');
    expect(result[0].props.spectrogramUrl).toBe('https://fresh.example/a/spectrogram.png');
    expect(result[0].props.duration).toBe('123');
    expect(result[0].props).not.toHaveProperty('downloadAvailability');
    expect(result[0].props).not.toHaveProperty('downloadAction');

    expect(result[1].props.originalUrl).toBe('');
    expect(result[1].props.hlsUrl).toBe('https://fresh.example/b/master.m3u8');
    expect(result[1].props.waveformUrl).toBe('https://fresh.example/b/waveform.json');
    expect(result[1].props.duration).toBe('45');
    expect(result[1].props).not.toHaveProperty('downloadAction');
  });

  it('preserves audio, video, and attachment context while omitting an unavailable image', () => {
    const blocks: Block[] = [
      {
        id: 'audio-1',
        type: 'file',
        props: {
          fileId: 'file-a',
          hlsUrl: 'https://stale.example/master.m3u8',
          waveformUrl: 'https://stale.example/waveform.json',
        },
      },
      {
        id: 'video-1',
        type: 'file',
        props: {
          fileId: 'file-v',
          hlsUrl: 'https://stale.example/video/master.m3u8',
        },
      },
      {
        id: 'attachment-1',
        type: 'file',
        props: {
          fileId: 'file-doc',
          url: 'https://stale.example/file.pdf',
        },
      },
      {
        id: 'image-1',
        type: 'file',
        props: {
          fileId: 'file-image',
          url: 'https://stale.example/image.png',
        },
      },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(blocks, {
      'file-a': mediaDeliveryFixture({
        fileId: 'file-a',
        mimeType: 'audio/mpeg',
        playbackUrl: 'https://fresh.example/a/master.m3u8',
        waveformUrl: 'https://fresh.example/a/waveform.json',
      }),
      'file-v': mediaDeliveryFixture({
        fileId: 'file-v',
        mimeType: 'video/mp4',
        thumbnailUrl: 'https://fresh.example/video/thumb.jpg',
      }),
      'file-doc': mediaDeliveryFixture({ fileId: 'file-doc', mimeType: 'application/pdf' }),
      'file-image': mediaDeliveryFixture({ fileId: 'file-image', mimeType: 'image/png' }),
    });

    expect(result.map((block) => block.type)).toEqual(['file', 'file', 'file']);
    expect(result[0].props.hlsUrl).toBe('https://fresh.example/a/master.m3u8');
    expect(result[1].props.hlsUrl).toBe('');
    expect(result[2].props.url).toBe('');
  });

  it('keeps restored media blocks and derives a missing view state when their File delivery is absent', () => {
    const blocks: Block[] = [
      { id: 'image-missing', type: 'file', props: { fileId: 'image-file', url: 'https://stale/image.jpg' } },
      { id: 'video-missing', type: 'file', props: { fileId: 'video-file', hlsUrl: 'https://stale/video.m3u8' } },
      { id: 'audio-missing', type: 'file', props: { fileId: 'audio-file', hlsUrl: 'https://stale/audio.m3u8' } },
      {
        id: 'attachment-missing',
        type: 'file',
        props: { fileId: 'attachment-file', url: 'https://stale/file.pdf', name: 'Restored file' },
      },
      { id: 'legacy-file-missing', type: 'file', props: { fileId: 'legacy-file', url: 'https://stale/file.zip' } },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(blocks, {})!;

    expect(result.map((block) => block.id)).toEqual(blocks.map((block) => block.id));
    for (const block of result) {
      expect(block.props.mediaMissing).toBe(true);
      expect(block.props.url).toBe('');
      expect(block.props.hlsUrl).toBe('');
      expect(block.props).not.toHaveProperty('downloadAvailability');
      expect(block.props).not.toHaveProperty('downloadAction');
      expect(block.props).not.toHaveProperty('downloadUrl');
    }
  });

  it('hydrates nested page content columns recursively', () => {
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
                  id: 'rich-1',
                  type: 'rich-text',
                  settings: {},
                  props: {},
                  content: [
                    {
                      id: 'video-1',
                      type: 'file',
                      props: {
                        fileId: 'file-video',
                        url: 'https://stale.example/video.mp4',
                        duration: '88',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = hydratePageContentWithFreshMediaUrls(content, {
      'file-video': mediaDeliveryFixture({
        fileId: 'file-video',
        mimeType: 'video/mp4',
        playbackUrl: 'https://fresh.example/video/master.m3u8',
        thumbnailUrl: 'https://fresh.example/video/thumb.jpg',
      }),
    })!;

    const nestedBlock = result.sections[0].columns?.[0].sections[0].content?.[0];
    expect(nestedBlock?.props.url).toBe('');
    expect(nestedBlock?.props.hlsUrl).toBe('https://fresh.example/video/master.m3u8');
    expect(nestedBlock?.props.thumbnailUrl).toBe('https://fresh.example/video/thumb.jpg');
    expect(nestedBlock?.props.duration).toBe('88');
  });

  it('hydrates attachment metadata without exposing a fresh download URL', () => {
    const blocks: Block[] = [
      {
        id: 'attachment-1',
        type: 'file',
        props: {
          fileId: 'file-doc',
          url: 'https://stale.example/file.pdf',
          name: 'Field notes',
        },
      },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(blocks, {
      'file-doc': mediaDeliveryFixture({
        fileId: 'file-doc',
        mimeType: 'application/pdf',
        downloadUrl: 'https://fresh.example/file.pdf',
      }),
    })!;

    expect(result[0].props.url).toBe('');
    expect(result[0].props.name).toBe('Field notes');
    expect(result[0].props).not.toHaveProperty('title');
  });

  it('hydrates image blocks with a backend display URL', () => {
    const blocks: Block[] = [
      {
        id: 'image-1',
        type: 'file',
        props: {
          fileId: 'file-image',
          url: 'https://stale.example/image.png',
          alt: 'Field image',
          mediaMissing: true,
        },
      },
    ];

    const result = hydrateBlocksWithFreshMediaUrls(blocks, {
      'file-image': mediaDeliveryFixture({
        fileId: 'file-image',
        mimeType: 'image/png',
        thumbnailUrl: 'https://fresh.example/image.webp',
      }),
    })!;

    expect(result[0].props.url).toBe('https://fresh.example/image.webp');
    expect(result[0].props.alt).toBe('Field image');
    expect(result[0].props.mediaMissing).toBeUndefined();
  });

  it('hydrates immersive scene section assets with fresh public URLs', () => {
    const content: PageContent = {
      sections: [
        {
          id: 'scene-1',
          type: 'immersive-scene',
          settings: {},
          props: {
            unitsJson: JSON.stringify([
              {
                id: 'unit-1',
                meshFileId: 'file-mesh',
                meshUrl: 'https://stale.example/scene.glb',
                meshOptimizationFileId: 'file-mesh-optimized',
                meshOptimizationUrl: 'https://stale.example/scene.draco.glb',
                textureFileId: 'file-texture',
                textureUrl: 'https://stale.example/texture.webp',
                darkTextureFileId: 'file-dark-texture',
                darkTextureUrl: 'https://stale.example/dark-texture.webp',
              },
            ]),
          },
        },
      ],
    };

    const result = hydratePageContentWithFreshMediaUrls(content, {
      'file-mesh': mediaDeliveryFixture({
        fileId: 'file-mesh',
        assetUrl: 'https://cdn.example/scene.glb',
      }),
      'file-mesh-optimized': mediaDeliveryFixture({
        fileId: 'file-mesh-optimized',
        assetUrl: 'https://cdn.example/scene.draco.glb',
        downloadUrl: 'https://signed.example/scene.draco.glb',
      }),
      'file-texture': mediaDeliveryFixture({
        fileId: 'file-texture',
        thumbnailUrl: 'https://fresh.example/texture.webp',
      }),
      'file-dark-texture': mediaDeliveryFixture({
        fileId: 'file-dark-texture',
        thumbnailUrl: 'https://fresh.example/dark-texture.webp',
      }),
    })!;
    const sceneSection = result.sections[0]!;
    const units = JSON.parse(sceneSection.props!.unitsJson as string);

    expect(units[0]).toMatchObject({
      meshFileId: 'file-mesh',
      meshOptimizationFileId: 'file-mesh-optimized',
      meshOptimizationUrl: 'https://cdn.example/scene.draco.glb',
      textureFileId: 'file-texture',
      textureUrl: 'https://fresh.example/texture.webp',
      darkTextureFileId: 'file-dark-texture',
      darkTextureUrl: 'https://fresh.example/dark-texture.webp',
    });
    expect(units[0].meshUrl).toBeUndefined();
  });

  it('clears stale immersive scene asset URLs when scoped public media is not returned', () => {
    const content: PageContent = {
      sections: [
        {
          id: 'scene-1',
          type: 'immersive-scene',
          settings: {},
          props: {
            unitsJson: JSON.stringify([
              {
                id: 'unit-1',
                meshFileId: 'file-mesh',
                meshUrl: 'https://stale.example/scene.glb',
                meshOptimizationFileId: 'file-mesh-optimized',
                meshOptimizationUrl: 'https://stale.example/scene.draco.glb',
                textureFileId: 'file-texture',
                textureUrl: 'https://stale.example/texture.webp',
              },
            ]),
          },
        },
      ],
    };

    const result = hydratePageContentWithFreshMediaUrls(content, {})!;
    const sceneSection = result.sections[0]!;
    const units = JSON.parse(sceneSection.props!.unitsJson as string);

    expect(units[0].meshFileId).toBe('file-mesh');
    expect(units[0].meshUrl).toBeUndefined();
    expect(units[0].meshOptimizationFileId).toBe('file-mesh-optimized');
    expect(units[0].meshOptimizationUrl).toBeUndefined();
    expect(units[0].textureFileId).toBe('file-texture');
    expect(units[0].textureUrl).toBeUndefined();
  });

  it('hydrates nested Map blocks from one requested-ID Theme batch without N+1 calls', async () => {
    const fallbackTheme = {
      id: 'default-theme',
      name: 'Default Theme',
      settings: DEFAULT_THEME_SETTINGS,
      lightVariant: { id: 'default-light', ...DEFAULT_LIGHT_VARIANT },
      darkVariant: { id: 'default-dark', ...DEFAULT_DARK_VARIANT },
    };
    mockedGetPublicMapPlacesByIdsAction.mockResolvedValue([
      {
        id: 'place-1',
        name: 'Place One',
        address: '1 Example Street',
        lat: 37.5665,
        lng: 126.978,
        googlePlaceId: null,
        addressComponents: null,
        imageUrl: null,
      },
    ]);
    mockedResolvePublicMapThemesByIdsAction.mockResolvedValue([
      { requestedThemeId: 'missing-theme-a', theme: fallbackTheme },
      { requestedThemeId: 'missing-theme-b', theme: fallbackTheme },
    ]);

    const nestedMap = (id: string, themeId: string): Block => ({
      id,
      type: 'map',
      props: { mapPlaceIds: 'place-1', themeId },
    });
    const blocks: Block[] = [
      {
        id: 'outer',
        type: 'group',
        props: {},
        children: [
          nestedMap('map-a', 'missing-theme-a'),
          {
            id: 'inner',
            type: 'group',
            props: {},
            children: [nestedMap('map-b', 'missing-theme-b'), nestedMap('map-a-duplicate', 'missing-theme-a')],
          },
        ],
      },
    ];

    const result = await hydratePostBlockMediaContent(blocks, 'post-1', {});

    expect(mockedResolvePublicMapThemesByIdsAction).toHaveBeenCalledTimes(1);
    expect(mockedResolvePublicMapThemesByIdsAction).toHaveBeenCalledWith(['missing-theme-a', 'missing-theme-b']);
    expect(mockedGetPublicMapPlacesByIdsAction).toHaveBeenCalledTimes(1);

    const firstMapProps = result?.[0].children?.[0].props;
    const innerMaps = result?.[0].children?.[1].children;
    expect(firstMapProps?.themeId).toBe('missing-theme-a');
    expect((firstMapProps?.mapViewConfig as { theme: { id: string } }).theme.id).toBe('default-theme');
    expect(innerMaps?.[0].props.themeId).toBe('missing-theme-b');
    expect((innerMaps?.[0].props.mapViewConfig as { theme: { id: string } }).theme.id).toBe('default-theme');
    expect(innerMaps?.[1].props.themeId).toBe('missing-theme-a');
    expect((innerMaps?.[1].props.mapViewConfig as { theme: { id: string } }).theme.id).toBe('default-theme');
  });

  it('does not normalize whitespace Theme IDs collected from nested Map blocks', async () => {
    mockedGetPublicMapPlacesByIdsAction.mockResolvedValue([
      {
        id: 'place-1',
        name: 'Place One',
        address: '1 Example Street',
        lat: 37.5665,
        lng: 126.978,
        googlePlaceId: null,
        addressComponents: null,
        imageUrl: null,
      },
    ]);
    mockedResolvePublicMapThemesByIdsAction.mockRejectedValueOnce(new Error('invalid Theme ID'));

    await expect(
      hydratePostBlockMediaContent(
        [
          {
            id: 'outer',
            type: 'group',
            props: {},
            children: [
              {
                id: 'direct-theme',
                type: 'map',
                props: { mapPlaceIds: 'place-1', themeId: ' missing-theme ' },
              },
              {
                id: 'embedded-theme',
                type: 'map',
                props: {
                  mapPlaceIds: 'place-1',
                  mapViewConfig: { theme: { id: ' embedded-theme ' } },
                },
              },
            ],
          },
        ],
        'post-1',
        {},
      ),
    ).rejects.toThrow('invalid Theme ID');

    expect(mockedResolvePublicMapThemesByIdsAction).toHaveBeenCalledTimes(1);
    expect(mockedResolvePublicMapThemesByIdsAction).toHaveBeenCalledWith([' missing-theme ', ' embedded-theme ']);
  });

  it('hydrates Post response deliveries without calling the public File boundary', async () => {
    const result = await hydratePostBlockMediaContent(
      [
        {
          id: 'audio-1',
          type: 'file',
          props: { fileId: 'file-a' },
        },
      ],
      'post-1',
      {
        'file-a': mediaDeliveryFixture({
          fileId: 'file-a',
          mimeType: 'audio/wav',
          downloadUrl: 'https://fresh.example/a/original.wav',
          playbackUrl: 'https://fresh.example/a/master.m3u8',
          waveformUrl: 'https://fresh.example/a/waveform.json',
          spectrogramUrl: 'https://fresh.example/a/spectrogram.png',
        }),
      },
    );

    expect(result?.[0].props.entityType).toBeUndefined();
    expect(result?.[0].props.entityId).toBeUndefined();
    expect(result?.[0].props.shareToken).toBeUndefined();
    expect(result?.[0].props.mediaAccessToken).toBeUndefined();
    expect(result?.[0].props.downloadUrl).toBeUndefined();
  });

  it('renders a Post image from the owning Post response delivery', async () => {
    const result = await hydratePostBlockMediaContent(
      [
        {
          id: 'image-1',
          type: 'file',
          props: { fileId: 'file-image' },
        },
      ],
      'post-1',
      {
        'file-image': mediaDeliveryFixture({
          fileId: 'file-image',
          mimeType: 'image/webp',
          inlineUrl: 'https://api.example/media/file-image.webp?token=preview',
        }),
      },
    );

    expect(result?.[0].props.url).toBe('https://api.example/media/file-image.webp?token=preview');
  });

  it('renders an authorized direct draft image from an owning response delivery', async () => {
    const result = await hydratePostBlockMediaContent(
      [{ id: 'image-1', type: 'file', props: { fileId: 'file-image' } }],
      'post-1',
      {
        'file-image': mediaDeliveryFixture({
          fileId: 'file-image',
          mimeType: 'image/webp',
          inlineUrl: 'https://api.example/media/file-image.webp?token=draft-preview',
        }),
      },
    );

    expect(result?.[0].props.url).toBe('https://api.example/media/file-image.webp?token=draft-preview');
  });

  it('prefers the selected optimized mesh from an owning response delivery', () => {
    const result = hydrateBlocksWithFreshMediaUrls(
      [
        {
          id: 'scene-block-1',
          type: 'immersive-scene',
          props: {
            unitsJson: JSON.stringify([
              {
                id: 'unit-1',
                meshFileId: 'file-mesh',
                meshUrl: 'https://stale.example/scene.glb',
                meshOptimizationFileId: 'file-mesh-optimized',
                meshOptimizationUrl: 'https://stale.example/scene.draco.glb',
                textureFileId: 'file-texture',
                textureUrl: 'https://stale.example/texture.webp',
                darkTextureFileId: 'file-dark-texture',
                darkTextureUrl: 'https://stale.example/dark-texture.webp',
              },
            ]),
          },
        },
      ],
      {
        'file-mesh': mediaDeliveryFixture({
          fileId: 'file-mesh',
          assetUrl: 'https://cdn.example/scene.glb',
        }),
        'file-mesh-optimized': mediaDeliveryFixture({
          fileId: 'file-mesh-optimized',
          assetUrl: 'https://cdn.example/scene.draco.glb',
          downloadUrl: 'https://signed.example/scene.draco.glb',
        }),
        'file-texture': mediaDeliveryFixture({
          fileId: 'file-texture',
          thumbnailUrl: 'https://fresh.example/texture.webp',
        }),
        'file-dark-texture': mediaDeliveryFixture({
          fileId: 'file-dark-texture',
          thumbnailUrl: 'https://fresh.example/dark-texture.webp',
        }),
      },
      new Map(),
      new Map(),
      true,
    );

    const units = JSON.parse(result?.[0].props.unitsJson as string);
    expect(units[0]).toMatchObject({
      meshOptimizationUrl: 'https://cdn.example/scene.draco.glb',
      textureUrl: 'https://fresh.example/texture.webp',
      darkTextureUrl: 'https://fresh.example/dark-texture.webp',
    });
    expect(units[0].meshUrl).toBeUndefined();
  });

  it('hydrates page content from owning response deliveries', () => {
    const result = hydratePageContentWithFreshMediaUrls(
      {
        sections: [
          {
            id: 'section-1',
            type: 'rich-text',
            settings: {},
            props: {},
            content: [{ id: 'video-1', type: 'file', props: { fileId: 'file-v' } }],
          },
        ],
      },
      {
        'file-v': mediaDeliveryFixture({
          fileId: 'file-v',
          mimeType: 'video/mp4',
          playbackUrl: 'https://fresh.example/v/master.m3u8',
        }),
      },
      true,
    );

    expect(result?.sections[0].content?.[0].props.hlsUrl).toBe('https://fresh.example/v/master.m3u8');
  });

  it('uses optimized precedence for page immersive scene hydration', () => {
    const result = hydratePageContentWithFreshMediaUrls(
      {
        sections: [
          {
            id: 'scene-1',
            type: 'immersive-scene',
            settings: {},
            props: {
              unitsJson: JSON.stringify([
                {
                  id: 'unit-1',
                  meshFileId: 'file-mesh',
                  meshOptimizationFileId: 'file-mesh-optimized',
                  textureFileId: 'file-texture',
                },
              ]),
            },
          },
        ],
      },
      {
        'file-mesh': mediaDeliveryFixture({
          fileId: 'file-mesh',
          assetUrl: 'https://cdn.example/scene.glb',
        }),
        'file-mesh-optimized': mediaDeliveryFixture({
          fileId: 'file-mesh-optimized',
          assetUrl: 'https://cdn.example/scene.draco.glb',
          downloadUrl: 'https://signed.example/scene.draco.glb',
        }),
        'file-texture': mediaDeliveryFixture({
          fileId: 'file-texture',
          thumbnailUrl: 'https://fresh.example/texture.webp',
        }),
      },
      true,
    );

    expect(result).not.toBeNull();
    const sceneSection = result!.sections[0]!;
    const units = JSON.parse(sceneSection.props!.unitsJson as string);
    expect(units[0].meshUrl).toBeUndefined();
    expect(units[0].meshOptimizationUrl).toBe('https://cdn.example/scene.draco.glb');
    expect(units[0].textureUrl).toBe('https://fresh.example/texture.webp');
  });

  it('uses signed optimized mesh and texture delivery from an owning share response', () => {
    const result = hydratePageContentWithFreshMediaUrls(
      {
        sections: [
          {
            id: 'scene-1',
            type: 'immersive-scene',
            settings: {},
            props: {
              unitsJson: JSON.stringify([
                {
                  id: 'unit-1',
                  mesh: 'sphere',
                  meshSource: 'file',
                  meshFileId: 'file-mesh',
                  meshOptimizationFileId: 'file-mesh-optimized',
                  textureFileId: 'file-texture',
                  color: '#ffffff',
                },
              ]),
            },
          },
        ],
      },
      {
        'file-mesh-optimized': mediaDeliveryFixture({
          fileId: 'file-mesh-optimized',
          downloadUrl: 'https://api.example/media/page/page-1/file-mesh-optimized.glb?token=preview',
        }),
        'file-texture': mediaDeliveryFixture({
          fileId: 'file-texture',
          inlineUrl: 'https://api.example/media/page/page-1/file-texture.webp?token=preview',
        }),
      },
      true,
    );

    const units = JSON.parse(result!.sections[0]!.props!.unitsJson as string);
    expect(units[0].meshUrl).toBeUndefined();
    expect(units[0].meshOptimizationUrl).toBe(
      'https://api.example/media/page/page-1/file-mesh-optimized.glb?token=preview',
    );
    expect(units[0].textureUrl).toBe('https://api.example/media/page/page-1/file-texture.webp?token=preview');
  });

  it('uses signed mesh and texture delivery from an owning draft response', () => {
    const result = hydratePageContentWithFreshMediaUrls(
      {
        sections: [
          {
            id: 'scene-1',
            type: 'immersive-scene',
            settings: {},
            props: {
              unitsJson: JSON.stringify([
                {
                  id: 'unit-1',
                  mesh: 'sphere',
                  meshSource: 'file',
                  meshFileId: 'file-mesh',
                  textureFileId: 'file-texture',
                  color: '#ffffff',
                },
              ]),
            },
          },
        ],
      },
      {
        'file-mesh': mediaDeliveryFixture({
          fileId: 'file-mesh',
          downloadUrl: 'https://api.example/media/page/page-1/file-mesh.glb?token=draft-preview',
        }),
        'file-texture': mediaDeliveryFixture({
          fileId: 'file-texture',
          inlineUrl: 'https://api.example/media/page/page-1/file-texture.webp?token=draft-preview',
        }),
      },
      true,
    );

    const units = JSON.parse(result!.sections[0]!.props!.unitsJson as string);
    expect(units[0].meshUrl).toBe('https://api.example/media/page/page-1/file-mesh.glb?token=draft-preview');
    expect(units[0].textureUrl).toBe('https://api.example/media/page/page-1/file-texture.webp?token=draft-preview');
  });
});
