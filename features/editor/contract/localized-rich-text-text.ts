import { isSiteVariableKey } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { resolveSiteVariable, type SiteVariableContext } from '@echovisionlab/geul-common/site-variables';
import type { RichTextInline, RichTextStyledText } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { resolveSiteVariableTokens } from '@/lib/site-variables';
import type { LocalizedRichTextBlock } from './localized-rich-text';

function styled(values: readonly RichTextStyledText[], context?: SiteVariableContext): string {
  return values.map((value) => resolveSiteVariableTokens(value.text, context).replace(/\r\n|\r/g, '\n')).join('');
}

export function localizedRichTextInlinePlainText(
  values: readonly RichTextInline[],
  context?: SiteVariableContext,
): string {
  return values
    .map((value) => {
      switch (value.value.case) {
        case 'text':
          return value.value.value.text.replace(/\r\n|\r/g, '\n');
        case 'siteVariable':
          if (!context) {
            throw new Error('Site variable context is required for plain-text output.');
          }
          if (!isSiteVariableKey(value.value.value.key)) {
            throw new Error('Unknown site variable.');
          }
          return resolveSiteVariable(value.value.value.key, context);
        case 'hardBreak':
          return '\n';
        case 'link':
          return styled(value.value.value.content, context);
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

export function localizedRichTextPlainText(
  blocks: readonly LocalizedRichTextBlock[],
  context?: SiteVariableContext,
): string {
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
        own = localizedRichTextInlinePlainText(block.locale.content, context);
        break;
      case 'code-block':
        own = block.locale.content;
        break;
      case 'table':
        own =
          block.locale.content?.rows
            .flatMap((row) => row.cells.map((cell) => localizedRichTextInlinePlainText(cell.content, context)))
            .join(' ') ?? '';
        break;
      case 'mermaid':
        own = block.locale.props?.title ?? '';
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
