'use server';

import { connectActionErrorCode } from '@/lib/api/connect-error';
import { createLinkPreviewClient } from '@/lib/api/server-client';
import { actionFailure, actionSuccess, type ActionResult } from '@/lib/actions/action-result';
import { logServerFailure } from '@/lib/logging/logger';

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
  try {
    const response = await (await createLinkPreviewClient()).getLinkPreview({ url });
    return actionSuccess({
      preview: {
        resolvedUrl: response.resolvedUrl,
        title: response.title,
        description: response.description,
        siteName: response.siteName,
        imageSource: response.imageSource,
        iconSource: response.iconSource,
      },
    });
  } catch (error) {
    logServerFailure('link-preview-actions', 'getLinkPreviewAction', error);
    return actionFailure('The link preview could not be read.', connectActionErrorCode(error, 'LINK_PREVIEW_FAILED'));
  }
}
