import { describe, expect, it } from 'vitest';
import { create } from '@bufbuild/protobuf';
import { RichTextInlineSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableContext } from '@/lib/site-variables';
import { resolvedSiteVariableLinkLabel, siteVariableLink, siteVariableLinkBlock } from '@/test/site-variable-link';
import { localizedRichTextInlinePlainText, localizedRichTextPlainText } from './localized-rich-text-text';

const context = siteVariableContext(siteVariableManifest.settings);

describe('localized rich-text plain-text output', () => {
  it('resolves exactly the six link-label tokens using the caller settings snapshot', () => {
    expect(localizedRichTextInlinePlainText([siteVariableLink], context)).toBe(resolvedSiteVariableLinkLabel);
    expect(localizedRichTextPlainText([siteVariableLinkBlock], context)).toBe(resolvedSiteVariableLinkLabel);
    expect(() => localizedRichTextInlinePlainText([siteVariableLink])).toThrow('Site variable context is required');
  });

  it('preserves ordinary text and unknown tokens without a context', () => {
    const text = create(RichTextInlineSchema, { value: { case: 'text', value: { text: '{{site.title}}' } } });
    const link = create(RichTextInlineSchema, {
      value: {
        case: 'link',
        value: {
          href: '/tools/hwp',
          content: [{ text: '{{site.unknown}} {{Site.title}}' }],
        },
      },
    });
    expect(localizedRichTextInlinePlainText([text, link])).toBe('{{site.title}}{{site.unknown}} {{Site.title}}');
  });

  it('keeps resolved values as data, including empty values and token-like text', () => {
    const result = localizedRichTextPlainText([siteVariableLinkBlock], {
      ...context,
      siteTitle: '<b>& {{site.url}}',
      legalEmail: '',
    });
    expect(result).toContain('<b>& {{site.url}} | https://www.rawsector.com/tools/hwp');
    expect(result).toContain('Example Studio Ltd. |  | support@example.com');
  });
});
