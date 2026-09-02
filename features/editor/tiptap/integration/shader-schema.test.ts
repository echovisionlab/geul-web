// @vitest-environment jsdom

import { getSchema } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { createShaderExtension } from '../shader';
import { createTiptapWireExtensions } from '../wire-schema';

vi.mock('@/features/editor/tiptap/code-editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/editor/tiptap/code-editor')>()),
  MonacoSourceEditor: () => null,
}));

function attributeDefaults(attributes: Record<string, { default?: unknown }>) {
  return Object.fromEntries(Object.entries(attributes).map(([name, attribute]) => [name, attribute.default]));
}

describe('Shader wire-schema integration', () => {
  it('stores each program source in exact collaborative child nodes and only presentation state as parent attributes', () => {
    const schema = getSchema([...createTiptapWireExtensions(), createShaderExtension()]);
    const shader = schema.nodes.shader;

    expect(shader).toBeDefined();
    expect(shader?.spec.group).toBe('blockContent');
    expect(String(shader?.spec.content)).toBe(
      'shaderCommon shaderVertex shaderBufferA shaderBufferB shaderBufferC shaderBufferD shaderCubemap shaderSound shaderImage',
    );
    expect(String(schema.nodes.shaderVertex?.spec.content)).toBe('text*');
    expect(String(schema.nodes.shaderImage?.spec.content)).toBe('text*');
    expect(schema.nodes.shaderSound?.spec.attrs).toHaveProperty('channels');
    expect(attributeDefaults(shader?.spec.attrs ?? {})).toEqual({
      title: '',
      mode: 'edit',
      previewHeight: 360,
      previewWidth: '100',
      textAlignment: 'left',
    });
    expect(shader?.spec.attrs).not.toHaveProperty('source');
  });
});
