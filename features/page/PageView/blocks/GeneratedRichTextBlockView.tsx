'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import type { RichTextInline, RichTextStyledText } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { ExternalVideoView } from '@/features/media/ExternalVideoView';
import { resolveGeneratedStandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';
import { alignment, assertNever, containerStyle, requireHeadingLevel } from './GeneratedRichTextViewUtils';
import type { GeneratedRichTextBlock, GeneratedRichTextBlockViewProps } from './GeneratedRichTextBlockView.types';

const GeneratedInlineMathView = dynamic<{ source: string }>(() =>
  import('./GeneratedInlineMathView').then((module) => module.GeneratedInlineMathView),
);
const GeneratedCodeBlockView = dynamic<{ block: GeneratedRichTextBlock<'code-block'> }>(() =>
  import('./GeneratedCodeBlockView').then((module) => module.GeneratedCodeBlockView),
);
const GeneratedExecutableBlockView = dynamic<{
  block: GeneratedRichTextBlock<'p5-sketch' | 'three-scene' | 'shader'>;
}>(() => import('./GeneratedExecutableBlockView').then((module) => module.GeneratedExecutableBlockView));
const GeneratedFileBlockView = dynamic<{
  block: GeneratedRichTextBlock<'file'>;
  downloadOwner?: GeneratedRichTextBlockViewProps['downloadOwner'];
}>(() => import('./GeneratedFileBlockView').then((module) => module.GeneratedFileBlockView));
const GeneratedMapBlockView = dynamic<{
  block: GeneratedRichTextBlock<'map'>;
  requestedLocale?: string;
}>(() => import('./GeneratedMapBlockView').then((module) => module.GeneratedMapBlockView));
const GeneratedMathBlockView = dynamic<{ block: GeneratedRichTextBlock<'math'> }>(() =>
  import('./GeneratedMathBlockView').then((module) => module.GeneratedMathBlockView),
);
const GeneratedMermaidBlockView = dynamic<{ block: GeneratedRichTextBlock<'mermaid'> }>(() =>
  import('./GeneratedMermaidBlockView').then((module) => module.GeneratedMermaidBlockView),
);

function styledText(item: RichTextStyledText, key: string): ReactNode {
  let value: ReactNode = item.text;
  const styles = item.styles;
  if (styles?.bold) {
    value = <strong>{value}</strong>;
  }
  if (styles?.italic) {
    value = <em>{value}</em>;
  }
  if (styles?.underline) {
    value = <u>{value}</u>;
  }
  if (styles?.strike) {
    value = <s>{value}</s>;
  }
  if (styles?.code) {
    value = <code>{value}</code>;
  }
  if (styles?.textColor) {
    value = <span data-text-color={styles.textColor}>{value}</span>;
  }
  if (styles?.backgroundColor) {
    value = <span data-bg-color={styles.backgroundColor}>{value}</span>;
  }
  return <span key={key}>{value}</span>;
}

function inlineContent(content: readonly RichTextInline[]): ReactNode {
  return content.map((item, index) => {
    switch (item.value.case) {
      case 'text':
        return styledText(item.value.value, `text-${index}`);
      case 'hardBreak':
        return <br key={`break-${index}`} />;
      case 'link': {
        const href = normalizeRichTextHref(item.value.value.href);
        const children = item.value.value.content.map((text, textIndex) =>
          styledText(text, `link-${index}-${textIndex}`),
        );
        return href ? (
          <a key={`link-${index}`} href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ) : (
          <span key={`link-${index}`}>{children}</span>
        );
      }
      case 'mathInline':
        return <GeneratedInlineMathView key={`math-${index}`} source={item.value.value.source} />;
      case undefined:
        throw new Error('Generated rich-text inline node has no kind.');
      default:
        return assertNever(item.value, 'Unsupported generated rich-text inline kind');
    }
  });
}

function GeneratedParagraphBlock({
  block,
  allowStandaloneExternalVideo,
  isTopLevel,
}: {
  block: Extract<LocalizedRichTextBlock, { kind: 'paragraph' }>;
  allowStandaloneExternalVideo: boolean;
  isTopLevel: boolean;
}) {
  const labels = useTranslations('editorCommon.editor.runtimeLabels.externalVideo');
  const externalVideo =
    allowStandaloneExternalVideo && isTopLevel
      ? resolveGeneratedStandaloneExternalVideoLink(
          {
            content: block.locale.content,
            props: block.base.props,
            hasChildren: block.children.length > 0,
          },
          {
            youtubeTitle: labels('youtubeTitle'),
            vimeoTitle: labels('vimeoTitle'),
          },
        )
      : null;
  if (externalVideo) {
    return (
      <ExternalVideoView
        url={externalVideo.url}
        title={externalVideo.title}
        aspectRatio={externalVideo.aspectRatio}
        style={mediaContainerStyleToReact(
          resolveMediaContainerStyle(externalVideo.previewWidth, externalVideo.textAlignment),
        )}
      />
    );
  }

  return <p style={{ textAlign: alignment(block.base.props?.textAlignment) }}>{inlineContent(block.locale.content)}</p>;
}

export function GeneratedRichTextBlockView({
  block,
  requestedLocale,
  downloadOwner,
  allowStandaloneExternalVideo = false,
  isTopLevel = true,
}: GeneratedRichTextBlockViewProps) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <GeneratedParagraphBlock
          block={block}
          allowStandaloneExternalVideo={allowStandaloneExternalVideo}
          isTopLevel={isTopLevel}
        />
      );
    case 'heading': {
      const level = requireHeadingLevel(block.base.props?.level ?? 1);
      const Heading = `h${level}` as 'h1' | 'h2' | 'h3';
      return (
        <Heading id={block.id} style={{ textAlign: alignment(block.base.props?.textAlignment) }}>
          {inlineContent(block.locale.content)}
        </Heading>
      );
    }
    case 'bullet-list-item':
      return (
        <ul>
          <li>
            {inlineContent(block.locale.content)}
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </li>
        </ul>
      );
    case 'numbered-list-item':
      return (
        <ol start={block.base.props?.start}>
          <li>
            {inlineContent(block.locale.content)}
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </li>
        </ol>
      );
    case 'check-list-item':
      return (
        <div className="check-list-item">
          <input type="checkbox" checked={block.base.props?.checked ?? false} readOnly />
          <span>{inlineContent(block.locale.content)}</span>
        </div>
      );
    case 'quote':
      return <blockquote>{inlineContent(block.locale.content)}</blockquote>;
    case 'callout':
      return (
        <aside
          data-callout=""
          data-bg-color={block.base.props?.backgroundColor ?? 'gray'}
          data-text-color={block.base.props?.textColor ?? 'default'}
        >
          <span data-callout-icon="" aria-hidden="true">
            {block.base.props?.icon ?? '💡'}
          </span>
          <div data-callout-content="">
            <div data-callout-copy="">{inlineContent(block.locale.content)}</div>
            {block.children.map((child) => (
              <GeneratedRichTextBlockView
                key={child.id}
                block={child}
                requestedLocale={requestedLocale}
                downloadOwner={downloadOwner}
                allowStandaloneExternalVideo={allowStandaloneExternalVideo}
                isTopLevel={false}
              />
            ))}
          </div>
        </aside>
      );
    case 'code-block':
      return <GeneratedCodeBlockView block={block} />;
    case 'divider':
      return <hr />;
    case 'table': {
      const base = block.base.content;
      const locale = block.locale.content;
      if (!base || !locale || base.rows.length !== locale.rows.length) {
        throw new Error(`Generated table Block ${block.id} shape mismatch.`);
      }
      return (
        <table style={containerStyle(block.base.props?.previewWidth, block.base.props?.textAlignment)}>
          {base.columnWidths.length ? (
            <colgroup>
              {base.columnWidths.map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
          ) : null}
          <tbody>
            {base.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) => {
                  const Cell = cell.header ? 'th' : 'td';
                  const localized = locale.rows[rowIndex]?.cells[cellIndex];
                  if (!localized) {
                    throw new Error(`Generated table Block ${block.id} cell shape mismatch.`);
                  }
                  return (
                    <Cell
                      key={cellIndex}
                      colSpan={cell.props?.colspan}
                      rowSpan={cell.props?.rowspan}
                      style={{ textAlign: alignment(cell.props?.textAlignment) }}
                    >
                      {inlineContent(localized.content)}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'p5-sketch':
    case 'three-scene':
    case 'shader':
      return <GeneratedExecutableBlockView block={block} />;
    case 'math':
      return <GeneratedMathBlockView block={block} />;
    case 'map':
      return <GeneratedMapBlockView block={block} requestedLocale={requestedLocale} />;
    case 'mermaid':
      return <GeneratedMermaidBlockView block={block} />;
    case 'file':
      return <GeneratedFileBlockView block={block} downloadOwner={downloadOwner} />;
    default:
      return assertNever(block, 'Unsupported generated public rich-text Block kind');
  }
}
