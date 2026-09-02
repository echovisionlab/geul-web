import { create } from '@bufbuild/protobuf';
import { ContentBlockMediaItemSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import { ContentBlockMediaRuntimeIndex } from '@/features/media/content-block-media-runtime';
import { parseImmersiveSceneUnitsJson } from '@/lib/media/immersive-scene-hydration';
import { hydrateImmersiveSceneRuntimeProps } from './runtime-media';

const sectionId = '2f42ef7b-0220-5b4c-ad59-d6c6e4712b4d';
const sourceFileId = '1620bf08-8b57-41f3-a071-abe628f7ff6a';
const optimizedFileId = '60d8271d-c047-46e2-a85f-e7f54bc2e03c';
const otherFileId = '8f8428cf-f451-51dd-8307-9ca6ac903357';

function runtimeItem({
  fileId,
  referencePath,
  assetUrl,
}: {
  fileId: string;
  referencePath: string;
  assetUrl?: string;
}) {
  return create(ContentBlockMediaItemSchema, {
    selector: { blockId: sectionId, referencePath },
    attachment: { state: { case: 'activeFileId', value: fileId } },
    delivery: assetUrl ? { fileId, asset: { url: assetUrl } } : undefined,
  });
}

function sceneProps(unit: Record<string, unknown>) {
  return {
    unitsJson: JSON.stringify([{ id: 'opening', mesh: 'sphere', color: '#ffffff', ...unit }]),
    copyJson: '[]',
  };
}

describe('hydrateImmersiveSceneRuntimeProps', () => {
  it('hydrates only the selected optimized mesh from its exact runtime selector', () => {
    const props = sceneProps({
      meshSource: 'file',
      meshFileId: sourceFileId,
      meshOptimizationFileId: optimizedFileId,
    });
    const runtime = new ContentBlockMediaRuntimeIndex([
      runtimeItem({
        fileId: optimizedFileId,
        referencePath: 'immersive_scene:opening:optimized_mesh',
        assetUrl: 'https://cdn.example/optimized.glb',
      }),
    ]);

    const [unit] = parseImmersiveSceneUnitsJson(hydrateImmersiveSceneRuntimeProps(props, sectionId, runtime).unitsJson);

    expect(unit).toMatchObject({
      meshFileId: sourceFileId,
      meshOptimizationFileId: optimizedFileId,
      meshOptimizationUrl: 'https://cdn.example/optimized.glb',
    });
    expect(unit).not.toHaveProperty('meshUrl');
  });

  it('hydrates a source mesh when no optimized mesh is selected', () => {
    const props = sceneProps({ meshSource: 'file', meshFileId: sourceFileId });
    const runtime = new ContentBlockMediaRuntimeIndex([
      runtimeItem({
        fileId: sourceFileId,
        referencePath: 'immersive_scene:opening:mesh',
        assetUrl: 'https://cdn.example/source.glb',
      }),
    ]);

    const [unit] = parseImmersiveSceneUnitsJson(hydrateImmersiveSceneRuntimeProps(props, sectionId, runtime).unitsJson);

    expect(unit).toMatchObject({ meshFileId: sourceFileId, meshUrl: 'https://cdn.example/source.glb' });
  });

  it('fails closed when runtime media is absent or belongs to another selector', () => {
    const props = sceneProps({ meshSource: 'file', meshFileId: sourceFileId });
    const wrongSelector = new ContentBlockMediaRuntimeIndex([
      runtimeItem({
        fileId: sourceFileId,
        referencePath: 'immersive_scene:other-unit:mesh',
        assetUrl: 'https://cdn.example/source.glb',
      }),
    ]);

    expect(() => hydrateImmersiveSceneRuntimeProps(props, sectionId, null)).toThrow(/runtime context/u);
    expect(() => hydrateImmersiveSceneRuntimeProps(props, sectionId, wrongSelector)).toThrow(
      /no active runtime attachment/u,
    );
  });

  it('rejects a runtime attachment that does not match durable state', () => {
    const props = sceneProps({ meshSource: 'file', meshFileId: sourceFileId });
    const runtime = new ContentBlockMediaRuntimeIndex([
      runtimeItem({
        fileId: otherFileId,
        referencePath: 'immersive_scene:opening:mesh',
        assetUrl: 'https://cdn.example/other.glb',
      }),
    ]);

    expect(() => hydrateImmersiveSceneRuntimeProps(props, sectionId, runtime)).toThrow(/does not match durable state/u);
  });

  it('keeps the selected File identity without inventing a URL when delivery is unavailable', () => {
    const props = sceneProps({ meshSource: 'file', meshFileId: sourceFileId });
    const runtime = new ContentBlockMediaRuntimeIndex([
      runtimeItem({ fileId: sourceFileId, referencePath: 'immersive_scene:opening:mesh' }),
    ]);

    const [unit] = parseImmersiveSceneUnitsJson(hydrateImmersiveSceneRuntimeProps(props, sectionId, runtime).unitsJson);

    expect(unit).toMatchObject({ meshFileId: sourceFileId });
    expect(unit).not.toHaveProperty('meshUrl');
  });

  it('leaves primitive-only scene props independent from runtime context', () => {
    const props = sceneProps({ meshSource: 'primitive' });

    expect(hydrateImmersiveSceneRuntimeProps(props, undefined, null)).toBe(props);
  });
});
