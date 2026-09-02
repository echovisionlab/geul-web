import { describe, expect, it, vi } from 'vitest';
import { COMMON_UNIFORMS, makeCubeTarget, makeSoundTarget, makeTarget } from './shader-preview.worker';

function fakeWebGl(framebufferComplete = true) {
  let texture = 0;
  let framebuffer = 0;
  return {
    FRAMEBUFFER: 1,
    FRAMEBUFFER_COMPLETE: 2,
    COLOR_ATTACHMENT0: 3,
    TEXTURE_2D: 4,
    TEXTURE_CUBE_MAP: 5,
    TEXTURE_CUBE_MAP_POSITIVE_X: 6,
    TEXTURE_MIN_FILTER: 7,
    TEXTURE_MAG_FILTER: 8,
    TEXTURE_WRAP_S: 9,
    TEXTURE_WRAP_T: 10,
    LINEAR: 11,
    CLAMP_TO_EDGE: 12,
    RGBA8: 13,
    RGBA32F: 14,
    RGBA: 15,
    UNSIGNED_BYTE: 16,
    FLOAT: 17,
    COLOR_BUFFER_BIT: 18,
    createTexture: vi.fn(() => ({ texture: texture++ })),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    createFramebuffer: vi.fn(() => ({ framebuffer: framebuffer++ })),
    deleteFramebuffer: vi.fn(),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => (framebufferComplete ? 2 : 0)),
    clearColor: vi.fn(),
    clear: vi.fn(),
    getExtension: vi.fn(() => ({})),
  };
}

describe('Shader worker render-target allocation', () => {
  it('uses identical explicit float and integer precision for linked stage uniforms', () => {
    expect(COMMON_UNIFORMS).toContain('precision highp float;');
    expect(COMMON_UNIFORMS).toContain('precision highp int;');
    expect(COMMON_UNIFORMS).toContain('uniform int iFrame;');
  });

  it('allocates two complete Buffer targets, twelve Cubemap faces, and float PCM targets', () => {
    const gl = fakeWebGl();
    expect(makeTarget(gl as unknown as WebGL2RenderingContext, 800, 450)).not.toBeNull();
    expect(gl.checkFramebufferStatus).toHaveBeenCalledTimes(2);

    gl.checkFramebufferStatus.mockClear();
    const cube = makeCubeTarget(gl as unknown as WebGL2RenderingContext, 450);
    expect(cube?.framebuffers.flat()).toHaveLength(12);
    expect(gl.checkFramebufferStatus).toHaveBeenCalledTimes(12);

    gl.checkFramebufferStatus.mockClear();
    expect(makeSoundTarget(gl as unknown as WebGL2RenderingContext)).not.toBeNull();
    expect(gl.checkFramebufferStatus).toHaveBeenCalledTimes(2);
    expect(gl.texImage2D).toHaveBeenCalledWith(gl.TEXTURE_2D, 0, gl.RGBA32F, 1024, 1, 0, gl.RGBA, gl.FLOAT, null);
  });

  it('fails closed and releases partial allocations for an incomplete framebuffer', () => {
    const gl = fakeWebGl(false);
    expect(makeTarget(gl as unknown as WebGL2RenderingContext, 800, 450)).toBeNull();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
    expect(gl.deleteFramebuffer).toHaveBeenCalledTimes(2);
  });
});
