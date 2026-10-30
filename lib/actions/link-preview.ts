'use server';

import { createLinkPreviewClient } from '@/lib/api/server-client';
import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';

export interface LinkPreview {
  resolvedUrl: string;
  title: string;
  description: string;
  siteName: string;
  /** External images the editor imports as the thumbnail and icon Files; never shown directly. */
  imageSource: string;
  iconSource: string;
}

/** Reads the preview a linked page declares about itself, for an author presenting it as a card or video. */
export async function getLinkPreviewAction(url: string): Promise<ActionResult<{ preview: LinkPreview }>> {
  return runAction(
    'link-preview-actions',
    'getLinkPreviewAction',
    async () => {
      const response = await (await createLinkPreviewClient()).getLinkPreview({ url });
      return {
        preview: {
          resolvedUrl: response.resolvedUrl,
          title: response.title,
          description: response.description,
          siteName: response.siteName,
          imageSource: response.imageSource,
          iconSource: response.iconSource,
        },
      };
    },
    { fallback: 'The link preview could not be read.', code: 'LINK_PREVIEW_FAILED' },
  );
}
