// @vitest-environment jsdom
import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, expect, it, vi } from 'vitest';
import { createMarkdownPasteExtension, type MarkdownImagePlaceholder } from '../tiptap/markdown-paste';
import { createTiptapWireExtensions } from '../tiptap/wire-schema';
import { createTiptapEditorMediaCommandPort } from './media-block-updates';
import { importMarkdownImages, type RemoteImageSource } from './markdown-image-import';

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function pasteMarkdown(text: string, initialText = '', cursor?: number) {
  const imports: Array<{
    images: readonly MarkdownImagePlaceholder[];
    isIntact: (image: MarkdownImagePlaceholder) => boolean;
  }> = [];
  editor = new Editor({
    element: document.createElement('div'),
    extensions: [
      ...createTiptapWireExtensions(),
      createMarkdownPasteExtension(
        () => true,
        () => (images, isIntact) => imports.push({ images, isIntact }),
      ),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'blockGroup',
          content: [{ type: 'blockContainer', attrs: { id: randomTestUuid() }, content: [{ type: 'paragraph' }] }],
        },
      ],
    },
  });
  if (initialText) {
    editor.commands.insertContent(initialText);
    editor.commands.setTextSelection(cursor ?? 1);
  }
  editor.view.someProp('handlePaste', (handler) =>
    handler(
      editor!.view,
      { clipboardData: { getData: (type: string) => (type === 'text/plain' ? text : '') } } as ClipboardEvent,
      editor!.state.doc.slice(0, 0),
    ),
  );
  return { editor, imports, port: createTiptapEditorMediaCommandPort(editor) };
}

const blocks = (target: Editor) =>
  ((target.getJSON() as JSONContent).content![0].content ?? []).map((block) => ({
    type: block.content![0].type,
    text: (block.content![0].content ?? []).map((node) => node.text ?? '').join(''),
    alt: block.content![0].attrs?.alt,
  }));
const source = (type = 'image/png', name = 'a.png'): RemoteImageSource => ({
  file: new File([new Uint8Array([1, 2, 3])], name, { type }),
  dispose: vi.fn(async () => undefined),
});
const options = (download: () => Promise<RemoteImageSource>) => ({
  entityType: TranscodeEntityType.POST,
  entityId: randomTestUuid(),
  download: vi.fn(download),
  upload: vi.fn(async () => ({ fileId: randomTestUuid(), url: 'https://cdn.example.test/a.png' })),
  onProgress: vi.fn(),
});

it.each([
  ['an empty paragraph', '', undefined, ['file:', 'paragraph:Page']],
  ['the middle of text', 'prefix suffix', 10, ['paragraph:prefix ', 'file:', 'paragraph:Page', 'paragraph:suffix']],
])('replaces an image pasted into %s and keeps a failed one as its link', async (_, initialText, cursor, expected) => {
  const pasted = pasteMarkdown(
    '![Diagram](https://example.test/a.png)\n\n![Page](https://example.test/b.html)',
    initialText,
    cursor,
  );
  const [{ images, isIntact }] = pasted.imports;
  const sources = [source(), source('text/html', 'b.html')];
  const run = options(async () => sources.shift()!);

  expect(images.every(isIntact)).toBe(true);
  expect(await importMarkdownImages(pasted.port, images, isIntact, run)).toBe(1);

  expect(blocks(pasted.editor).map((block) => `${block.type}:${block.text}`)).toEqual(expected);
  expect(blocks(pasted.editor).find((block) => block.type === 'file')?.alt).toBe('Diagram');
  expect(run.upload).toHaveBeenCalledTimes(1);
});

it('leaves a placeholder the author edited or removed before the import finished', async () => {
  const pasted = pasteMarkdown('![A](https://example.test/a.png)\n\n![B](https://example.test/b.png)');
  const [{ images, isIntact }] = pasted.imports;
  pasted.port.deleteBlock(images[1].blockId);
  const run = options(async () => {
    pasted.editor.commands.insertContentAt(3, 'edited ');
    return source();
  });

  expect(await importMarkdownImages(pasted.port, images, isIntact, run)).toBe(0);

  expect(run.download).toHaveBeenCalledTimes(1);
  expect(blocks(pasted.editor).map((block) => block.type)).not.toContain('file');
  expect(pasted.editor.getText()).toContain('edited');
});
