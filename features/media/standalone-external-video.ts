import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  EXTERNAL_VIDEO_DISPLAY_SIZE_DEFAULT,
  EXTERNAL_VIDEO_DISPLAY_SIZE_MAX_PERCENT,
  EXTERNAL_VIDEO_DISPLAY_SIZE_MIN_PERCENT,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';
import {
  ParagraphProps_AspectRatio,
  ParagraphProps_LinkPresentation,
  ParagraphProps_TextAlignment,
  type ParagraphProps,
  type RichTextInline,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { Block, InlineContent } from '@/lib/types/page-content';
import { resolveExternalVideo } from '@/lib/media/external-video';

export interface StandaloneExternalVideoLink {
  url: string;
  title: string;
  displaySize: string;
  textAlignment: 'left' | 'center' | 'right';
  aspectRatio: ExternalVideoAspectRatio;
}

export interface ExternalVideoProviderTitleLabels {
  youtubeTitle: string;
  vimeoTitle: string;
}

export function resolveStandaloneExternalVideoTitle(
  label: string,
  url: string,
  provider: 'youtube' | 'vimeo',
  labels?: ExternalVideoProviderTitleLabels,
): string {
  if (label && label !== url) {
    return label;
  }
  return labels?.[provider === 'youtube' ? 'youtubeTitle' : 'vimeoTitle'] ?? url;
}

function inlineHref(item: InlineContent): string | undefined {
  if (typeof item.props?.href === 'string') {
    return item.props.href;
  }
  return typeof item.href === 'string' ? item.href : undefined;
}

function inlineText(content: InlineContent[] | undefined): string {
  if (!content) {
    return '';
  }
  return content
    .map((item) => {
      if (item.type === 'text') {
        return item.text || '';
      }
      if (item.type === 'link') {
        return inlineText(item.content);
      }
      return '';
    })
    .join('');
}

function normalizeDisplaySize(value: unknown): string {
  const parsed =
    typeof value === 'string' || typeof value === 'number'
      ? Number.parseInt(String(value), 10)
      : Number.parseInt(EXTERNAL_VIDEO_DISPLAY_SIZE_DEFAULT, 10);
  return String(
    Math.max(
      EXTERNAL_VIDEO_DISPLAY_SIZE_MIN_PERCENT,
      Math.min(
        EXTERNAL_VIDEO_DISPLAY_SIZE_MAX_PERCENT,
        Number.isFinite(parsed) ? parsed : Number.parseInt(EXTERNAL_VIDEO_DISPLAY_SIZE_DEFAULT, 10),
      ),
    ),
  );
}

function normalizeTextAlignment(value: unknown): StandaloneExternalVideoLink['textAlignment'] {
  return value === 'center' || value === 'right' ? value : 'left';
}

function normalizeAspectRatio(value: unknown): ExternalVideoAspectRatio {
  return typeof value === 'string' && (EXTERNAL_VIDEO_ASPECT_RATIO_VALUES as readonly string[]).includes(value)
    ? (value as ExternalVideoAspectRatio)
    : 'auto';
}

export function resolveStandaloneExternalVideoLink(
  block: Block,
  providerTitleLabels?: ExternalVideoProviderTitleLabels,
): StandaloneExternalVideoLink | null {
  if (block.type !== 'paragraph' || (block.children?.length ?? 0) > 0) {
    return null;
  }

  const content = block.content ?? [];
  const links: InlineContent[] = [];
  for (const item of content) {
    if (item.type === 'link') {
      links.push(item);
      continue;
    }
    if (item.type !== 'text' || (item.text || '').trim().length > 0) {
      return null;
    }
  }

  if (links.length !== 1) {
    return null;
  }

  const url = normalizeRichTextHref(inlineHref(links[0]) ?? '');
  const resolved = resolveExternalVideo(url);
  if (!resolved) {
    return null;
  }

  const label = inlineText(links[0].content).trim();
  return {
    url,
    title: resolveStandaloneExternalVideoTitle(label, url, resolved.provider, providerTitleLabels),
    displaySize: normalizeDisplaySize(block.props.displaySize),
    textAlignment: normalizeTextAlignment(block.props.textAlignment),
    aspectRatio: normalizeAspectRatio(block.props.aspectRatio),
  };
}

function generatedTextAlignment(
  value: ParagraphProps_TextAlignment | undefined,
): StandaloneExternalVideoLink['textAlignment'] {
  if (value === ParagraphProps_TextAlignment.CENTER) {
    return 'center';
  }
  if (value === ParagraphProps_TextAlignment.RIGHT) {
    return 'right';
  }
  return 'left';
}

function generatedAspectRatio(value: ParagraphProps_AspectRatio | undefined): ExternalVideoAspectRatio {
  switch (value) {
    case ParagraphProps_AspectRatio.X_16_9:
      return '16:9';
    case ParagraphProps_AspectRatio.X_4_3:
      return '4:3';
    case ParagraphProps_AspectRatio.X_1_1:
      return '1:1';
    case ParagraphProps_AspectRatio.X_9_16:
      return '9:16';
    case ParagraphProps_AspectRatio.AUTO:
    case ParagraphProps_AspectRatio.UNSPECIFIED:
    case undefined:
    default:
      return 'auto';
  }
}

/** The one link a generated standalone paragraph holds, or null for any other shape. */
function generatedStandaloneLink(input: {
  content: readonly RichTextInline[];
  hasChildren: boolean;
}): { url: string; label: string } | null {
  if (input.hasChildren) {
    return null;
  }

  let link: Extract<RichTextInline['value'], { case: 'link' }>['value'] | null = null;
  for (const item of input.content) {
    switch (item.value.case) {
      case 'link':
        if (link || item.value.value.content.some((run) => /[\r\n]/.test(run.text))) {
          return null;
        }
        link = item.value.value;
        break;
      case 'text':
        if (/[\r\n]/.test(item.value.value.text) || item.value.value.text.trim()) {
          return null;
        }
        break;
      case 'hardBreak':
      case 'mathInline':
      case 'siteVariable':
      case undefined:
        return null;
    }
  }

  if (!link) {
    return null;
  }
  return {
    url: normalizeRichTextHref(link.href),
    label: link.content
      .map((item) => item.text)
      .join('')
      .trim(),
  };
}

/**
 * Generated Post/Page documents preserve the same durable external-video
 * shape as the editor: one standalone paragraph link and paragraph layout.
 * Only that exact shape becomes an embedded player, unless the author chose
 * to present it as a plain link or a card.
 */
export function resolveGeneratedStandaloneExternalVideoLink(
  input: {
    content: readonly RichTextInline[];
    props?: ParagraphProps;
    hasChildren: boolean;
  },
  providerTitleLabels?: ExternalVideoProviderTitleLabels,
): StandaloneExternalVideoLink | null {
  const presentation = input.props?.linkPresentation;
  if (presentation === ParagraphProps_LinkPresentation.LINK || presentation === ParagraphProps_LinkPresentation.CARD) {
    return null;
  }
  const link = generatedStandaloneLink(input);
  const resolved = link ? resolveExternalVideo(link.url) : null;
  if (!link || !resolved) {
    return null;
  }
  return {
    url: link.url,
    title: resolveStandaloneExternalVideoTitle(link.label, link.url, resolved.provider, providerTitleLabels),
    displaySize: normalizeDisplaySize(input.props?.displaySize),
    textAlignment: generatedTextAlignment(input.props?.textAlignment),
    aspectRatio: generatedAspectRatio(input.props?.aspectRatio),
  };
}

/** Storage reference paths of a paragraph link's thumbnail and icon Files (see the content block catalog). */
export const LINK_THUMBNAIL_REFERENCE_PATH = 'paragraph.linkThumbnail';
export const LINK_ICON_REFERENCE_PATH = 'paragraph.linkIcon';

export interface StandaloneLinkCard {
  url: string;
  /** Empty when the link text is the bare URL; the card then shows the host. */
  title: string;
}

/** A generated standalone paragraph link the author chose to present as a card. */
export function resolveGeneratedStandaloneLinkCard(input: {
  content: readonly RichTextInline[];
  props?: ParagraphProps;
  hasChildren: boolean;
}): StandaloneLinkCard | null {
  if (input.props?.linkPresentation !== ParagraphProps_LinkPresentation.CARD) {
    return null;
  }
  const link = generatedStandaloneLink(input);
  return link ? { url: link.url, title: link.label === link.url ? '' : link.label } : null;
}
