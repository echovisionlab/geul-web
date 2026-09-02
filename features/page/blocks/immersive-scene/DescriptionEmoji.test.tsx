// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { immersiveSceneDocumentToMarkdown, markdownToImmersiveSceneDocument } from './DescriptionEditor';
import { ImmersiveSceneView } from './View';

describe('immersive scene Description emoji', () => {
  it('preserves Unicode emoji through the Tiptap Markdown profile and scene rendering', () => {
    const markdown = immersiveSceneDocumentToMarkdown(markdownToImmersiveSceneDocument('Signal ready 🎛️✨'));
    expect(markdown).toBe('Signal ready 🎛️✨');
    expect(immersiveSceneDocumentToMarkdown(markdownToImmersiveSceneDocument(markdown))).toBe(markdown);

    const html = renderToStaticMarkup(
      <TestProviders>
        <ImmersiveSceneView
          props={{
            unitsJson: '[{"id":"single","mesh":"sphere","color":"#ffffff"}]',
            copyJson: JSON.stringify([{ id: 'single', title: 'Emoji', text: markdown }]),
          }}
        />
      </TestProviders>,
    );

    expect(html).toContain('Signal ready 🎛️✨');
  });
});
