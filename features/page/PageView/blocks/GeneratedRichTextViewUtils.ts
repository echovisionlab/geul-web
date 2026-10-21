import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { resolveGeneratedStandaloneExternalVideoLink } from '@/features/media/standalone-external-video';
import { mediaContainerStyleToReact, resolveMediaContainerStyle } from '@/lib/media/shared';

export function alignment(value: number | undefined): 'left' | 'center' | 'right' {
  return value === 2 ? 'center' : value === 3 ? 'right' : 'left';
}

export function containerStyle(
  displaySize: number | undefined,
  textAlignment: number | undefined,
): React.CSSProperties {
  return (
    mediaContainerStyleToReact(resolveMediaContainerStyle(String(displaySize ?? 100), alignment(textAlignment))) ?? {}
  );
}

export function requireHeadingLevel(value: number): 1 | 2 | 3 {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new Error(`Unsupported heading level: ${value}`);
  }
  return value;
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}

/**
 * Breakout width of a top-level block inside a reading measure (see document-content.css). Only
 * full-width blocks break out; a narrower authored preview width stays inside the reading column.
 * File blocks are marked `wide` and CSS narrows it to images and video (audio and attachments read
 * at the text measure).
 */
export function documentBlockMeasure(
  block: LocalizedRichTextBlock,
  options: { isTopLevel: boolean; allowStandaloneExternalVideo: boolean },
): 'standard' | 'wide' | undefined {
  if (!options.isTopLevel) {
    return undefined;
  }
  const displaySize = (block.base.props as { displaySize?: number } | undefined)?.displaySize;
  const fullWidth = displaySize === undefined || displaySize <= 0 || displaySize >= 100;
  switch (block.kind) {
    case 'code-block':
    case 'mermaid':
      return 'standard';
    case 'table':
      return fullWidth ? 'standard' : undefined;
    case 'file':
    case 'map':
    case 'p5-sketch':
    case 'three-scene':
    case 'shader':
      return fullWidth ? 'wide' : undefined;
    case 'paragraph': {
      if (!options.allowStandaloneExternalVideo) {
        return undefined;
      }
      const video = resolveGeneratedStandaloneExternalVideoLink({
        content: block.locale.content,
        props: block.base.props,
        hasChildren: block.children.length > 0,
      });
      const videoWidth = video ? Number.parseInt(String(video.displaySize ?? 100), 10) || 100 : 0;
      return video && videoWidth >= 100 ? 'wide' : undefined;
    }
    default:
      return undefined;
  }
}
