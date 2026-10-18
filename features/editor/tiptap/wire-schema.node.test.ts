import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { editorSchema } from '@/features/editor/schema';
import { createP5SketchExtension } from './p5';
import { KOREAN_P5_SKETCH_LABELS } from './p5/p5-labels.fixtures';
import { createMermaidExtension } from './mermaid/mermaid-extension';
import { createShaderExtension } from './shader';
import { createThreeSceneExtension, KOREAN_THREE_SCENE_LABELS } from './three';
import { createTiptapWireExtensions } from './wire-schema';

function attributeDefaults(attributes: Record<string, { default?: unknown }>) {
  return Object.fromEntries(Object.entries(attributes).map(([name, attribute]) => [name, attribute.default]));
}

const wireSchema = getSchema([
  ...createTiptapWireExtensions(),
  createP5SketchExtension({ labels: KOREAN_P5_SKETCH_LABELS }),
  createThreeSceneExtension({ labels: KOREAN_THREE_SCENE_LABELS }),
  createShaderExtension(),
  createMermaidExtension(),
]);

describe('Tiptap wire schema', () => {
  it('matches the durable editor node names, content expressions, and attributes', () => {
    const structuralNodes = {
      doc: { group: '', content: 'blockGroup', attrs: {} },
      blockGroup: { group: 'childContainer', content: 'blockGroupChild+', attrs: {} },
      blockContainer: {
        group: 'blockGroupChild bnBlock',
        content: 'blockContent blockGroup?',
        attrs: { id: null },
      },
      tableParagraph: { group: 'tableContent', content: 'inline*', attrs: {} },
      tableHeader: {
        group: '',
        content: 'tableContent+',
        attrs: {
          id: null,
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          colspan: 1,
          rowspan: 1,
          colwidth: null,
        },
      },
      tableCell: {
        group: '',
        content: 'tableContent+',
        attrs: {
          id: null,
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          colspan: 1,
          rowspan: 1,
          colwidth: null,
        },
      },
      tableRow: { group: '', content: '(tableCell | tableHeader)+', attrs: { id: null } },
      text: { group: 'inline', content: '', attrs: {} },
      hardBreak: { group: 'inline', content: '', attrs: {} },
      siteVariable: { group: 'inline', content: '', attrs: { key: 'site.title', linked: false } },
      mathInline: { group: 'inline', content: 'text*', attrs: {} },
      emoji: { group: 'inline', content: '', attrs: { name: null } },
      externalVideo: {
        group: 'blockContent',
        content: '',
        attrs: {
          backgroundColor: 'default',
          textColor: 'default',
          textAlignment: 'left',
          previewWidth: 100,
          aspectRatio: 'auto',
          url: '',
          label: '',
          sourceContent: [],
        },
      },
      shaderCommon: { group: '', content: 'text*', attrs: {} },
      shaderVertex: { group: '', content: 'text*', attrs: {} },
      shaderBufferA: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferB: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferC: { group: '', content: 'text*', attrs: { channels: null } },
      shaderBufferD: { group: '', content: 'text*', attrs: { channels: null } },
      shaderCubemap: { group: '', content: 'text*', attrs: { channels: null } },
      shaderSound: { group: '', content: 'text*', attrs: { channels: null } },
      shaderImage: { group: '', content: 'text*', attrs: { channels: null } },
    } as const;
    const expectedNodeNames = [...Object.keys(editorSchema.blockSchema), ...Object.keys(structuralNodes)].sort();

    expect(Object.keys(wireSchema.nodes).sort()).toEqual(expectedNodeNames);

    for (const [name, blockSpec] of Object.entries(editorSchema.blockSchema)) {
      const node = wireSchema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node.spec.group ?? '', `${name} group`).toBe('blockContent');
      expect(String(node.spec.content ?? ''), `${name} content`).toBe(blockSpec.content);
      const expectedAttributes = Object.fromEntries(
        Object.entries(blockSpec.props).map(([prop, spec]) => [prop, spec.default]),
      );
      expect(attributeDefaults(node.spec.attrs ?? {}), `${name} attributes`).toEqual(
        name === 'map'
          ? { ...expectedAttributes, mapPlaceId: '', location: '' }
          : name === 'file'
            ? { ...expectedAttributes, attachment: null }
            : expectedAttributes,
      );
    }

    for (const [name, expected] of Object.entries(structuralNodes)) {
      const node = wireSchema.nodes[name];
      expect(node, name).toBeDefined();
      expect(node.spec.group ?? '', `${name} group`).toBe(expected.group);
      expect(String(node.spec.content ?? ''), `${name} content`).toBe(expected.content);
      expect(attributeDefaults(node.spec.attrs ?? {}), `${name} attributes`).toEqual(expected.attrs);
    }
    expect(wireSchema.nodes.mathInline?.spec.marks).toBe('');

    const expectedMarks = {
      bold: {},
      italic: {},
      underline: {},
      strike: {},
      code: {},
      textColor: { stringValue: undefined },
      backgroundColor: { stringValue: undefined },
      link: { href: null },
    };
    expect(Object.keys(wireSchema.marks).sort()).toEqual(Object.keys(expectedMarks).sort());
    for (const [name, expectedAttrs] of Object.entries(expectedMarks)) {
      expect(attributeDefaults(wireSchema.marks[name]?.spec.attrs ?? {}), `${name} attributes`).toEqual(expectedAttrs);
    }
  });
});
