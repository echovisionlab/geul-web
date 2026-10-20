import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';

const TEXT_FIELDS = new Set(['text', 'caption']);

function hasText(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasText);
  }
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return Object.entries(value).some(([key, field]) =>
    typeof field === 'string' ? TEXT_FIELDS.has(key) && field.trim() !== '' : hasText(field),
  );
}

function blockHasText(block: LocalizedRichTextBlock): boolean {
  return hasText(block.locale) || block.children.some(blockHasText);
}

/**
 * Whether the page body holds language-specific text (block text or captions). A page of maps, media
 * or collections reads the same in every language, so it does not announce a missing translation.
 */
export function pageHasLocalizedText(sections: readonly LocalizedPageSection[] | null | undefined): boolean {
  const visit = (section: LocalizedPageSection): boolean =>
    (section.kind === 'rich-text' && (section.richText ?? []).some(blockHasText)) ||
    (section.kind === 'columns' && section.columns.some((column) => column.sections.some(visit)));
  return (sections ?? []).some(visit);
}
