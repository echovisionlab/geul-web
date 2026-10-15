import { renderToStaticMarkup } from 'react-dom/server';
import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { LocalizedRichTextDocumentSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it } from 'vitest';
import { postSnapshotContent } from '@/lib/queries/editor-snapshot';
import { TiptapSnapshot } from './TiptapSnapshot';

const id = '10000000-0000-4000-8000-000000000001';

describe('SSR Tiptap snapshot', () => {
  it('uses the live codec and wire schema for localized, formatted body text', () => {
    const document = fromJson(LocalizedRichTextDocumentSchema, {
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      profile: 'RICH_TEXT_PROFILE_POST',
      locale: 'en',
      base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
      localeOverlay: {
        locale: 'en',
        blocks: [
          {
            blockId: id,
            paragraph: {
              props: {},
              content: [{ text: { text: 'Immediate <body>', styles: { bold: true } } }],
            },
          },
        ],
      },
    });
    const content = postSnapshotContent(document);
    expect(content.content?.[0].content?.[0].attrs?.id).toBe(id);
    const html = renderToStaticMarkup(<TiptapSnapshot content={content} locale="en" label="Body" />);
    expect(html).toContain('<strong>Immediate &lt;body&gt;</strong>');
    // React emits the canonical camel-case attribute; the DOM treats both spellings alike.
    expect(html.toLowerCase()).toContain('contenteditable="false"');
    expect(html).toContain('role="document"');
    expect(html).toContain('data-content-type="paragraph"');
    expect(html).toContain('data-node-type="blockContainer"');
  });

  it('renders an empty document without inventing a durable block ID', () => {
    const html = renderToStaticMarkup(
      <TiptapSnapshot content={{ type: 'doc', content: [{ type: 'blockGroup' }] }} locale="en" label="Body" />,
    );
    expect(html).toContain('data-node-type="blockGroup"');
    expect(html).not.toContain('data-id=');
  });
});
it('preserves merged table geometry and live cell presentation in SSR', () => {
  const html = renderToStaticMarkup(
    <TiptapSnapshot
      locale="en"
      label="Body"
      content={{
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id },
                content: [
                  {
                    type: 'table',
                    content: [
                      {
                        type: 'tableRow',
                        content: [
                          {
                            type: 'tableHeader',
                            attrs: { colspan: 2, rowspan: 2, colwidth: [40, 60] },
                            content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'Merged' }] }],
                          },
                        ],
                      },
                      { type: 'tableRow', content: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }}
    />,
  );
  expect(html).toMatch(/colspan="2"/i);
  expect(html).toMatch(/rowspan="2"/i);
  expect(html).toContain('<colgroup>');
  expect(html).toContain('width:40%');
  expect(html).not.toContain('data-colspan');
});
