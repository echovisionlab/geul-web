import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHADER_PROGRAM,
  normalizeShaderChannels,
  validateShaderPassGraph,
  type ShaderProgramDocument,
} from './shader-program';

function program(channels: ShaderProgramDocument['channels']): ShaderProgramDocument {
  return { ...DEFAULT_SHADER_PROGRAM, channels };
}

describe('Shader multipass program contract', () => {
  it('normalizes four durable channel slots without accepting URLs', () => {
    expect(
      normalizeShaderChannels([
        {
          kind: 'textureFile',
          fileId: 'file-image',
          url: 'https://invalid.example/x',
          sampler: { filter: 'linear', wrap: 'repeat', vflip: true },
        },
        { kind: 'videoFile', fileId: 'file-video' },
      ]),
    ).toEqual([
      { kind: 'textureFile', fileId: 'file-image', sampler: { filter: 'linear', wrap: 'repeat', vflip: true } },
      { kind: 'videoFile', fileId: 'file-video', sampler: { filter: 'nearest', wrap: 'clamp', vflip: false } },
      { kind: 'none' },
      { kind: 'none' },
    ]);
  });

  it('allows self-feedback and rejects mutual buffer dependency cycles', () => {
    expect(validateShaderPassGraph(program({ bufferA: [{ kind: 'buffer', buffer: 'A' }] }))).toBeNull();
    expect(
      validateShaderPassGraph(
        program({
          bufferA: [{ kind: 'buffer', buffer: 'B' }],
          bufferB: [{ kind: 'buffer', buffer: 'A' }],
        }),
      ),
    ).toContain('mutual dependency cycle');
  });

  it('requires all six cubemap File faces', () => {
    expect(normalizeShaderChannels([{ kind: 'cubemapFiles', fileIds: ['one'] }])[0]).toEqual({ kind: 'none' });
    expect(
      normalizeShaderChannels([
        { kind: 'cubemapFiles', fileIds: ['px', 'nx', 'py', 'ny', 'pz', 'nz'], sampler: {} },
      ])[0],
    ).toMatchObject({ kind: 'cubemapFiles', fileIds: ['px', 'nx', 'py', 'ny', 'pz', 'nz'] });
  });
});
