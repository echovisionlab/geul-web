import { DEFAULT_DOCUMENT_LAYOUT, type DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';
import {
  DocumentContentHeight,
  DocumentRegionPlacement,
  type DocumentLayout as ProtoDocumentLayout,
} from '@echovisionlab/geul-proto/common/common_pb.ts';

function mapContentHeight(value: DocumentContentHeight): DocumentLayout['contentHeight'] {
  switch (value) {
    case DocumentContentHeight.CONTENT:
      return 'content';
    case DocumentContentHeight.VIEWPORT:
      return 'viewport';
    case DocumentContentHeight.UNSPECIFIED:
    default:
      throw new RangeError(`Invalid document layout contentHeight: ${value}`);
  }
}

function mapRegionPlacement(
  field: 'pageChrome' | 'footer',
  value: DocumentRegionPlacement,
): DocumentLayout['pageChrome'] {
  switch (value) {
    case DocumentRegionPlacement.FLOW:
      return 'flow';
    case DocumentRegionPlacement.PINNED:
      return 'pinned';
    case DocumentRegionPlacement.UNSPECIFIED:
    default:
      throw new RangeError(`Invalid document layout ${field}: ${value}`);
  }
}

export function mapProtoDocumentLayout(layout: ProtoDocumentLayout | null | undefined): DocumentLayout {
  if (layout === undefined) {
    return DEFAULT_DOCUMENT_LAYOUT;
  }
  if (layout === null) {
    throw new TypeError('Invalid document layout: null');
  }

  return {
    contentHeight: mapContentHeight(layout.contentHeight),
    pageChrome: mapRegionPlacement('pageChrome', layout.pageChrome),
    footer: mapRegionPlacement('footer', layout.footer),
  };
}
