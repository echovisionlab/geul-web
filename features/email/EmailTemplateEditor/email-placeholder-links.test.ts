import {
  normalizeRichTextHref,
  normalizeRichTextHtmlLinks,
  normalizeRichTextHtmlLinksFromBlocks,
} from '@echovisionlab/geul-common/editor/link-normalization';
import { describe, expect, it } from 'vitest';
import { normalizeEmailPlaceholderHref, normalizeEmailPlaceholderLinkBlocks } from './email-placeholder-links';

describe('normalizeRichTextHref', () => {
  it('removes protocol prefix from placeholder hrefs', () => {
    expect(normalizeRichTextHref('https://{{verification_url}}')).toBe('{{verification_url}}');
    expect(normalizeRichTextHref('http://{{verification_url}}')).toBe('{{verification_url}}');
  });

  it('deduplicates malformed double protocols', () => {
    expect(normalizeRichTextHref('https://https://example.com/verify')).toBe('https://example.com/verify');
    expect(normalizeRichTextHref('https://http://studio.example.com')).toBe('https://studio.example.com');
    expect(normalizeRichTextHref('http://https://studio.example.com')).toBe('http://studio.example.com');
  });

  it('preserves intentional and scheme-less hrefs', () => {
    expect(normalizeRichTextHref('studio.example.com')).toBe('studio.example.com');
    expect(normalizeRichTextHref('http://studio.example.com')).toBe('http://studio.example.com');
    expect(normalizeRichTextHref('https://studio.example.com')).toBe('https://studio.example.com');
  });

  it('preserves allowed schemes and drops hostile schemes', () => {
    const scriptHref = `java${'script:alert(1)'}`;
    const obfuscatedScriptHref = `java\nscript:alert(1)`;
    const prefixedScriptHref = `https://${scriptHref}`;

    expect(normalizeRichTextHref('mailto:test@example.com')).toBe('mailto:test@example.com');
    expect(normalizeRichTextHref('tel:+821012345678')).toBe('tel:+821012345678');
    expect(normalizeRichTextHref(scriptHref)).toBe('');
    expect(normalizeRichTextHref(obfuscatedScriptHref)).toBe('');
    expect(normalizeRichTextHref('javascript&#58alert(1)')).toBe('');
    expect(normalizeRichTextHref('jav&#x61script:alert(1)')).toBe('');
    expect(normalizeRichTextHref('javascript&#9999999999999;alert(1)')).toBe('javascript&#9999999999999;alert(1)');
    expect(normalizeRichTextHref(prefixedScriptHref)).toBe(prefixedScriptHref);
  });
});

describe('normalizeRichTextHtmlLinks', () => {
  it('normalizes href attributes without touching other html', () => {
    expect(normalizeRichTextHtmlLinks('<p><a href="https://{{verification_url}}">{{verification_url}}</a></p>')).toBe(
      '<p><a href="{{verification_url}}">{{verification_url}}</a></p>',
    );

    expect(normalizeRichTextHtmlLinks("<p><a href='https://https://example.com'>Link</a></p>")).toBe(
      "<p><a href='https://example.com'>Link</a></p>",
    );
  });

  it('removes unsafe href attributes', () => {
    const scriptHref = `java${'script:alert(1)'}`;

    expect(normalizeRichTextHtmlLinks(`<p><a href="${scriptHref}">Link</a></p>`)).toBe('<p><a >Link</a></p>');
    expect(normalizeRichTextHtmlLinks(`<p><a href="java\nscript:alert(1)">Link</a></p>`)).toBe('<p><a >Link</a></p>');
    expect(normalizeRichTextHtmlLinks('<p><a href="jav&#x61;script:alert(1)">Link</a></p>')).toBe(
      '<p><a >Link</a></p>',
    );
    expect(normalizeRichTextHtmlLinks('<p><a href="javascript&colon;alert(1)">Link</a></p>')).toBe(
      '<p><a >Link</a></p>',
    );
    expect(normalizeRichTextHtmlLinks('<p><a href="javascript&#58alert(1)">Link</a></p>')).toBe('<p><a >Link</a></p>');
    expect(normalizeRichTextHtmlLinks('<p><a href="jav&#x61script:alert(1)">Link</a></p>')).toBe('<p><a >Link</a></p>');
    expect(normalizeRichTextHtmlLinks('<p><a href=javascript:alert(1)>Link</a></p>')).toBe('<p><a >Link</a></p>');
  });

  it('ignores non-href attributes and malformed numeric entities safely', () => {
    expect(normalizeRichTextHtmlLinks('<p><span data-href="javascript:alert(1)">Label</span></p>')).toBe(
      '<p><span data-href="javascript:alert(1)">Label</span></p>',
    );

    expect(normalizeRichTextHtmlLinks('<p><a href="javascript&#9999999999999;alert(1)">Link</a></p>')).toBe(
      '<p><a href="javascript&#9999999999999;alert(1)">Link</a></p>',
    );
  });
});

