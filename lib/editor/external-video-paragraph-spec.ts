import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  externalVideoLinkLayoutPropSchema,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';

/**
 * Persisted, additive layout fields for a paragraph that contains a standalone
 * external-video link. The URL and label remain inline document content.
 */
export interface ExternalVideoParagraphProps {
  aspectRatio?: ExternalVideoAspectRatio;
  previewWidth?: string;
}

export interface ExternalVideoParagraph {
  props: ExternalVideoParagraphProps & Record<string, unknown>;
  type: 'paragraph';
}

/** Engine-neutral paragraph capability used by Tiptap schema construction. */
export const externalVideoParagraphSpec = {
  content: 'inline*',
  props: externalVideoLinkLayoutPropSchema,
  type: 'paragraph',
} as const;

/** Recognizes persisted paragraph layout data without coupling to an editor runtime. */
export function isExternalVideoParagraph(
  block: { props?: Record<string, unknown>; type?: string } | null | undefined,
): block is ExternalVideoParagraph {
  if (block?.type !== 'paragraph' || !block.props) {
    return false;
  }

  const { aspectRatio, previewWidth } = block.props;
  return (
    typeof previewWidth === 'string' &&
    typeof aspectRatio === 'string' &&
    (EXTERNAL_VIDEO_ASPECT_RATIO_VALUES as readonly string[]).includes(aspectRatio)
  );
}
