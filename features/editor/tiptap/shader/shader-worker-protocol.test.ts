import { describe, expect, it } from 'vitest';
import { DEFAULT_SHADER_PROGRAM } from './shader-program';
import {
  SHADER_CUBE_FACE_ORDER,
  shaderAssetKey,
  shaderFeedbackReadIndex,
  shaderPassOrder,
  shaderPassReadIndex,
  shaderRenderTargetPlan,
  shaderShouldRenderSoundChunk,
  shaderWorkerMessageAction,
} from './shader-worker-protocol';

describe('Shader worker protocol invariants', () => {
  it('orders dependent passes before consumers while self-feedback reads the prior target', () => {
    const program = {
      ...DEFAULT_SHADER_PROGRAM,
      sources: { ...DEFAULT_SHADER_PROGRAM.sources, bufferA: 'void main(){}', bufferB: 'void main(){}' },
      channels: {
        bufferA: [{ kind: 'buffer' as const, buffer: 'A' as const }],
        bufferB: [{ kind: 'buffer' as const, buffer: 'A' as const }],
      },
    };
    expect(shaderPassOrder(program)).toEqual(['bufferA', 'bufferB', 'image']);
    expect(shaderFeedbackReadIndex(0)).toBe(1);
    expect(shaderFeedbackReadIndex(1)).toBe(0);
    expect(shaderPassReadIndex(0, true)).toBe(1);
    expect(shaderPassReadIndex(0, false)).toBe(0);
  });

  it('separates upload keys for opposite vflip and fixes cubemap face order', () => {
    const sampler = { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false };
    expect(shaderAssetKey({ kind: 'textureFile', fileId: 'same', sampler })).not.toBe(
      shaderAssetKey({ kind: 'textureFile', fileId: 'same', sampler: { ...sampler, vflip: true } }),
    );
    expect(SHADER_CUBE_FACE_ORDER).toEqual(['+X', '-X', '+Y', '-Y', '+Z', '-Z']);
  });

  it('keeps Sound generation within a bounded playback horizon', () => {
    expect(shaderShouldRenderSoundChunk(0, 44_100, 0)).toBe(true);
    expect(shaderShouldRenderSoundChunk(44_100, 44_100, 0)).toBe(false);
    expect(shaderShouldRenderSoundChunk(44_100, 44_100, 0.95)).toBe(true);
  });

  it('rebuilds deterministic ping-pong, six-face cubemap, and float Sound targets on resize', () => {
    expect(shaderRenderTargetPlan(800.4, 450.4)).toEqual({
      buffer: { width: 800, height: 450, textures: 2, framebuffers: 2 },
      cubemap: { size: 450, textures: 2, facesPerTexture: 6, framebuffers: 12 },
      sound: { width: 1024, height: 1, format: 'RGBA32F' },
    });
    expect(shaderRenderTargetPlan(0, 0).buffer).toMatchObject({ width: 1, height: 1 });
  });

  it('routes every asset upload without falling through to worker stop', () => {
    expect(['asset2d', 'assetVideo', 'assetCube'].map(shaderWorkerMessageAction)).toEqual([
      'asset2d',
      'assetVideo',
      'assetCube',
    ]);
    expect(shaderWorkerMessageAction('unknown')).toBe('stopUnknown');
  });
});