describe('normalizeRichTextHtmlLinksFromBlocks', () => {
  it('restores scheme-less hrefs from block data instead of keeping auto-prefixed html', () => {
    const blocks = [
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'studio.example.com',
            content: [{ type: 'text', text: 'studio.example.com', styles: {} }],
          },
        ],
        children: [],
      },
    ];

    expect(
      normalizeRichTextHtmlLinksFromBlocks(
        blocks,
        '<p><a target="_blank" href="https://studio.example.com">studio.example.com</a></p>',
      ),
    ).toBe('<p><a target="_blank" href="studio.example.com">studio.example.com</a></p>');
  });

  it('keeps explicit protocols from block data while still repairing malformed output', () => {
    const blocks = [
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'http://studio.example.com',
            content: [{ type: 'text', text: 'http://studio.example.com', styles: {} }],
          },
        ],
        children: [],
      },
    ];

    expect(
      normalizeRichTextHtmlLinksFromBlocks(
        blocks,
        '<p><a href="https://http://studio.example.com">http://studio.example.com</a></p>',
      ),
    ).toBe('<p><a href="https://studio.example.com">http://studio.example.com</a></p>');
  });

  it('does not restore unsafe hrefs from block data', () => {
    const scriptHref = `java${'script:alert(1)'}`;
    const blocks = [
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: scriptHref,
            content: [{ type: 'text', text: 'bad', styles: {} }],
          },
        ],
        children: [],
      },
    ];

    expect(normalizeRichTextHtmlLinksFromBlocks(blocks, `<p><a href="${scriptHref}">bad</a></p>`)).toBe(
      '<p><a >bad</a></p>',
    );
  });
});

describe('normalizeEmailPlaceholderHref', () => {
  it('removes protocol prefix from placeholder hrefs', () => {
    expect(normalizeEmailPlaceholderHref('https://{{verification_url}}')).toBe('{{verification_url}}');
    expect(normalizeEmailPlaceholderHref('http://{{verification_url}}')).toBe('{{verification_url}}');
  });

  it('leaves normal urls unchanged', () => {
    expect(normalizeEmailPlaceholderHref('https://example.com/verify')).toBe('https://example.com/verify');
  });
});

describe('normalizeEmailPlaceholderLinkBlocks', () => {
  it('normalizes inline link href placeholders for email editors only', () => {
    const blocks = [
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            href: 'https://{{verification_url}}',
            content: [
              {
                type: 'text',
                text: '{{verification_url}}',
                styles: {},
              },
            ],
          },
        ],
        children: [],
      },
      {
        id: 'paragraph-2',
        type: 'paragraph',
        props: {},
        content: [
          {
            type: 'link',
            props: { href: 'https://{{request_url}}' },
            content: [
              {
                type: 'text',
                text: 'Recover',
                styles: {},
              },
            ],
          },
        ],
        children: [],
      },
    ];

    const result = normalizeEmailPlaceholderLinkBlocks(blocks);

    expect(result.changed).toBe(true);
    expect((result.blocks[0].content?.[0] as { href: string }).href).toBe('{{verification_url}}');
    expect((result.blocks[1].content?.[0] as { props: { href: string } }).props.href).toBe('{{request_url}}');
  });
});
