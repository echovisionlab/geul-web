import { create } from '@bufbuild/protobuf';
import {
  DocumentContentHeight,
  DocumentLayoutSchema,
  DocumentRegionPlacement,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import { describe, expect, it } from 'vitest';
import { mapProtoDocumentLayout } from './document-layout';

describe('mapProtoDocumentLayout', () => {
  it('uses content/flow/flow only when the root transport is absent', () => {
    expect(mapProtoDocumentLayout(undefined)).toEqual({
      contentHeight: 'content',
      pageChrome: 'flow',
      footer: 'flow',
    });
  });

  it('maps every explicit root layout field', () => {
    expect(
      mapProtoDocumentLayout(
        create(DocumentLayoutSchema, {
          contentHeight: DocumentContentHeight.VIEWPORT,
          pageChrome: DocumentRegionPlacement.PINNED,
          footer: DocumentRegionPlacement.FLOW,
        }),
      ),
    ).toEqual({
      contentHeight: 'viewport',
      pageChrome: 'pinned',
      footer: 'flow',
    });
  });

  it.each([
    {
      field: 'contentHeight',
      layout: {
        contentHeight: DocumentContentHeight.UNSPECIFIED,
        pageChrome: DocumentRegionPlacement.FLOW,
        footer: DocumentRegionPlacement.FLOW,
      },
    },
    {
      field: 'pageChrome',
      layout: {
        contentHeight: DocumentContentHeight.CONTENT,
        pageChrome: DocumentRegionPlacement.UNSPECIFIED,
        footer: DocumentRegionPlacement.FLOW,
      },
    },
    {
      field: 'footer',
      layout: {
        contentHeight: DocumentContentHeight.CONTENT,
        pageChrome: DocumentRegionPlacement.FLOW,
        footer: DocumentRegionPlacement.UNSPECIFIED,
      },
    },
  ])('rejects a present root with an unspecified $field', ({ layout }) => {
    expect(() => mapProtoDocumentLayout(create(DocumentLayoutSchema, layout))).toThrow('Invalid document layout');
  });

  it('rejects unknown enum values and null transports', () => {
    expect(() =>
      mapProtoDocumentLayout(
        create(DocumentLayoutSchema, {
          contentHeight: 99 as DocumentContentHeight,
          pageChrome: DocumentRegionPlacement.FLOW,
          footer: DocumentRegionPlacement.FLOW,
        }),
      ),
    ).toThrow('Invalid document layout contentHeight: 99');
    expect(() => mapProtoDocumentLayout(null)).toThrow('Invalid document layout: null');
  });
});
