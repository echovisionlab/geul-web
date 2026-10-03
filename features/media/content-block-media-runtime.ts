import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import {
  ContentBlockMediaItemSchema,
  type ContentBlockMediaItem,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { ContentBlockMediaRuntimeIndex } from './content-block-media-runtime-index';

// Compatibility facade for callers that need protobuf JSON serialization.
export { ContentBlockMediaRuntimeIndex } from './content-block-media-runtime-index';

export function serializeContentBlockMediaItems(items: readonly ContentBlockMediaItem[]): JsonValue[] {
  const index = new ContentBlockMediaRuntimeIndex(items);
  return index.items.map((item) => toJson(ContentBlockMediaItemSchema, item));
}

export function parseContentBlockMediaItems(values: readonly JsonValue[]): ContentBlockMediaRuntimeIndex {
  return new ContentBlockMediaRuntimeIndex(
    values.map((value) => fromJson(ContentBlockMediaItemSchema, value, { ignoreUnknownFields: false })),
  );
}
