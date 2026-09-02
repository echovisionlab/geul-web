import { materializeLocalizedRichTextDocument } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  CodeBlockProps_Language,
  ShaderProps_StagesItem_Kind,
  ThreeSceneProps_Language,
  type RichTextBlock,
  type RichTextBlockLocale,
  type RichTextDocument,
  type RichTextInline,
  type RichTextStyledText,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { buildContentScopedFileUrl } from '@/lib/media/content-scoped-file-url';

function styledText(value: RichTextStyledText): string {
  let text = value.text;
  const styles = value.styles;
  if (styles?.bold) {
    text = `**${text}**`;
  }
  if (styles?.italic) {
    text = `*${text}*`;
  }
  if (styles?.strike) {
    text = `~~${text}~~`;
  }
  if (styles?.code) {
    text = `\`${text}\``;
  }
  return text;
}

function inlineMarkdown(values: readonly RichTextInline[]): string {
  return values
    .map((item) => {
      switch (item.value.case) {
        case 'text':
          return styledText(item.value.value);
        case 'hardBreak':
          return '\n';
        case 'link': {
          const label = item.value.value.content.map(styledText).join('');
          return label === item.value.value.href ? item.value.value.href : `[${label}](${item.value.value.href})`;
        }
        case 'mathInline':
          return `$${item.value.value.source}$`;
        case undefined:
          throw new Error('Rich-text inline has no generated kind.');
        default:
          return item.value satisfies never;
      }
    })
    .join('');
}

