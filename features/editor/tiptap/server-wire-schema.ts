import { getSchema, Node as TiptapNode, type Attribute, type Extensions } from '@tiptap/core';
import { externalVideoLinkLayoutPropSchema } from '@echovisionlab/geul-common/media/block-schemas';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import { createTiptapWireExtensions } from './wire-schema';

const executableAttributes = {
  title: { default: '' },
  mode: { default: 'edit' },
  previewHeight: { default: 360 },
  previewWidth: { default: '100' },
  textAlignment: { default: 'left' },
} satisfies Record<string, Attribute>;

const PostParagraphWireNode = TiptapNode.create({
  name: 'paragraph',
  group: 'blockContent',
  content: 'inline*',
  addAttributes: () => ({
    backgroundColor: { default: 'default' },
    textColor: { default: 'default' },
    textAlignment: { default: 'left' },
    ...Object.fromEntries(
      Object.entries(externalVideoLinkLayoutPropSchema).map(([name, spec]) => [name, { default: spec.default }]),
    ),
  }),
});

const P5SketchWireNode = TiptapNode.create({
  name: 'p5Sketch',
  group: 'blockContent',
  content: 'text*',
  marks: '',
  addAttributes: () => ({ ...executableAttributes, capabilities: { default: '' } }),
});

const ThreeSceneWireNode = TiptapNode.create({
  name: 'threeScene',
  group: 'blockContent',
  content: 'text*',
  marks: '',
  addAttributes: () => ({ ...executableAttributes, language: { default: 'typescript' } }),
});

const shaderStageWireNodes = SHADER_STAGE_DEFINITIONS.map(([stage, name]) =>
  TiptapNode.create({
    name,
    content: 'text*',
    marks: '',
    addAttributes: () =>
      ['bufferA', 'bufferB', 'bufferC', 'bufferD', 'cubemap', 'sound', 'image'].includes(stage)
        ? { channels: { default: null } }
        : {},
  }),
);

const ShaderWireNode = TiptapNode.create({
  name: 'shader',
  group: 'blockContent',
  content: SHADER_STAGE_DEFINITIONS.map(([, name]) => name).join(' '),
  marks: '',
  addAttributes: () => executableAttributes,
});

/** Headless schema for the official Yjs to ProseMirror decoder used by server conversion. */
export function createPostWireSchema() {
  const baseWireNodes = createTiptapWireExtensions().filter((extension) => extension.name !== 'paragraph');
  const executableNodes: Extensions = [
    PostParagraphWireNode,
    P5SketchWireNode,
    ThreeSceneWireNode,
    ShaderWireNode,
    ...shaderStageWireNodes,
  ];
  return getSchema([...baseWireNodes, ...executableNodes]);
}
