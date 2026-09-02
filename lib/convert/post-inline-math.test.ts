import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { convertPostContent } from './post';

function inlineMathDocument(source: string, legacyAttribute = ''): Buffer {
  const document = new Y.Doc();
  const fragment = document.getXmlFragment('document-store');
  const group = new Y.XmlElement('blockGroup');
  const container = new Y.XmlElement('blockContainer');
  const paragraph = new Y.XmlElement('paragraph');
  const math = new Y.XmlElement('mathInline');
  const before = new Y.XmlText();
  const after = new Y.XmlText();
  container.setAttribute('id', 'inline-math');
  before.insert(0, 'Hello ');
  after.insert(0, ' world');
  if (legacyAttribute) {
    math.setAttribute('latex', legacyAttribute);
  }
  if (source) {
    const sourceText = new Y.XmlText();
    sourceText.insert(0, source);
    math.insert(0, [sourceText]);
  }
  paragraph.insert(0, [before, math, after]);
  container.insert(0, [paragraph]);
  group.insert(0, [container]);
  fragment.insert(0, [group]);
  return Buffer.from(Y.encodeStateAsUpdate(document));
}

describe('convertPostContent inline math', () => {
  it('projects plain-text source to durable JSON, materialized HTML, and Markdown', async () => {
    const converted = await convertPostContent(inlineMathDocument('E^MC2'), 'post-1');
    const blocks = converted.json as Array<{ content?: unknown[] }>;

    expect(blocks[0]?.content).toEqual([
      { type: 'text', text: 'Hello ', styles: {} },
      { type: 'mathInline', props: { latex: 'E^MC2' } },
      { type: 'text', text: ' world', styles: {} },
    ]);
    expect(converted.html).toContain('class="math-inline" data-latex="E^MC2"');
    expect(converted.html).toContain('>E^MC2</span>');
    expect(converted.markdown).toBe('Hello $E^MC2$ world\n');
  });

  it('keeps the legacy attribute-only source readable during migration', async () => {
    const converted = await convertPostContent(inlineMathDocument('', 'x^2'), 'post-1');
    const blocks = converted.json as Array<{ content?: unknown[] }>;

    expect(blocks[0]?.content).toContainEqual({ type: 'mathInline', props: { latex: 'x^2' } });
  });
});
