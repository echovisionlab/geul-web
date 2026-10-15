import { create } from '@bufbuild/protobuf';
import { RichTextInlineSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';

export const siteVariableLinkLabel =
  '{{site.title}} | {{site.url}}/tools/hwp | {{site.companyName}} | {{contact.legalEmail}} | {{contact.supportEmail}} | {{contact.privacyEmail}} | {{Site.title}} {{site.unknown}} {{ site.title }} {site.title}';
export const resolvedSiteVariableLinkLabel =
  'Rawsector | https://www.rawsector.com/tools/hwp | Example Studio Ltd. | legal@example.com | support@example.com | privacy@example.com | {{Site.title}} {{site.unknown}} {{ site.title }} {site.title}';
export const siteVariableLink = create(RichTextInlineSchema, {
  value: {
    case: 'link',
    value: { href: '/tools/hwp', content: [{ text: siteVariableLinkLabel, styles: { bold: true } }] },
  },
});
export const siteVariableLinkBlock: LocalizedRichTextBlock = {
  id: '10000000-0000-4000-8000-000000000402',
  kind: 'paragraph',
  base: { props: {} },
  locale: { props: {}, content: [siteVariableLink] },
  children: [],
} as unknown as LocalizedRichTextBlock;

/** Shared output-boundary cases also exercise lazy SSR and the legacy reader. */
export const siteVariableHrefCases = [
  { name: 'legal email', source: 'mailto:{{contact.legalEmail}}', expected: 'mailto:legal@example.com', settings: {} },
  {
    name: 'support email',
    source: 'mailto:{{contact.supportEmail}}',
    expected: 'mailto:support@example.com',
    settings: {},
  },
  {
    name: 'privacy email',
    source: 'mailto:{{contact.privacyEmail}}',
    expected: 'mailto:privacy@example.com',
    settings: {},
  },
  { name: 'empty email', source: 'mailto:{{contact.legalEmail}}', expected: undefined, settings: { legal_email: '' } },
  { name: 'site path', source: '{{site.url}}/about', expected: 'https://www.rawsector.com/about', settings: {} },
  { name: 'unknown token', source: 'mailto:{{contact.unknown}}', expected: 'mailto:{{contact.unknown}}', settings: {} },
  {
    name: 'one pass',
    source: 'mailto:{{contact.legalEmail}}',
    expected: 'mailto:{{contact.supportEmail}}',
    settings: { legal_email: '{{contact.supportEmail}}' },
  },
  {
    name: 'unsafe scheme',
    source: '{{site.url}}/about',
    expected: undefined,
    settings: { site_origin: ['java', 'script:alert(1)'].join('') },
  },
  {
    name: 'mailto newline',
    source: 'mailto:{{contact.legalEmail}}',
    expected: undefined,
    settings: { legal_email: 'legal@example.com\nBcc:other@example.com' },
  },
  {
    name: 'mailto space',
    source: 'mailto:{{contact.legalEmail}}',
    expected: undefined,
    settings: { legal_email: 'legal@example.com ' },
  },
] as const;

export function siteVariableHrefBlock(href: string): LocalizedRichTextBlock {
  return {
    ...siteVariableLinkBlock,
    locale: {
      props: {},
      content: [
        create(RichTextInlineSchema, {
          value: { case: 'link', value: { href, content: [{ text: 'Contact', styles: { bold: true } }] } },
        }),
      ],
    },
  } as LocalizedRichTextBlock;
}
