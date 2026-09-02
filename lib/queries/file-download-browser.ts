import { create } from '@bufbuild/protobuf';
import {
  ContentBlockMediaSelectorSchema,
  type ContentBlockMediaSelector,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { createPublicFileClient } from '@/lib/api/browser-client';

export interface AuthorizeFileDownloadInput {
  entityType: PublicMediaEntityType;
  entityId: string;
  selector?: Pick<ContentBlockMediaSelector, 'blockId' | 'referencePath'>;
  trackId?: string;
}

export async function authorizeFileDownload(input: AuthorizeFileDownloadInput) {
  if (Boolean(input.selector) === Boolean(input.trackId?.trim())) {
    throw new Error('Exactly one File download relation target is required.');
  }
  const client = createPublicFileClient();
  return client.authorizeDownload({
    entityType: input.entityType,
    entityId: input.entityId,
    relationTarget: input.selector
      ? {
          case: 'contentBlock',
          value: create(ContentBlockMediaSelectorSchema, input.selector),
        }
      : input.trackId
        ? { case: 'trackId', value: input.trackId }
        : { case: undefined },
  });
}