function fencedCode(language: string, source: string): string {
  const longest = Math.max(0, ...Array.from(source.matchAll(/`+/gu), (match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${source}\n${fence}`;
}

function enumLanguage(value: CodeBlockProps_Language | undefined): string {
  if (value === undefined || value === CodeBlockProps_Language.UNSPECIFIED) {
    return '';
  }
  return CodeBlockProps_Language[value].toLowerCase().replaceAll('_', '-');
}

function threeLanguage(value: ThreeSceneProps_Language | undefined): string {
  return value === ThreeSceneProps_Language.TYPESCRIPT ? 'typescript' : 'javascript';
}

const shaderStageNames = {
  [ShaderProps_StagesItem_Kind.COMMON]: 'common.glsl',
  [ShaderProps_StagesItem_Kind.VERTEX]: 'vert.glsl',
  [ShaderProps_StagesItem_Kind.BUFFER_A]: 'buffer-a.glsl',
  [ShaderProps_StagesItem_Kind.BUFFER_B]: 'buffer-b.glsl',
  [ShaderProps_StagesItem_Kind.BUFFER_C]: 'buffer-c.glsl',
  [ShaderProps_StagesItem_Kind.BUFFER_D]: 'buffer-d.glsl',
  [ShaderProps_StagesItem_Kind.CUBEMAP]: 'cubemap.glsl',
  [ShaderProps_StagesItem_Kind.SOUND]: 'sound.glsl',
  [ShaderProps_StagesItem_Kind.IMAGE]: 'frag.glsl',
} as const;

interface Pair {
  readonly block: RichTextBlock;
  readonly locale: RichTextBlockLocale;
  readonly parentId: string | null;
  readonly index: number;
}

type LocaleValue = Exclude<RichTextBlockLocale['value'], { case: undefined }>;
type LocaleValueByCase = {
  [TCase in LocaleValue['case']]: Extract<LocaleValue, { case: TCase }>['value'];
};

function localeValue<TCase extends LocaleValue['case']>(pair: Pair, kind: TCase): LocaleValueByCase[TCase] {
  if (pair.locale.value.case !== kind) {
    throw new Error(`Localized Block ${pair.block.id} kind does not match ${kind}.`);
  }
  return pair.locale.value.value as unknown as LocaleValueByCase[TCase];
}

function blockMarkdown(pair: Pair, descendants: readonly string[], entityId: string): string {
  if (pair.block.value.case !== pair.locale.value.case) {
    throw new Error(`Localized Block ${pair.block.id} kind does not match its base Block.`);
  }
  let markdown: string;
  switch (pair.block.value.case) {
    case 'paragraph':
      markdown = inlineMarkdown(localeValue(pair, 'paragraph').content);
      break;
    case 'heading':
      markdown = `${'#'.repeat(pair.block.value.value.props?.level || 1)} ${inlineMarkdown(localeValue(pair, 'heading').content)}`;
      break;
    case 'bulletListItem':
      markdown = `- ${inlineMarkdown(localeValue(pair, 'bulletListItem').content)}`;
      break;
    case 'numberedListItem':
      markdown = `${pair.block.value.value.props?.start || 1}. ${inlineMarkdown(localeValue(pair, 'numberedListItem').content)}`;
      break;
    case 'checkListItem':
      markdown = `- [${pair.block.value.value.props?.checked ? 'x' : ' '}] ${inlineMarkdown(localeValue(pair, 'checkListItem').content)}`;
      break;
    case 'quote':
      markdown = `> ${inlineMarkdown(localeValue(pair, 'quote').content)}`;
      break;
    case 'callout': {
      const icon = pair.block.value.value.props?.icon ?? '💡';
      const own = inlineMarkdown(localeValue(pair, 'callout').content);
      const content = [own, ...descendants].filter(Boolean).join('\n\n');
      return [`> ${icon}${content ? ` ${content.replaceAll('\n', '\n> ')}` : ''}`].filter(Boolean).join('\n');
    }
    case 'codeBlock':
      markdown = fencedCode(
        enumLanguage(pair.block.value.value.props?.language),
        localeValue(pair, 'codeBlock').content,
      );
      break;
    case 'divider':
      markdown = '---';
      break;
    case 'table': {
      const rows = localeValue(pair, 'table').content?.rows ?? [];
      markdown =
        rows.length === 0
          ? ''
          : [
              `| ${rows[0]!.cells.map((cell) => inlineMarkdown(cell.content)).join(' | ')} |`,
              `| ${rows[0]!.cells.map(() => '---').join(' | ')} |`,
              ...rows.slice(1).map((row) => `| ${row.cells.map((cell) => inlineMarkdown(cell.content)).join(' | ')} |`),
            ].join('\n');
      break;
    }
    case 'p5Sketch':
      markdown = fencedCode('javascript', pair.block.value.value.props?.source ?? '');
      break;
    case 'threeScene':
      markdown = fencedCode(
        threeLanguage(pair.block.value.value.props?.language),
        pair.block.value.value.props?.source ?? '',
      );
      break;
    case 'shader':
      markdown = (pair.block.value.value.props?.stages ?? [])
        .flatMap((stage) => {
          const name = shaderStageNames[stage.kind as keyof typeof shaderStageNames];
          return name && stage.source ? [`### ${name}\n\n${fencedCode('glsl', stage.source)}`] : [];
        })
        .join('\n\n');
      break;
    case 'math':
      markdown = `$$${pair.block.value.value.props?.latex ?? ''}$$`;
      break;
    case 'map':
      markdown = '';
      break;
    case 'file': {
      const props = pair.block.value.value.props;
      const fileId = props?.attachment?.state.case === 'activeFileId' ? props.attachment.state.value : null;
      if (!fileId) {
        markdown = '';
        break;
      }
      const name = props?.name || 'file';
      markdown = `[${name}](${buildContentScopedFileUrl({
        ownerType: 'post',
        ownerId: entityId,
        blockId: pair.block.id,
        fileName: name,
      })})`;
      break;
    }
    case undefined:
      throw new Error(`Rich-text Block ${pair.block.id} has no generated kind.`);
    default:
      return pair.block.value satisfies never;
  }
  return [markdown, ...descendants].filter(Boolean).join('\n\n');
}

export function generatedRichTextDocumentMarkdown(document: RichTextDocument, entityId: string): string {
  const localized = materializeLocalizedRichTextDocument(document, document.sourceLocale);
  const localeById = new Map(localized.localeOverlay?.blocks.map((block) => [block.blockId, block]));
  const pairs = (localized.base?.nodes ?? []).map((node): Pair => {
    if (!node.block || !node.placement) {
      throw new Error('Rich-text graph contains an incomplete Block node.');
    }
    const locale = localeById.get(node.block.id);
    if (!locale) {
      throw new Error(`Rich-text Block ${node.block.id} has no source locale payload.`);
    }
    return {
      block: node.block,
      locale,
      parentId: node.placement.parentBlockId ?? null,
      index: node.placement.index,
    };
  });
  const byParent = new Map<string | null, Pair[]>();
  for (const pair of pairs) {
    const siblings = byParent.get(pair.parentId) ?? [];
    siblings.push(pair);
    byParent.set(pair.parentId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) => left.index - right.index);
  }

  const render = (pair: Pair): string => blockMarkdown(pair, (byParent.get(pair.block.id) ?? []).map(render), entityId);
  return (byParent.get(null) ?? []).map(render).filter(Boolean).join('\n\n') + (pairs.length ? '\n' : '');
}
