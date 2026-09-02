import type { SectionMeta } from '@/features/page/PageEditor/types';
import type { PageContent, Section } from '@/lib/types/page-content';

interface PageSectionLike {
  id: string;
  type: string;
  columns?: Array<{
    id: string;
    sections: PageSectionLike[];
  }>;
}

type DedupableSection = PageSectionLike & (Section | SectionMeta);
type DedupableColumn = NonNullable<DedupableSection['columns']>[number];

function dedupeColumns<TSection extends DedupableSection>(
  columns: NonNullable<TSection['columns']>,
): NonNullable<TSection['columns']> {
  const seenColumnIds = new Set<string>();
  const deduped: Array<DedupableColumn> = [];

  for (const column of columns) {
    const columnId = typeof column.id === 'string' ? column.id : '';
    if (columnId && seenColumnIds.has(columnId)) {
      continue;
    }
    if (columnId) {
      seenColumnIds.add(columnId);
    }

    deduped.push({
      ...column,
      sections: dedupePageSections(column.sections as TSection[]),
    });
  }

  return deduped as NonNullable<TSection['columns']>;
}

export function dedupePageSections<TSection extends DedupableSection>(sections: readonly TSection[]): TSection[] {
  const seenSectionIds = new Set<string>();
  const deduped: TSection[] = [];

  for (const section of sections) {
    const sectionId = typeof section.id === 'string' ? section.id : '';
    if (sectionId && seenSectionIds.has(sectionId)) {
      continue;
    }
    if (sectionId) {
      seenSectionIds.add(sectionId);
    }

    if (section.type === 'columns' && Array.isArray(section.columns)) {
      deduped.push({
        ...section,
        columns: dedupeColumns(section.columns),
      });
      continue;
    }

    deduped.push(section);
  }

  return deduped;
}

export function dedupePageContent(content: PageContent): PageContent {
  return {
    ...content,
    sections: dedupePageSections(content.sections),
  };
}
