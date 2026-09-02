import type { Block, InlineContent } from '@/lib/types/page-content';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import type { RichTextInline } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export interface TocItem {
  id: string;
  label: string;
  level: number;
}

export interface HtmlTocDocument {
  html: string;
  tocItems: TocItem[];
}

export function buildBlockTocItems(blocks: Block[] | null | undefined): TocItem[] {
  const tocItems: TocItem[] = [];

  const visit = (block: Block) => {
    if (block.type === 'heading') {
      const label = getInlinePlainText(block.content).trim();
      if (label) {
        tocItems.push({
          id: block.id,
          label,
          level: Number(block.props.level) || 1,
        });
      }
    }

    block.children?.forEach(visit);
  };

  blocks?.forEach(visit);
  return tocItems;
}

export function buildGeneratedBlockTocItems(blocks: readonly LocalizedRichTextBlock[] | null | undefined): TocItem[] {
  const items: TocItem[] = [];
  const visit = (block: LocalizedRichTextBlock) => {
    if (block.kind === 'heading') {
      const label = getGeneratedInlinePlainText(block.locale.content).trim();
      if (label) {
        items.push({ id: block.id, label, level: block.base.props?.level ?? 1 });
      }
    }
    block.children.forEach(visit);
  };
  blocks?.forEach(visit);
  return items;
}

function getGeneratedInlinePlainText(content: readonly RichTextInline[]): string {
  return content
    .map((item) => {
      switch (item.value.case) {
        case 'text':
          return item.value.value.text;
        case 'link':
          return item.value.value.content.map((text) => text.text).join('');
        case 'mathInline':
          return item.value.value.source;
        case 'hardBreak':
          return '\n';
        case undefined:
          return '';
      }
      return '';
    })
    .join('');
}

export function buildHtmlTocDocument(html: string | null | undefined): HtmlTocDocument {
  if (!html || typeof document === 'undefined') {
    return { html: html ?? '', tocItems: [] };
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const usedIds = new Set<string>();
  const tocItems: TocItem[] = [];
  template.content.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading, index) => {
    const label = heading.textContent?.trim();
    if (!label) {
      return;
    }

    const id = resolveHeadingId(heading.getAttribute('id'), label, index, usedIds);
    heading.setAttribute('id', id);
    tocItems.push({
      id,
      label,
      level: Number(heading.tagName.slice(1)) || 1,
    });
  });

  return {
    html: template.innerHTML,
    tocItems,
  };
}

export function getInlinePlainText(content: InlineContent[] | undefined): string {
  return (
    content
      ?.map((item) => {
        if (item.type === 'text') {
          return item.text ?? '';
        }

        if (item.type === 'link') {
          return getInlinePlainText(item.content);
        }

        if (item.type === 'mathInline') {
          return String(item.props?.latex ?? '');
        }

        return '';
      })
      .join('') ?? ''
  );
}

function resolveHeadingId(existingId: string | null, label: string, index: number, usedIds: Set<string>): string {
  const baseId = existingId || slugifyTocHeading(label) || `heading-${index + 1}`;
  let id = baseId;
  let counter = 1;
  while (usedIds.has(id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }
  usedIds.add(id);
  return id;
}

function slugifyTocHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
