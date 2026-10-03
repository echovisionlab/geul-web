// @vitest-environment jsdom

import { renderToReadableStream } from 'react-dom/server.browser';
import { describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { immersiveSceneDocumentToMarkdown, markdownToImmersiveSceneDocument } from './DescriptionEditor';
import { ImmersiveSceneView } from './View';

// App Router compiles next/dynamic to this implementation. Keep its actual
// lazy SSR semantics while awaiting the public wrapper's runtime chunk.
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});

describe('immersive scene Description emoji', () => {
  it('preserves Unicode emoji through the Tiptap Markdown profile and scene rendering', async () => {
    const markdown = immersiveSceneDocumentToMarkdown(markdownToImmersiveSceneDocument('Signal ready 🎛️✨'));
    expect(markdown).toBe('Signal ready 🎛️✨');
    expect(immersiveSceneDocumentToMarkdown(markdownToImmersiveSceneDocument(markdown))).toBe(markdown);

    const stream = await renderToReadableStream(
      <TestProviders>
        <ImmersiveSceneView
          props={{
            unitsJson: '[{"id":"single","mesh":"sphere","color":"#ffffff"}]',
            copyJson: JSON.stringify([{ id: 'single', title: 'Emoji', text: markdown }]),
          }}
        />
      </TestProviders>,
    );

    await stream.allReady;
    const html = await new Response(stream).text();

    expect(html).toContain('data-immersive-scene="true"');
    expect(html).toContain('Signal ready 🎛️✨');
  });
});
