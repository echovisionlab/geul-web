// @vitest-environment jsdom

import { create } from '@bufbuild/protobuf';
import { ContentBlockMediaItemSchema } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContentBlockMediaRuntimeProvider, useContentBlockMediaItem } from './ContentBlockMediaRuntimeContext';

const blockId = '01b3db42-75f1-4bf1-8cb9-9b3baf57e795';
const fileId = 'b67328c4-668c-5bf2-8f1e-41465149ded6';

function Probe() {
  const item = useContentBlockMediaItem(blockId);
  return <span>{item?.delivery?.fileName}</span>;
}

describe('ContentBlockMediaRuntimeProvider', () => {
  it('hydrates runtime File metadata by exact Block selector without mutating durable props', () => {
    const item = create(ContentBlockMediaItemSchema, {
      selector: { blockId, referencePath: 'file' },
      attachment: { state: { case: 'activeFileId', value: fileId } },
      delivery: { fileId, fileName: 'field-notes.pdf', mimeType: 'application/pdf' },
    });

    expect(
      renderToStaticMarkup(
        <ContentBlockMediaRuntimeProvider items={[item]}>
          <Probe />
        </ContentBlockMediaRuntimeProvider>,
      ),
    ).toBe('<span>field-notes.pdf</span>');
  });

  it('fails closed when a renderer is not wrapped by the runtime provider', () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow('runtime context is required');
  });
});
