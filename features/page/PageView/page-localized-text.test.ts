import { describe, expect, it } from 'vitest';
import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { pageHasLocalizedText } from './page-localized-text';

const block = (locale: unknown, children: unknown[] = []) => ({
  id: 'b',
  kind: 'paragraph',
  base: {},
  locale,
  children,
});
const richText = (...blocks: unknown[]) =>
  ({
    id: 's',
    kind: 'rich-text',
    settings: {},
    props: {},
    richText: blocks,
    columns: [],
  }) as unknown as LocalizedPageSection;

describe('pageHasLocalizedText', () => {
  it('finds text in blocks, nested blocks, captions and columns', () => {
    const paragraph = block({ content: [{ value: { case: 'text', value: { text: 'Hello' } } }] });
    expect(pageHasLocalizedText([richText(paragraph)])).toBe(true);
    expect(pageHasLocalizedText([richText(block({}, [paragraph]))])).toBe(true);
    expect(pageHasLocalizedText([richText(block({ caption: 'A field log' }))])).toBe(true);
    const columns = {
      id: 'c',
      kind: 'columns',
      settings: {},
      props: {},
      richText: null,
      columns: [{ id: 'col', ratio: 1, sections: [richText(paragraph)] }],
    } as unknown as LocalizedPageSection;
    expect(pageHasLocalizedText([columns])).toBe(true);
  });

  it('treats empty pages and language-neutral blocks as having no text', () => {
    expect(pageHasLocalizedText(null)).toBe(false);
    expect(pageHasLocalizedText([])).toBe(false);
    expect(
      pageHasLocalizedText([richText(block({ content: [{ value: { case: 'text', value: { text: '  ' } } }] }))]),
    ).toBe(false);
    expect(pageHasLocalizedText([richText(block({ mapStyle: 'light', url: 'https://example.com' }))])).toBe(false);
  });
});
