import { describe, expect, it } from 'vitest';
import { mapShaderCompileError } from './shader-source';

describe('Shader compile diagnostics mapping', () => {
  const map = { stage: 'bufferA' as const, commonStartLine: 12, commonLineCount: 3, stageStartLine: 15 };

  it('maps Common errors to common.glsl coordinates', () => {
    expect(mapShaderCompileError('ERROR: 0:13: broken common', map)).toMatchObject({
      kind: 'compile',
      stage: 'common',
      line: 2,
      message: 'broken common',
    });
  });

  it('maps active pass errors to its own filename coordinates', () => {
    expect(mapShaderCompileError('ERROR: 0:17: broken buffer', map)).toMatchObject({
      kind: 'compile',
      stage: 'bufferA',
      line: 3,
      message: 'broken buffer',
    });
  });
});
