import { describe, expect, it } from 'vitest';
import { extractTranslationContentPreview } from './contentPreview';

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

describe('extractTranslationContentPreview', () => {
  it('extracts preview text from materialized document arrays', () => {
    const contentJson = encodeJson([
      {
        id: 'paragraph-1',
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Hello world' }],
        children: [],
      },
    ]);

    expect(extractTranslationContentPreview(contentJson)).toBe('Hello world');
  });

  it('extracts page section previews from rich text, captions, and nested columns', () => {
    const contentJson = encodeJson({
      sections: [
        {
          type: 'rich-text',
          props: { caption: 'Hero caption' },
          content: [
            {
              id: 'paragraph-1',
              type: 'paragraph',
              props: {},
              content: [{ type: 'text', text: 'Lead paragraph' }],
              children: [],
            },
          ],
        },
        {
          type: 'immersive-scene',
          props: {
            copyJson: JSON.stringify([{ id: 'scene-1', title: 'Scene title', text: 'Scene copy' }]),
          },
        },
        {
          type: 'columns',
          props: {},
          columns: [
            {
              sections: [
                {
                  type: 'image',
                  props: { caption: 'Nested caption' },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(extractTranslationContentPreview(contentJson)).toBe(
      'Lead paragraph\nHero caption\nScene title\nScene copy\nNested caption',
    );
  });

  it('extracts preview text from release translation payloads', () => {
    const contentJson = encodeJson({
      description: [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Release note preview' }],
          children: [],
        },
      ],
      creditNotes: {
        'credit-1': 'Do not include in preview',
      },
    });

    expect(extractTranslationContentPreview(contentJson)).toBe('Release note preview');
  });

  it('returns an empty preview for invalid or unsupported payloads', () => {
    expect(extractTranslationContentPreview()).toBe('');
    expect(extractTranslationContentPreview(new Uint8Array())).toBe('');
    expect(extractTranslationContentPreview(new TextEncoder().encode('{bad json'))).toBe('');
    expect(extractTranslationContentPreview(encodeJson({ foo: 'bar' }))).toBe('');
  });
});
