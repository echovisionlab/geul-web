import { describe, expect, it } from 'vitest';
import { externalVideoParagraphSpec, isExternalVideoParagraph } from './external-video-paragraph-spec';

describe('external-video paragraph contract', () => {
  it('preserves the durable paragraph layout fields', () => {
    expect(externalVideoParagraphSpec).toMatchObject({
      type: 'paragraph',
      content: 'inline*',
      props: {
        previewWidth: { default: '100' },
        aspectRatio: { default: 'auto' },
      },
    });
  });

  it('recognizes persisted external-video paragraph layout data', () => {
    expect(
      isExternalVideoParagraph({
        type: 'paragraph',
        props: { previewWidth: '64', aspectRatio: '16:9' },
      }),
    ).toBe(true);
    expect(isExternalVideoParagraph({ type: 'paragraph', props: { previewWidth: '64' } })).toBe(false);
    expect(
      isExternalVideoParagraph({
        type: 'image',
        props: { previewWidth: '64', aspectRatio: '16:9' },
      }),
    ).toBe(false);
  });
});
