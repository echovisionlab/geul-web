import { describe, expect, it, vi } from 'vitest';
import { convertPostContent } from './post';
import { encodeLegacyWireDocument } from './test-fixtures';

vi.mock('./map-data', () => ({ injectMapData: vi.fn(async (html: string) => html) }));

describe('post conversion durable-schema validation', () => {
  it('fails closed for an unknown persisted block', async () => {
    await expect(
      convertPostContent(encodeLegacyWireDocument([{ id: 'unsupported', type: 'futureBlock', content: [] }]), 'post-1'),
    ).rejects.toThrow('Unsupported durable editor node: futureBlock');
  });

  it('fails closed for an unknown persisted mark', async () => {
    await expect(
      convertPostContent(
        encodeLegacyWireDocument([
          {
            id: 'unsupported-mark',
            type: 'paragraph',
            content: [{ type: 'text', text: 'not silently lost', styles: { futureMark: true } }],
          },
        ]),
        'post-1',
      ),
    ).rejects.toThrow('Unsupported durable editor mark: futureMark');
  });
});
