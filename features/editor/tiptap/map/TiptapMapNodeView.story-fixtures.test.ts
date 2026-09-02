import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from 'y-prosemirror';
import type { TiptapSlashActionContext } from '../slash';
import { createTiptapWireExtensions } from '../wire-schema';
import {
  captureMapStoryAnchor,
  countMapStoryNodes,
  getPrimaryMapStoryPlace,
  insertMapAtCapturedSlashAnchor,
  readMapStoryDocument,
} from './TiptapMapNodeView.story-fixtures';

function setup(text: string) {
  const yDoc = new Y.Doc();
  const fragment = yDoc.getXmlFragment('default');
  prosemirrorJSONToYXmlFragment(
    getSchema(createTiptapWireExtensions()),
    {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [
            {
              type: 'blockContainer',
              attrs: { id: 'map-anchor' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
            },
          ],
        },
      ],
    },
    fragment,
  );
  const snapshot = captureMapStoryAnchor(fragment, 'map-anchor');
  if (!snapshot) {
    throw new Error('Map slash anchor fixture is missing');
  }
  return { yDoc, fragment, snapshot };
}

function context(placement: 'replace' | 'after', triggerText: string): TiptapSlashActionContext {
  return {
    blockId: 'map-anchor',
    targetBlockId: placement === 'replace' ? 'map-anchor' : 'map-result',
    placement,
    triggerText,
    anchorContentJSON: JSON.stringify({ type: 'paragraph', text: triggerText }),
    range: { from: 0, to: 0, contentPosition: 0, blockId: 'map-anchor' },
  };
}

function yParagraphBlock(id: string, value: string): Y.XmlElement {
  const block = new Y.XmlElement('blockContainer');
  block.setAttribute('id', id);
  const paragraph = new Y.XmlElement('paragraph');
  const text = new Y.XmlText();
  text.insert(0, value);
  paragraph.insert(0, [text]);
  block.insert(0, [paragraph]);
  return block;
}

describe('map Story slash success boundary', () => {
  it('keeps a prefix block and inserts the successful map immediately after it', () => {
    const mounted = setup('Hello /map');
    expect(
      insertMapAtCapturedSlashAnchor(
        mounted.yDoc,
        mounted.fragment,
        context('after', '/map'),
        mounted.snapshot,
        getPrimaryMapStoryPlace(),
      ),
    ).toBe(true);

    const blocks = readMapStoryDocument(mounted.fragment).content[0]?.content ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ attrs: { id: 'map-anchor' }, content: [{ content: [{ text: 'Hello ' }] }] });
    expect(blocks[1]).toMatchObject({ attrs: { id: 'map-result' }, content: [{ type: 'map' }] });
    expect(countMapStoryNodes(readMapStoryDocument(mounted.fragment))).toBe(1);
    mounted.yDoc.destroy();
  });

  it('makes cancel a no-op and rejects a changed exact anchor', () => {
    const mounted = setup('Hello /map');
    const beforeCancel = readMapStoryDocument(mounted.fragment);
    expect(readMapStoryDocument(mounted.fragment)).toEqual(beforeCancel);

    const block = mounted.fragment.toArray()[0] as Y.XmlElement;
    const group = block.nodeName === 'blockGroup' ? block : (block.get(0) as Y.XmlElement);
    const container = group.get(0) as Y.XmlElement;
    const paragraph = container.get(0) as Y.XmlElement;
    const text = paragraph.get(0) as Y.XmlText;
    text.insert(text.length, ' changed');
    const staleState = readMapStoryDocument(mounted.fragment);

    expect(
      insertMapAtCapturedSlashAnchor(
        mounted.yDoc,
        mounted.fragment,
        context('after', '/map'),
        mounted.snapshot,
        getPrimaryMapStoryPlace(),
      ),
    ).toBe(false);
    expect(readMapStoryDocument(mounted.fragment)).toEqual(staleState);
    mounted.yDoc.destroy();
  });

  it('touches only the containing block content and preserves its nested blockGroup', () => {
    const mounted = setup('/map');
    const group = mounted.fragment.get(0) as Y.XmlElement;
    const container = group.get(0) as Y.XmlElement;
    const nestedGroup = new Y.XmlElement('blockGroup');
    const nestedBlock = new Y.XmlElement('blockContainer');
    nestedBlock.setAttribute('id', 'nested-child');
    const nestedParagraph = new Y.XmlElement('paragraph');
    const nestedText = new Y.XmlText();
    nestedText.insert(0, 'Nested');
    nestedParagraph.insert(0, [nestedText]);
    nestedBlock.insert(0, [nestedParagraph]);
    nestedGroup.insert(0, [nestedBlock]);
    container.insert(container.length, [nestedGroup]);
    const captured = captureMapStoryAnchor(mounted.fragment, 'map-anchor');
    if (!captured) {
      throw new Error('Nested map anchor fixture is missing');
    }

    expect(
      insertMapAtCapturedSlashAnchor(
        mounted.yDoc,
        mounted.fragment,
        context('replace', '/map'),
        captured,
        getPrimaryMapStoryPlace(),
      ),
    ).toBe(true);
    const result = readMapStoryDocument(mounted.fragment).content[0]?.content?.[0];
    expect(result?.content?.[0]).toMatchObject({ type: 'map' });
    expect(result?.content?.[1]).toMatchObject({
      type: 'blockGroup',
      content: [{ attrs: { id: 'nested-child' }, content: [{ content: [{ text: 'Nested' }] }] }],
    });
    mounted.yDoc.destroy();
  });

  it('falls back after the current cursor block when the captured map block disappeared', () => {
    const mounted = setup('Hello /map');
    const group = mounted.fragment.get(0) as Y.XmlElement;
    group.insert(1, [yParagraphBlock('cursor', 'Cursor'), yParagraphBlock('tail', 'Tail')]);
    group.delete(0, 1);

    expect(
      insertMapAtCapturedSlashAnchor(
        mounted.yDoc,
        mounted.fragment,
        context('after', '/map'),
        mounted.snapshot,
        getPrimaryMapStoryPlace(),
        'cursor',
      ),
    ).toBe(true);
    const blocks = readMapStoryDocument(mounted.fragment).content[0]?.content ?? [];
    expect(blocks.map((block) => block.attrs?.id)).toEqual(['cursor', 'map-result', 'tail']);
    expect(blocks[1]).toMatchObject({ content: [{ type: 'map' }] });
    mounted.yDoc.destroy();
  });

  it('falls back to the document end when the captured block and cursor are both gone', () => {
    const mounted = setup('Hello /map');
    const group = mounted.fragment.get(0) as Y.XmlElement;
    group.insert(1, [yParagraphBlock('tail', 'Tail')]);
    group.delete(0, 1);

    expect(
      insertMapAtCapturedSlashAnchor(
        mounted.yDoc,
        mounted.fragment,
        context('after', '/map'),
        mounted.snapshot,
        getPrimaryMapStoryPlace(),
        'missing-cursor',
      ),
    ).toBe(true);
    const blocks = readMapStoryDocument(mounted.fragment).content[0]?.content ?? [];
    expect(blocks.map((block) => block.attrs?.id)).toEqual(['tail', 'map-result']);
    mounted.yDoc.destroy();
  });
});
