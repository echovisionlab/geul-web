import { describe, expect, it } from 'vitest';
import {
  diffRemovedImmersiveSceneAssetFileIds,
  parseImmersiveSceneConfig,
  parseImmersiveSceneUnits,
  resolveImmersiveSceneUnitMeshOffsetY,
  resolveImmersiveSceneUnitParticleSize,
  serializeImmersiveSceneCopyUnits,
  serializeImmersiveSceneVisualUnits,
} from './schema';

describe('immersive scene schema', () => {
  it('applies defaults and treats one unit as a valid static scene', () => {
    const config = parseImmersiveSceneConfig({
      unitsJson: '[{"id":"single","mesh":"box","color":"#ffffff"}]',
      copyJson: '[{"id":"single","title":"Single","text":"Only one unit"}]',
    });

    expect(config.playback).toBe('scroll');
    expect(config.transitionWindow).toBe('0.22');
    expect(config.unitHoldSeconds).toBe('5');
    expect(config.unitGapSeconds).toBe('1.5');
    expect(config.textColorSource).toBe('theme');
    expect(config.lightTextColor).toBe('#111827');
    expect(config.darkTextColorSource).toBe('inherit');
    expect(config.darkTextColor).toBe('#f8fafc');
    expect(config.rotationX).toBe('0');
    expect(config.rotationY).toBe('0');
    expect(config.rotationZ).toBe('0');
    expect(config.rotationSpeedX).toBe('0');
    expect(config.rotationSpeedY).toBe('0.18');
    expect(config.rotationSpeedZ).toBe('0');
    expect(config.scrollRotationTurnsX).toBe('0');
    expect(config.scrollRotationTurnsY).toBe('0.35');
    expect(config.scrollRotationTurnsZ).toBe('0');
    expect(config.units).toEqual([
      {
        id: 'single',
        mesh: 'box',
        color: '#ffffff',
        title: 'Single',
        text: 'Only one unit',
      },
    ]);
  });

  it('preserves custom light and dark overlay text colors in shared props', () => {
    const config = parseImmersiveSceneConfig({
      textColorSource: 'custom',
      lightTextColor: '#101010',
      darkTextColorSource: 'custom',
      darkTextColor: '#fefefe',
    });

    expect(config.textColorSource).toBe('custom');
    expect(config.lightTextColor).toBe('#101010');
    expect(config.darkTextColorSource).toBe('custom');
    expect(config.darkTextColor).toBe('#fefefe');
  });

  it('keeps visual units and localized copy separable by id', () => {
    const units = parseImmersiveSceneUnits(
      [
        { id: 'intro', name: 'Opening', mesh: 'sphere', color: '#111111' },
        { id: 'goal', name: 'Resolution', mesh: 'cone', color: '#222222' },
      ],
      [
        { id: 'goal', title: 'Goal', text: 'Localized goal' },
        { id: 'intro', title: 'Intro', text: 'Localized intro' },
      ],
    );

    expect(units).toEqual([
      {
        id: 'intro',
        name: 'Opening',
        mesh: 'sphere',
        color: '#111111',
        title: 'Intro',
        text: 'Localized intro',
      },
      {
        id: 'goal',
        name: 'Resolution',
        mesh: 'cone',
        color: '#222222',
        title: 'Goal',
        text: 'Localized goal',
      },
    ]);
    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))).toEqual([
      expect.objectContaining({ id: 'intro', name: 'Opening' }),
      expect.objectContaining({ id: 'goal', name: 'Resolution' }),
    ]);
    expect(JSON.parse(serializeImmersiveSceneCopyUnits(units))).toEqual([
      { id: 'intro', title: 'Intro', text: 'Localized intro' },
      { id: 'goal', title: 'Goal', text: 'Localized goal' },
    ]);
  });

  it('keeps optional unit attribution in shared visual state across sparse unit sequences', () => {
    const units = parseImmersiveSceneUnits(
      [
        {
          id: 'credited-opening',
          mesh: 'sphere',
          color: '#111111',
          attribution: 'Created by [Artist A](https://example.com/artists/a)',
        },
        { id: 'uncredited-middle', mesh: 'box', color: '#222222' },
        {
          id: 'credited-ending',
          mesh: 'cone',
          color: '#333333',
          attribution: 'Created by [Artist C](https://example.com/artists/c)',
        },
      ],
      [
        { id: 'credited-opening', title: 'Opening', text: 'Localized opening' },
        { id: 'uncredited-middle', title: 'Middle', text: 'Localized middle' },
        { id: 'credited-ending', title: 'Ending', text: 'Localized ending' },
      ],
    );

    expect(units.map((unit) => unit.attribution)).toEqual([
      'Created by [Artist A](https://example.com/artists/a)',
      undefined,
      'Created by [Artist C](https://example.com/artists/c)',
    ]);
    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))).toEqual([
      expect.objectContaining({
        id: 'credited-opening',
        attribution: 'Created by [Artist A](https://example.com/artists/a)',
      }),
      expect.not.objectContaining({ attribution: expect.anything() }),
      expect.objectContaining({
        id: 'credited-ending',
        attribution: 'Created by [Artist C](https://example.com/artists/c)',
      }),
    ]);
    expect(JSON.parse(serializeImmersiveSceneCopyUnits(units))).toEqual([
      { id: 'credited-opening', title: 'Opening', text: 'Localized opening' },
      { id: 'uncredited-middle', title: 'Middle', text: 'Localized middle' },
      { id: 'credited-ending', title: 'Ending', text: 'Localized ending' },
    ]);
  });

  it('leaves copy blank when copyJson is missing', () => {
    const config = parseImmersiveSceneConfig({
      unitsJson: '[{"id":"intro","mesh":"sphere","color":"#111111"},{"id":"goal","mesh":"cone","color":"#222222"}]',
    });

    expect(config.units).toEqual([
      {
        id: 'intro',
        mesh: 'sphere',
        color: '#111111',
        title: '',
        text: '',
      },
      {
        id: 'goal',
        mesh: 'cone',
        color: '#222222',
        title: '',
        text: '',
      },
    ]);
  });

  it('falls back to default visual units with blank copy when serialized input is invalid', () => {
    const config = parseImmersiveSceneConfig({
      unitsJson: 'not json',
      copyJson: 'not json',
    });

    expect(config.units.length).toBeGreaterThan(1);
    expect(config.units[0]).toMatchObject({
      id: 'who-we-are',
      mesh: 'sphere',
      title: '',
      text: '',
    });
  });

  it('leaves copy blank for invalid or missing per-unit copy entries', () => {
    const units = parseImmersiveSceneUnits(
      [
        { id: 'intro', mesh: 'sphere', color: '#111111' },
        { id: 'goal', mesh: 'cone', color: '#222222' },
        { id: 'outro', mesh: 'box', color: '#333333' },
      ],
      [
        { id: 'intro', title: 'Intro', text: 'Localized intro' },
        { id: 'goal', title: 123, text: 'Invalid title type' },
      ],
    );

    expect(units).toEqual([
      {
        id: 'intro',
        mesh: 'sphere',
        color: '#111111',
        title: 'Intro',
        text: 'Localized intro',
      },
      {
        id: 'goal',
        mesh: 'cone',
        color: '#222222',
        title: '',
        text: '',
      },
      {
        id: 'outro',
        mesh: 'box',
        color: '#333333',
        title: '',
        text: '',
      },
    ]);
  });

  it('defaults to visual units with blank copy when no props are provided', () => {
    const config = parseImmersiveSceneConfig({});

    expect(config.units[0]).toMatchObject({
      id: 'who-we-are',
      mesh: 'sphere',
      color: '#d8dde5',
      title: '',
      text: '',
    });
  });

  it('serializes shared visual props separately from localized copy props', () => {
    const config = parseImmersiveSceneConfig({});

    expect(JSON.parse(serializeImmersiveSceneVisualUnits(config.units))[0]).toEqual({
      id: 'who-we-are',
      mesh: 'sphere',
      color: '#d8dde5',
    });
    expect(JSON.parse(serializeImmersiveSceneCopyUnits(config.units))[0]).toEqual({
      id: 'who-we-are',
      title: '',
      text: '',
    });
  });

  it('serializes asset references as durable IDs and authored settings only', () => {
    const units = parseImmersiveSceneUnits(
      [
        {
          id: 'asset',
          mesh: 'sphere',
          meshSource: 'file',
          meshFileId: 'mesh-file',
          meshUrl: '/media/page/page-1/files/mesh-file.glb',
          meshFileName: 'scene.glb',
          meshFileSize: '2048',
          meshObjectName: 'Flower',
          meshOptimizationCandidateId: 'mesh-file-draco-70',
          meshOptimizationSourceFileId: 'mesh-file',
          meshOptimizationFileId: 'mesh-file-draco',
          meshOptimizationUrl: '/media/page/page-1/files/mesh-file-draco.glb',
          meshOptimizationFileName: 'scene.draco.glb',
          meshOptimizationFileSize: '1024',
          meshOptimizationOriginalFileSize: '4096',
          meshOptimizationMethod: 'draco',
          meshOptimizationTargetRatioPercent: '70',
          meshOptimizationTriangleCount: '1440',
          meshOptimizationVertexCount: '720',
          meshOptimizationOriginalTriangleCount: '2880',
          meshOptimizationOriginalVertexCount: '1440',
          scale: '1.8',
          particleSize: '0.65',
          holdSeconds: '4.5',
          color: '#ffffff',
          textureSource: 'image',
          textureFileId: 'texture-file',
          textureUrl: '/media/page/page-1/files/texture-file.webp',
          textureFileName: 'light.webp',
          textureFileSize: '1024',
          darkColor: '#111827',
          darkTextureSource: 'image',
          darkTextureFileId: 'dark-texture-file',
          darkTextureUrl: '/media/page/page-1/files/dark-texture-file.webp',
          darkTextureFileName: 'dark.webp',
          darkTextureFileSize: '512',
        },
      ],
      [{ id: 'asset', title: 'Asset unit', text: 'Uses uploaded resources' }],
    );

    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))[0]).toEqual({
      id: 'asset',
      mesh: 'sphere',
      meshSource: 'file',
      meshFileId: 'mesh-file',
      meshObjectName: 'Flower',
      meshOptimizationCandidateId: 'mesh-file-draco-70',
      meshOptimizationSourceFileId: 'mesh-file',
      meshOptimizationFileId: 'mesh-file-draco',
      scale: '1.8',
      particleSize: '0.65',
      holdSeconds: '4.5',
      color: '#ffffff',
      textureSource: 'image',
      textureFileId: 'texture-file',
      darkColor: '#111827',
      darkTextureSource: 'image',
      darkTextureFileId: 'dark-texture-file',
    });
    expect(JSON.parse(serializeImmersiveSceneCopyUnits(units))[0]).toEqual({
      id: 'asset',
      title: 'Asset unit',
      text: 'Uses uploaded resources',
    });
  });

  it('resolves unit particle size overrides against the scene default', () => {
    expect(resolveImmersiveSceneUnitParticleSize(undefined, 1.2)).toBe(1.2);
    expect(resolveImmersiveSceneUnitParticleSize('', 1.2)).toBe(1.2);
    expect(resolveImmersiveSceneUnitParticleSize('0.6', 1.2)).toBe(0.6);
    expect(resolveImmersiveSceneUnitParticleSize('99', 1.2)).toBe(5);
    expect(resolveImmersiveSceneUnitParticleSize('invalid', 1.2)).toBe(1.2);
  });

  it('keeps a shared mesh height offset and resolves it within the supported range', () => {
    const units = parseImmersiveSceneUnits(
      [
        { id: 'lowered', mesh: 'sphere', meshOffsetY: '-2.4', color: '#ffffff' },
        { id: 'default', mesh: 'box', color: '#111111' },
      ],
      [],
    );

    expect(units.map((unit) => unit.meshOffsetY)).toEqual(['-2.4', undefined]);
    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))).toEqual([
      expect.objectContaining({ id: 'lowered', meshOffsetY: '-2.4' }),
      expect.not.objectContaining({ meshOffsetY: expect.anything() }),
    ]);
    expect(resolveImmersiveSceneUnitMeshOffsetY(undefined)).toBe(0);
    expect(resolveImmersiveSceneUnitMeshOffsetY('')).toBe(0);
    expect(resolveImmersiveSceneUnitMeshOffsetY('invalid')).toBe(0);
    expect(resolveImmersiveSceneUnitMeshOffsetY('-99')).toBe(-5);
    expect(resolveImmersiveSceneUnitMeshOffsetY('99')).toBe(5);
    expect(resolveImmersiveSceneUnitMeshOffsetY('1.7')).toBe(1.7);
  });

  it('round-trips optional per-unit rotation axes as shared visual state', () => {
    const units = parseImmersiveSceneUnits(
      [
        {
          id: 'rotating',
          mesh: 'sphere',
          color: '#ffffff',
          rotationX: '15',
          rotationY: '-30',
          rotationZ: '45',
          rotationSpeedX: '0.1',
          rotationSpeedY: '0',
          rotationSpeedZ: '-0.3',
          scrollRotationTurnsX: '0.25',
          scrollRotationTurnsY: '-0.5',
          scrollRotationTurnsZ: '0.75',
        },
      ],
      [{ id: 'rotating', title: 'Localized', text: 'Copy' }],
    );

    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))[0]).toEqual({
      id: 'rotating',
      mesh: 'sphere',
      color: '#ffffff',
      rotationX: '15',
      rotationY: '-30',
      rotationZ: '45',
      rotationSpeedX: '0.1',
      rotationSpeedY: '0',
      rotationSpeedZ: '-0.3',
      scrollRotationTurnsX: '0.25',
      scrollRotationTurnsY: '-0.5',
      scrollRotationTurnsZ: '0.75',
    });
    expect(JSON.parse(serializeImmersiveSceneCopyUnits(units))[0]).toEqual({
      id: 'rotating',
      title: 'Localized',
      text: 'Copy',
    });
  });

  it('reads the legacy mesh optimization quality field without persisting runtime metadata', () => {
    const units = parseImmersiveSceneUnits(
      [
        {
          id: 'asset',
          mesh: 'sphere',
          meshOptimizationQuality: '55',
          color: '#ffffff',
        },
      ],
      [],
    );

    expect(units[0]?.meshOptimizationTargetRatioPercent).toBe('55');
    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))[0]).toEqual({
      id: 'asset',
      mesh: 'sphere',
      color: '#ffffff',
    });
  });

  it('drops unsupported and empty unit fields during canonical serialization', () => {
    const units = parseImmersiveSceneUnits(
      [
        {
          id: 'asset',
          mesh: 'sphere',
          color: '#ffffff',
          particleSize: '',
          removedParticleScale: '2',
        },
      ],
      [],
    );

    expect(JSON.parse(serializeImmersiveSceneVisualUnits(units))[0]).toEqual({
      id: 'asset',
      mesh: 'sphere',
      color: '#ffffff',
    });
  });

  it('diffs only uploaded asset file ids that are no longer referenced', () => {
    const previousUnits = parseImmersiveSceneUnits(
      [
        {
          id: 'first',
          mesh: 'sphere',
          meshFileId: 'shared-mesh',
          meshOptimizationFileId: 'removed-optimized-mesh',
          textureFileId: 'removed-texture',
          color: '#ffffff',
        },
        {
          id: 'second',
          mesh: 'box',
          meshFileId: 'shared-mesh',
          darkTextureFileId: 'removed-dark-texture',
          color: '#000000',
        },
      ],
      [
        { id: 'first', title: 'First', text: '' },
        { id: 'second', title: 'Second', text: '' },
      ],
    );
    const nextUnits = parseImmersiveSceneUnits(
      [
        {
          id: 'second',
          mesh: 'box',
          meshFileId: 'shared-mesh',
          color: '#000000',
        },
      ],
      [{ id: 'second', title: 'Second', text: '' }],
    );

    expect(diffRemovedImmersiveSceneAssetFileIds(previousUnits, nextUnits).sort()).toEqual([
      'removed-dark-texture',
      'removed-optimized-mesh',
      'removed-texture',
    ]);
  });
});
