import { describe, expect, it, vi } from 'vitest';
import type { MeshOptimizationCandidate } from '@/lib/types/mesh-optimization';
import type { ImmersiveSceneUnit } from './schema';
import {
  buildRotationAxisPatch,
  buildSceneAssetSlotId,
  clearMeshOptimizationFields,
  createImmersiveSceneUnit,
  diffRemovedMeshOptimizationSources,
  fileNameFromUrl,
  formatAssetFileSize,
  getRotationAxisValues,
  hasImmersiveSceneUnitCopy,
  meshOptimizationPatchFromCandidate,
  moveImmersiveSceneUnit,
  replaceImmersiveSceneUnit,
  resolveAssetAttachment,
  resolveDarkTextureSourceInput,
  resolveMeshOptimizationSelection,
} from './settings-model';

function unit(id: string, patch: Partial<ImmersiveSceneUnit> = {}): ImmersiveSceneUnit {
  return { id, name: id, mesh: 'sphere', color: '#fff', title: '', text: '', ...patch };
}

describe('immersive scene settings model', () => {
  it('creates, replaces, moves, and inspects units without mutating the source list', () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce('00000000-0000-4000-8000-000000000001');
    expect(createImmersiveSceneUnit('Unit')).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Unit',
      mesh: 'sphere',
      color: '#f97316',
    });

    const units = [unit('a'), unit('b', { title: 'Copy' })];
    expect(replaceImmersiveSceneUnit(units, 'a', { color: '#000' })[0]?.color).toBe('#000');
    expect(units[0]?.color).toBe('#fff');
    expect(moveImmersiveSceneUnit(units, 0, 1).map((item) => item.id)).toEqual(['b', 'a']);
    expect(moveImmersiveSceneUnit(units, 0, -1)).toBe(units);
    expect(moveImmersiveSceneUnit(units, 1, 1)).toBe(units);
    expect(hasImmersiveSceneUnitCopy(units)).toBe(true);
    expect(hasImmersiveSceneUnitCopy([unit('empty')])).toBe(false);
  });

  it('maps rotation fields, asset slots, and dark texture source fallbacks', () => {
    expect(getRotationAxisValues({ rotationX: '1', rotationY: '2' }, 'rotation')).toEqual({
      x: '1',
      y: '2',
      z: undefined,
    });
    expect(buildRotationAxisPatch('rotationSpeed', 'z', '0.2')).toEqual({ rotationSpeedZ: '0.2' });
    expect(buildSceneAssetSlotId('section', 'unit', 'dark-texture')).toBe(
      'page-block:section:immersive-scene:unit:dark-texture',
    );
    expect(resolveDarkTextureSourceInput(unit('a', { darkTextureSource: 'color' }))).toBe('color');
    expect(resolveDarkTextureSourceInput(unit('a', { darkTextureFileId: 'file' }))).toBe('image');
    expect(resolveDarkTextureSourceInput(unit('a', { darkColor: '#000' }))).toBe('color');
    expect(resolveDarkTextureSourceInput(unit('a'))).toBe('inherit');
  });

  it('finds mesh optimization sources removed by replacement or deletion', () => {
    const previous = [unit('a', { meshFileId: 'source-a' }), unit('b', { meshOptimizationSourceFileId: 'source-b' })];
    expect(
      diffRemovedMeshOptimizationSources(previous, [
        unit('a', { meshFileId: 'source-a' }),
        unit('b', { meshFileId: 'source-new' }),
      ]),
    ).toEqual([{ sourceFileId: 'source-b', unitId: 'b' }]);
    expect(diffRemovedMeshOptimizationSources(previous, [])).toEqual([
      { sourceFileId: 'source-a', unitId: 'a' },
      { sourceFileId: 'source-b', unitId: 'b' },
    ]);
  });

  it('formats and resolves asset attachment metadata', () => {
    expect(formatAssetFileSize(undefined)).toBe('');
    expect(formatAssetFileSize('512')).toBe('512 B');
    expect(formatAssetFileSize('1536')).toBe('1.5 KB');
    expect(formatAssetFileSize(String(12 * 1024 * 1024))).toBe('12 MB');
    expect(fileNameFromUrl('https://cdn.example/assets/My%20Mesh.glb?token=1')).toBe('My Mesh.glb');
    expect(fileNameFromUrl('%')).toBe('%');
    expect(fileNameFromUrl(undefined)).toBe('');
    expect(
      resolveAssetAttachment(
        unit('a', { textureFileId: 'file-1', textureUrl: '/fallback.webp', textureFileSize: '2048' }),
        'texture',
      ),
    ).toEqual({
      fileId: 'file-1',
      url: '/fallback.webp',
      name: 'fallback.webp',
      size: '2.0 KB',
      sizeBytes: 2048,
    });
  });

  it('projects and clears mesh optimization state', () => {
    expect(resolveMeshOptimizationSelection(unit('a'))).toBeNull();
    expect(
      resolveMeshOptimizationSelection(
        unit('a', { meshOptimizationCandidateId: ' candidate ', meshOptimizationTargetRatioPercent: '70' }),
      ),
    ).toEqual({ candidateId: 'candidate', fileId: undefined, targetRatioPercent: 70 });

    const candidate: MeshOptimizationCandidate = {
      id: 'candidate',
      sourceFileId: '',
      fileId: 'optimized',
      url: '/optimized.glb',
      fileName: 'optimized.glb',
      fileSize: 100,
      method: 'draco',
      targetRatioPercent: 70,
      status: 'completed',
      triangleCount: Number.NaN,
    };
    expect(meshOptimizationPatchFromCandidate(unit('a', { meshFileId: 'source' }), candidate)).toMatchObject({
      meshOptimizationSourceFileId: 'source',
      meshOptimizationFileId: 'optimized',
      meshOptimizationFileSize: '100',
      meshOptimizationTriangleCount: undefined,
    });
    expect(clearMeshOptimizationFields()).toMatchObject({
      meshOptimizationCandidateId: undefined,
      meshOptimizationOriginalVertexCount: undefined,
    });
  });
});
