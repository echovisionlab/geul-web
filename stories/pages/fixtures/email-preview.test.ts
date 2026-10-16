import { create } from '@bufbuild/protobuf';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderLocalEmailPreview } from './email-preview';

afterEach(() => vi.unstubAllGlobals());

describe('canonical email preview transport', () => {
  it('sends protobuf JSON and preserves the complete Go HTML without client presentation rules', async () => {
    const html =
      ' <!DOCTYPE html><html><body style="margin:24px"><blockquote style="border-left:3px solid #aaa">quote</blockquote></body></html>\n';
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ html, subject: 'Rendered', text: 'quote' })));
    vi.stubGlobal('fetch', fetch);
    const document = create(LocalizedRichTextDocumentSchema, { locale: 'ko', profile: RichTextProfile.EMAIL });
    const signal = new AbortController().signal;
    const result = await renderLocalEmailPreview({ locale: 'ko', subject: 'Draft', document }, signal);
    expect(result.html).toBe(html);
    const [path, request] = fetch.mock.calls[0];
    expect(path).toBe('/__fixtures/email-preview');
    expect(request.signal).toBe(signal);
    const body = JSON.parse(request.body);
    expect(body.document).toMatchObject({ locale: 'ko' });
    expect(body.document).not.toHaveProperty('$typeName');
    expect(typeof body.document.profile).toBe('string');
    expect(body).not.toHaveProperty('contentHtml');
  });

  it('reports an unavailable real renderer rather than substituting client HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Renderer unavailable' }), { status: 503 })),
    );
    await expect(
      renderLocalEmailPreview({ locale: 'ko', subject: 'Draft', contentHtml: '<p>Body</p>' }),
    ).rejects.toThrow('Renderer unavailable');
  });
});
