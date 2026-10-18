import { describe, expect, it } from 'vitest';
import { markerFor, resolveShaderViewMode } from './ShaderNode';
import { DEFAULT_SHADER_FRAGMENT_SOURCE, normalizeShaderError, validateShaderSource } from './shader-source';

describe('Shader source policy', () => {
  it('normalizes implementation-specific compile logs into editor markers', () => {
    expect(normalizeShaderError('ERROR: 0:14:3: undeclared identifier', 'compile', 9)).toEqual({
      kind: 'compile',
      message: 'undeclared identifier',
      line: 5,
      column: 3,
    });
    expect(normalizeShaderError('0(22) : error C0000: syntax error', 'compile', 9)).toEqual({
      kind: 'compile',
      message: 'syntax error',
      line: 13,
      column: 1,
    });
  });

  it('accepts ordinary fragment main and ShaderToy mainImage entrypoints', () => {
    expect(validateShaderSource('void main() {}')).toBeNull();
    expect(validateShaderSource(DEFAULT_SHADER_FRAGMENT_SOURCE)).toBeNull();
  });

  it('only exposes a compile marker on the exact filename tab', () => {
    const error = { kind: 'compile' as const, stage: 'bufferA' as const, message: 'broken', line: 3, column: 2 };
    expect(markerFor(error, 'image')).toEqual([]);
    expect(markerFor(error, 'bufferA')).toEqual([
      expect.objectContaining({ message: 'broken', startLineNumber: 3, startColumn: 2 }),
    ]);
    expect(markerFor({ kind: 'link', stage: 'link', message: 'failed' }, 'image')).toEqual([]);
  });

  it('uses local view mode when the editable surface lacks neutral authority', () => {
    expect(resolveShaderViewMode(false, 'edit', 'preview')).toBe('preview');
    expect(resolveShaderViewMode(false, 'edit', 'source')).toBe('source');
    expect(resolveShaderViewMode(true, 'edit', 'preview')).toBe('edit');
  });
});
