import { create, fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import {
  DocumentContentHeight,
  DocumentLayoutSchema,
  DocumentRegionPlacement,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import type { DocumentLayout } from '@/features/document-layout';
import { mapProtoDocumentLayout } from '@/lib/queries/document-layout';

type LayoutField = keyof DocumentLayout;

const layoutFields: readonly LayoutField[] = ['contentHeight', 'pageChrome', 'footer'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Merge only the layout fields present in a peer metadata update. */
export function applyPageLayoutMetadataUpdate(
  current: DocumentLayout,
  values: Record<string, unknown>,
): DocumentLayout {
  const nested = isRecord(values.documentLayout) ? values.documentLayout : null;
  const patch: Record<string, unknown> = {};
  for (const field of layoutFields) {
    const path = `documentLayout.${field}`;
    if (nested && Object.hasOwn(nested, field)) {
      patch[field] = nested[field];
    } else if (!nested && Object.hasOwn(values, path)) {
      patch[field] = values[path];
    } else if (!nested && Object.hasOwn(values, field)) {
      patch[field] = values[field];
    }
  }
  if (Object.keys(patch).length === 0) {
    return current;
  }

  const currentProtoJson = toJson(
    DocumentLayoutSchema,
    create(DocumentLayoutSchema, {
      contentHeight:
        current.contentHeight === 'viewport' ? DocumentContentHeight.VIEWPORT : DocumentContentHeight.CONTENT,
      pageChrome: current.pageChrome === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
      footer: current.footer === 'pinned' ? DocumentRegionPlacement.PINNED : DocumentRegionPlacement.FLOW,
    }),
  ) as Record<string, JsonValue>;
  try {
    const parsed = fromJson(DocumentLayoutSchema, { ...currentProtoJson, ...patch } as JsonValue);
    return mapProtoDocumentLayout(parsed);
  } catch {
    return current;
  }
}
