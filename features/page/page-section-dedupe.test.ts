import { describe, expect, it } from 'vitest';
import type { Section } from '@/lib/types/page-content';
import { dedupePageContent } from './page-section-dedupe';

function richText(id: string, text = id): Section {
  return { id, type: 'rich-text', settings: {}, props: { text } };
}

describe('dedupePageContent', () => {
  it('keeps only the first of two columns that share an id', () => {
    const child = richText('duplicate-child');
    const content = dedupePageContent({
      sections: [
        {
          id: 'columns-root',
          type: 'columns',
          settings: {},
          columns: [
            { id: 'duplicate-column', sections: [child] },
            { id: 'duplicate-column', sections: [child] },
          ],
        },
      ],
    });

    expect(content.sections).toHaveLength(1);
    expect(content.sections[0]?.columns).toEqual([{ id: 'duplicate-column', sections: [child] }]);
  });

  it('keeps the first root section of a duplicated id and drops the later one', () => {
    const content = dedupePageContent({
      sections: [richText('intro', 'first'), richText('outro'), richText('intro', 'second')],
    });

    expect(content.sections).toEqual([richText('intro', 'first'), richText('outro')]);
  });

  it('drops a duplicated section id inside one column', () => {
    const content = dedupePageContent({
      sections: [
        {
          id: 'columns-root',
          type: 'columns',
          settings: {},
          columns: [{ id: 'column', sections: [richText('child', 'first'), richText('child', 'second')] }],
        },
      ],
    });

    expect(content.sections[0]?.columns?.[0]?.sections).toEqual([richText('child', 'first')]);
  });

  it('keeps every section without an id', () => {
    const content = dedupePageContent({ sections: [richText('', 'first'), richText('', 'second')] });

    expect(content.sections).toEqual([richText('', 'first'), richText('', 'second')]);
  });
});
