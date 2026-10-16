import { getSchema } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { policyTiptapDocumentToHtml, validatePolicyTiptapDocument } from './policy-document';

function container(id: string, content: Record<string, unknown>, children: Record<string, unknown>[] = []) {
  return {
    type: 'blockContainer',
    attrs: { id },
    content: [content, ...(children.length > 0 ? [{ type: 'blockGroup', content: children }] : [])],
  };
}

function documentWith(...blocks: Record<string, unknown>[]) {
  const schema = getSchema(createTiptapWireExtensions());
  return schema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks }],
  });
}

describe('policy document validation and serialization', () => {
  it('keeps policy JSON compatible while serializing supported policy content and normalized links', () => {
    const document = documentWith(
      container('heading', { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Terms' }] }),
      container('bullet-one', { type: 'bulletListItem', content: [{ type: 'text', text: 'First' }] }),
      container('bullet-two', {
        type: 'bulletListItem',
        content: [{ type: 'text', text: 'Second', marks: [{ type: 'bold' }] }],
      }),
      container('quote', { type: 'quote', content: [{ type: 'text', text: 'Quoted' }] }),
      container('code', { type: 'codeBlock', content: [{ type: 'text', text: 'const terms = true;' }] }),
      container('table', {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'Scope' }] }],
              },
            ],
          },
        ],
      }),
      container('link', {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Unsafe link',
            marks: [{ type: 'link', attrs: { href: ['java', 'script:alert(1)'].join('') } }],
          },
        ],
      }),
    );

    expect(validatePolicyTiptapDocument(document)).toBeNull();
    expect(policyTiptapDocumentToHtml(document)).toBe(
      '<h2>Terms</h2><ul><li>First</li><li><strong>Second</strong></li></ul><blockquote>Quoted</blockquote><pre><code>const terms = true;</code></pre><table><tbody><tr><th><p>Scope</p></th></tr></tbody></table><p>Unsafe link</p>',
    );
  });

  it('renders headings below a document title one element lower with the authored level', () => {
    const document = documentWith(
      container('heading', { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Scope' }] }),
    );

    expect(policyTiptapDocumentToHtml(document)).toBe('<h1>Scope</h1>');
    expect(policyTiptapDocumentToHtml(document, { headingParentLevel: 1 })).toBe(
      '<h2 data-heading-level="1">Scope</h2>',
    );
  });

  it('rejects policy-disallowed nodes instead of accepting or exporting them', () => {
    const document = documentWith(container('file', { type: 'file', attrs: { fileId: 'file-1' } }));

    expect(validatePolicyTiptapDocument(document)).toContain('nodes: file');
    expect(() => policyTiptapDocumentToHtml(document)).toThrow('policy editor does not support');
  });

  it('exports safe legacy hex color presentation without styling arbitrary durable strings', () => {
    const document = documentWith(
      container('colors', {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'safe', marks: [{ type: 'textColor', attrs: { stringValue: '#b02d23' } }] },
          { type: 'text', text: 'semantic', marks: [{ type: 'backgroundColor', attrs: { stringValue: 'blue' } }] },
          {
            type: 'text',
            text: 'unsafe',
            marks: [{ type: 'textColor', attrs: { stringValue: 'red;background:url(x)' } }],
          },
        ],
      }),
    );

    const html = policyTiptapDocumentToHtml(document);
    expect(html).toContain('data-style-value="#b02d23" style="color:#b02d23"');
    expect(html).toContain('data-style-value="blue">semantic</span>');
    expect(html).toContain('data-style-value="red;background:url(x)">unsafe</span>');
    expect(html).not.toContain('style="color:red;background');
  });

  it('serializes a Callout as a semantic wrapper around its nested content', () => {
    const document = documentWith(
      container(
        'callout',
        {
          type: 'callout',
          attrs: { icon: 'ℹ️', backgroundColor: 'blue', textColor: 'default' },
          content: [{ type: 'text', text: 'Policy note' }],
        },
        [container('callout-copy', { type: 'paragraph', content: [{ type: 'text', text: 'Nested detail' }] })],
      ),
    );

    expect(policyTiptapDocumentToHtml(document)).toBe(
      '<aside data-callout="" data-bg-color="blue" data-text-color="default"><span data-callout-icon="" aria-hidden="true">ℹ️</span><div data-callout-content=""><div data-callout-copy="">Policy note</div><p>Nested detail</p></div></aside>',
    );
  });
});

it('preserves hard breaks, including inside styled links, in public policy HTML', () => {
  const document = documentWith(
    container('paragraph', {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'a',
          marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com' } }],
        },
        { type: 'hardBreak' },
        { type: 'text', text: 'b' },
      ],
    }),
  );
  expect(policyTiptapDocumentToHtml(document)).toBe(
    '<p><strong><a href="https://example.com">a</a></strong><br />b</p>',
  );
});
