'use client';

import { PublicSiteVariable, PublicSiteVariableLink, PublicSiteVariableText } from './PublicSiteVariable';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { siteVariableContext } from '@/lib/site-variables';
import dynamic from 'next/dynamic';
import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { RichTextInline, RichTextStyledText } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { localizedRichTextInlinePlainText } from '@/features/editor/contract/localized-rich-text-text';
import { documentHeadingTag } from '@/features/document-layout/ui/document-heading-level';
import { useDocumentHeadingParentLevel } from '@/features/document-layout/ui/DocumentHeadingScope';
import { resolveGeneratedStandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';
import { isPublicListItemKind, PublicDocumentBlock, PublicListItem } from './PublicDocumentBlock';
import {
  alignment,
  assertNever,
  containerStyle,
  documentBlockMeasure,
  requireHeadingLevel,
} from './GeneratedRichTextViewUtils';
import type { GeneratedRichTextBlock, GeneratedRichTextBlockViewProps } from './GeneratedRichTextBlockView.types';

const ExternalVideoView = dynamic(() =>
  import('@/features/media/ExternalVideoView').then((module) => module.ExternalVideoView),
);

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

function styledText(item: Pick<RichTextStyledText, 'text' | 'styles'>, key: string): ReactNode {
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
      case 'siteVariable':
        return (
          <PublicSiteVariable
            key={`variable-${index}`}
            variableKey={item.value.value.key}
            linked={item.value.value.linked}
          >
            {(value) =>
              styledText(
                { text: value, styles: item.value.case === 'siteVariable' ? item.value.value.styles : undefined },
                `value-${index}`,
              )
            }
          </PublicSiteVariable>
        );
      case 'hardBreak':
        return <br key={`break-${index}`} />;
      case 'link': {
        const href = item.value.value.href;
        const children = item.value.value.content.map((text, textIndex) => (
          <PublicSiteVariableText key={`link-${index}-${textIndex}`} text={text.text}>
            {(value) => styledText({ ...text, text: value }, `link-${index}-${textIndex}`)}
          </PublicSiteVariableText>
        ));
        return (
          <PublicSiteVariableLink key={`link-${index}`} href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </PublicSiteVariableLink>
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

  return (
    <p {...textPresentation(block.base.props)} style={{ textAlign: alignment(block.base.props?.textAlignment) }}>
      {inlineContent(block.locale.content)}
    </p>
  );
}

export function GeneratedRichTextBlockView(props: GeneratedRichTextBlockViewProps) {
  const { block } = props;
  const nested =
    block.kind !== 'callout' && block.children.length > 0
      ? block.children.map((child) => (
          <GeneratedRichTextBlockView key={child.id} {...props} block={child} isTopLevel={false} />
        ))
      : undefined;
  return (
    <PublicDocumentBlock
      id={block.id}
      kind={block.kind}
      start={block.kind === 'numbered-list-item' ? block.base.props?.start : undefined}
      measure={documentBlockMeasure(block, {
        isTopLevel: props.isTopLevel ?? true,
        allowStandaloneExternalVideo: props.allowStandaloneExternalVideo ?? false,
      })}
      nested={isPublicListItemKind(block.kind) ? undefined : nested}
    >
      <GeneratedRichTextBlockContent {...props} nested={isPublicListItemKind(block.kind) ? nested : undefined} />
    </PublicDocumentBlock>
  );
}

function textPresentation(props: { textColor?: string; backgroundColor?: string } | undefined) {
  return { 'data-text-color': props?.textColor, 'data-bg-color': props?.backgroundColor };
}

function GeneratedRichTextBlockContent({
  block,
  requestedLocale,
  downloadOwner,
  allowStandaloneExternalVideo = false,
  isTopLevel = true,
  nested,
}: GeneratedRichTextBlockViewProps & { nested?: ReactNode }) {
  const contentId = useId();
  const { settings } = useSiteSettings();
  const variables = siteVariableContext(settings);
  const headingParentLevel = useDocumentHeadingParentLevel();
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
      // The element follows the page outline (below the document title); size and depth stay authored.
      const Heading = documentHeadingTag(level, headingParentLevel);
      const content = inlineContent(block.locale.content);
      if (!localizedRichTextInlinePlainText(block.locale.content, variables).trim()) {
        return null;
      }
      return (
        <Heading
          {...textPresentation(block.base.props)}
          id={block.id}
          data-heading-level={level}
          style={{ textAlign: alignment(block.base.props?.textAlignment) }}
        >
          {content}
        </Heading>
      );
    }
    case 'bullet-list-item':
    case 'numbered-list-item': {
      const List = block.kind === 'bullet-list-item' ? 'ul' : 'ol';
      return (
        <List start={block.kind === 'numbered-list-item' ? block.base.props?.start : undefined}>
          <PublicListItem
            presentation={textPresentation(block.base.props)}
            textAlign={alignment(block.base.props?.textAlignment)}
            nested={nested}
          >
            {inlineContent(block.locale.content)}
          </PublicListItem>
        </List>
      );
    }
    case 'check-list-item': {
      const content = inlineContent(block.locale.content);
      const hasTask = Boolean(localizedRichTextInlinePlainText(block.locale.content, variables).trim());
      return (
        <div
          className="check-list-item"
          {...textPresentation(block.base.props)}
          style={{ textAlign: alignment(block.base.props?.textAlignment) }}
        >
          {hasTask ? (
            <input
              type="checkbox"
              checked={block.base.props?.checked ?? false}
              readOnly
              aria-readonly="true"
              aria-labelledby={contentId}
              onChange={(event) => {
                event.currentTarget.checked = block.base.props?.checked ?? false;
              }}
            />
          ) : null}
          <span id={contentId}>{content}</span>
        </div>
      );
    }
    case 'quote':
      return <blockquote {...textPresentation(block.base.props)}>{inlineContent(block.locale.content)}</blockquote>;
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
                      {...textPresentation(cell.props)}
                      scope={cell.header ? (rowIndex === 0 ? 'col' : cellIndex === 0 ? 'row' : undefined) : undefined}
                      colSpan={cell.props?.colspan}
                      rowSpan={cell.props?.rowspan}
                      style={{ textAlign: alignment(cell.props?.textAlignment) }}
                    >
                      <p>{inlineContent(localized.content)}</p>
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
