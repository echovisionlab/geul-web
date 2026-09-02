import * as Y from 'yjs';

type WireInline =
  | { type: 'text'; text: string; styles?: Record<string, unknown> }
  | { type: 'link'; href: string; content: WireInline[] };

export interface WireBlockFixture {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: WireInline[];
  shaderStages?: Array<{
    type:
      | 'shaderCommon'
      | 'shaderVertex'
      | 'shaderBufferA'
      | 'shaderBufferB'
      | 'shaderBufferC'
      | 'shaderBufferD'
      | 'shaderCubemap'
      | 'shaderSound'
      | 'shaderImage';
    props?: Record<string, unknown>;
    content?: WireInline[];
  }>;
  children?: WireBlockFixture[];
}

function stringAttributes(element: Y.XmlElement, props: Record<string, unknown>) {
  for (const [name, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) {
      element.setAttribute(name, String(value));
    }
  }
}

function inlineText(content: WireInline[]): Y.XmlText {
  const text = new Y.XmlText();
  for (const node of content) {
    if (node.type === 'text') {
      text.applyDelta([{ insert: node.text, attributes: node.styles }]);
      continue;
    }
    if (node.type === 'link') {
      text.applyDelta([
        {
          insert: node.content.map((child) => (child.type === 'text' ? child.text : '')).join(''),
          attributes: { link: { href: node.href } },
        },
      ]);
      continue;
    }
    throw new Error(`Unsupported test inline fixture: ${(node as { type: string }).type}`);
  }
  return text;
}

function appendBlock(group: Y.XmlElement, block: WireBlockFixture) {
  const container = new Y.XmlElement('blockContainer');
  container.setAttribute('id', block.id);
  const content = new Y.XmlElement(block.type);
  stringAttributes(content, block.props ?? {});
  if (block.content?.length) {
    content.insert(0, [inlineText(block.content)]);
  }
  if (block.shaderStages?.length) {
    const stages = block.shaderStages.map((stage) => {
      const stageElement = new Y.XmlElement(stage.type);
      for (const [name, value] of Object.entries(stage.props ?? {})) {
        stageElement.setAttribute(name, value as string);
      }
      if (stage.content?.length) {
        stageElement.insert(0, [inlineText(stage.content)]);
      }
      return stageElement;
    });
    content.insert(0, stages);
  }
  container.insert(0, [content]);
  if (block.children?.length) {
    const children = new Y.XmlElement('blockGroup');
    container.insert(1, [children]);
    for (const child of block.children) {
      appendBlock(children, child);
    }
  }
  group.insert(group.length, [container]);
}

/** Creates the durable Geul ProseMirror wire shape used by collaboration fixtures. */
export function encodeLegacyWireDocument(blocks: WireBlockFixture[]): Buffer {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment('document-store');
  const group = new Y.XmlElement('blockGroup');
  fragment.insert(0, [group]);
  for (const block of blocks) {
    appendBlock(group, block);
  }
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}
