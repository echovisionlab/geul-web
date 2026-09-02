import { describe, expect, it } from 'vitest';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import { collectImmersiveSceneMediaRequests, hydrateImmersiveSceneAssetProps } from './immersive-scene-hydration';

const optimizedProps = {
  unitsJson: JSON.stringify([
    {
      id: 'unit-1',
      meshFileId: 'source-file',
      meshUrl: 'https://stale.example/source.glb',
      meshOptimizationFileId: 'optimized-file',
      meshOptimizationUrl: 'https://stale.example/optimized.glb',
    },
  ]),
};

describe('immersive scene media hydration', () => {
  it('collects only the selected optimized mesh for public rendering', () => {
    expect(collectImmersiveSceneMediaRequests(optimizedProps)).toEqual([
      { fileId: 'optimized-file', includeDownloadUrl: false },
    ]);

    expect(
      collectImmersiveSceneMediaRequests(optimizedProps, {
        allowSignedPreviewFallback: true,
      }),
    ).toEqual([{ fileId: 'optimized-file', includeDownloadUrl: true }]);
  });

  it('keeps published hydration asset-only and never substitutes the source mesh', () => {
    const hydrated = hydrateImmersiveSceneAssetProps(
      optimizedProps,
      {
        'source-file': mediaDeliveryFixture({
          fileId: 'source-file',
          assetUrl: 'https://cdn.example/source.glb',
        }),
        'optimized-file': mediaDeliveryFixture({
          fileId: 'optimized-file',
          assetUrl: 'https://cdn.example/optimized.glb',
          downloadUrl: 'https://signed.example/optimized.glb',
        }),
      },
      { mode: 'public' },
    );
    const unit = JSON.parse(hydrated.unitsJson as string)[0];

    expect(unit.meshUrl).toBeUndefined();
    expect(unit.meshOptimizationUrl).toBe('https://cdn.example/optimized.glb');
  });

  it('uses signed optimized delivery only for explicit share-preview hydration', () => {
    const deliveries = {
      'source-file': mediaDeliveryFixture({
        fileId: 'source-file',
        assetUrl: 'https://cdn.example/source.glb',
      }),
      'optimized-file': mediaDeliveryFixture({
        fileId: 'optimized-file',
        downloadUrl: 'https://signed.example/optimized.glb',
      }),
    };
    const published = hydrateImmersiveSceneAssetProps(optimizedProps, deliveries, {
      mode: 'public',
    });
    const preview = hydrateImmersiveSceneAssetProps(optimizedProps, deliveries, {
      mode: 'public',
      allowSignedPreviewFallback: true,
    });

    expect(JSON.parse(published.unitsJson as string)[0]).not.toHaveProperty('meshOptimizationUrl');
    expect(JSON.parse(preview.unitsJson as string)[0]).toMatchObject({
      meshOptimizationFileId: 'optimized-file',
      meshOptimizationUrl: 'https://signed.example/optimized.glb',
    });
    expect(JSON.parse(preview.unitsJson as string)[0]).not.toHaveProperty('meshUrl');
  });

  it('uses signed texture inline delivery only for explicit share preview', () => {
    const props = {
      unitsJson: JSON.stringify([
        {
          id: 'unit-1',
          textureFileId: 'texture-file',
          textureUrl: 'https://stale.example/texture.webp',
        },
      ]),
    };
    const deliveries = {
      'texture-file': mediaDeliveryFixture({
        fileId: 'texture-file',
        inlineUrl: 'https://api.example/media/texture-file.webp?token=preview',
      }),
    };
    const published = hydrateImmersiveSceneAssetProps(props, deliveries, {
      mode: 'public',
    });
    const preview = hydrateImmersiveSceneAssetProps(props, deliveries, {
      mode: 'public',
      allowSignedPreviewFallback: true,
    });

    expect(JSON.parse(published.unitsJson as string)[0]).not.toHaveProperty('textureUrl');
    expect(JSON.parse(preview.unitsJson as string)[0].textureUrl).toBe(
      'https://api.example/media/texture-file.webp?token=preview',
    );
  });

  it('hydrates authenticated settings metadata for source and optimized IDs', () => {
    const requests = collectImmersiveSceneMediaRequests(optimizedProps, {
      includeSourceWhenOptimized: true,
    });
    expect(requests.map((request) => request.fileId)).toEqual(['source-file', 'optimized-file']);

    const hydrated = hydrateImmersiveSceneAssetProps(
      optimizedProps,
      {
        'source-file': mediaDeliveryFixture({
          fileId: 'source-file',
          downloadUrl: 'https://signed.example/source.glb',
          fileName: 'source.glb',
          fileSize: BigInt(2048),
        }),
        'optimized-file': mediaDeliveryFixture({
          fileId: 'optimized-file',
          assetUrl: 'https://cdn.example/optimized.glb',
          downloadUrl: 'https://signed.example/optimized.glb',
          fileName: 'optimized.glb',
          fileSize: BigInt(1024),
        }),
      },
      {
        mode: 'authenticated',
        includeSourceWhenOptimized: true,
      },
    );
    const unit = JSON.parse(hydrated.unitsJson as string)[0];

    expect(unit).toMatchObject({
      meshUrl: 'https://signed.example/source.glb',
      meshFileName: 'source.glb',
      meshFileSize: '2048',
      meshOptimizationUrl: 'https://cdn.example/optimized.glb',
      meshOptimizationFileName: 'optimized.glb',
      meshOptimizationFileSize: '1024',
    });
  });
});
