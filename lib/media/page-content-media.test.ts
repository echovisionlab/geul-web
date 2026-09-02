import { describe, expect, it } from 'vitest';
import type { PageContent } from '@/lib/types/page-content';
import { collectPageContentMedia, findPageContentFileBlock } from './page-content-media';

const content: PageContent = {
  sections: [
    {
      id: 'columns',
      type: 'columns',
      props: {},
      settings: {},
      columns: [
        {
          id: 'column',
          sections: [
            {
              id: 'media',
              type: 'rich-text',
              props: {},
              settings: {},
              content: [
                {
                  id: 'audio',
                  type: 'file',
                  content: [],
                  props: { fileId: 'file-1', hlsUrl: 'https://cdn.test/audio.m3u8' },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('page content media traversal', () => {
  it('finds nested column media and produces the refresh projection', () => {
    expect(findPageContentFileBlock(content, 'file-1')?.id).toBe('audio');
    expect(collectPageContentMedia(content)).toMatchObject({
      'file-1': { fileId: 'file-1', hlsUrl: 'https://cdn.test/audio.m3u8' },
    });
  });
});
