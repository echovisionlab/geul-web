import { describe, expect, it } from 'vitest';
import {
  SHADER_AVAILABLE_INPUTS,
  shaderChannelApiItems,
  shaderStageEntryPoint,
  shaderStageEntryPointName,
} from './shader-editor-api';

describe('Shader editor input reference', () => {
  it('exposes only uniforms implemented by the worker contract', () => {
    expect(SHADER_AVAILABLE_INPUTS.map(({ name }) => name)).toEqual([
      'iResolution',
      'iTime',
      'iTimeDelta',
      'iFrameRate',
      'iFrame',
      'iChannelTime',
      'iChannelResolution',
      'iMouse',
      'iDate',
      'iSampleRate',
    ]);
  });

  it('uses the exact entry point for each filename family', () => {
    expect(shaderStageEntryPoint('common')).toBeNull();
    expect(shaderStageEntryPointName('common')).toBeNull();
    expect(shaderStageEntryPoint('vertex')).toBe('void main()');
    expect(shaderStageEntryPoint('bufferA')).toContain('mainImage');
    expect(shaderStageEntryPoint('image')).toContain('mainImage');
    expect(shaderStageEntryPoint('cubemap')).toContain('mainCubemap');
    expect(shaderStageEntryPoint('sound')).toContain('mainSound');
  });

  it('describes the live sampler type for all four current channel slots', () => {
    expect(
      shaderChannelApiItems([
        { kind: 'none' },
        { kind: 'buffer', buffer: 'A' },
        {
          kind: 'cubemapPass',
          sampler: { filter: 'linear', wrap: 'clamp', vflip: false },
        },
        {
          kind: 'textureFile',
          fileId: 'file-1',
          sampler: { filter: 'nearest', wrap: 'repeat', vflip: true },
        },
      ]).map(({ name, type }) => [name, type]),
    ).toEqual([
      ['iChannel0', 'sampler2D'],
      ['iChannel1', 'sampler2D'],
      ['iChannel2', 'samplerCube'],
      ['iChannel3', 'sampler2D'],
    ]);
  });
});
