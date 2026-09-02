import type { RichTextInline, RichTextStyledText } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from './localized-rich-text';

function styled(values: readonly RichTextStyledText[]): string {
  return values.map((value) => value.text).join('');
}

function inline(values: readonly RichTextInline[]): string {
  return values
    .map((value) => {
      switch (value.value.case) {
        case 'text':
          return value.value.value.text;
        case 'hardBreak':
          return '\n';
        case 'link':
          return styled(value.value.value.content);
        case 'mathInline':
          return value.value.value.source;
        case undefined:
          return '';
        default:
          return value.value satisfies never;
      }
    })
    .join('');
}

export function localizedRichTextPlainText(blocks: readonly LocalizedRichTextBlock[]): string {
  const text = (block: LocalizedRichTextBlock): string => {
    let own = '';
    switch (block.kind) {
      case 'paragraph':
      case 'heading':
      case 'bullet-list-item':
      case 'numbered-list-item':
      case 'check-list-item':
      case 'quote':
      case 'callout':
        own = inline(block.locale.content);
        break;
      case 'code-block':
        own = block.locale.content;
        break;
      case 'table':
        own =
          block.locale.content?.rows.flatMap((row) => row.cells.map((cell) => inline(cell.content))).join(' ') ?? '';
        break;
      case 'divider':
      case 'p5-sketch':
      case 'three-scene':
      case 'shader':
      case 'math':
      case 'map':
      case 'file':
        break;
      default:
        return block satisfies never;
    }
    return [own, ...block.children.map(text)].filter(Boolean).join(' ');
  };
  return blocks.map(text).filter(Boolean).join(' ').trim();
}
