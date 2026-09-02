// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { describe, expect, it, vi } from 'vitest';
import { EditorFileInsertView } from './EditorFileInsertView';

describe('EditorFileInsertView', () => {
  it('presents upload and library as equal neutral choices', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <EditorFileInsertView
          labels={{
            description: 'Upload files or choose from the library.',
            browse: 'Browse files',
            openLibrary: 'File library',
          }}
          onBrowse={vi.fn()}
          onOpenLibrary={vi.fn()}
        />
      </MantineProvider>,
    );

    const document = new DOMParser().parseFromString(html, 'text/html');
    const buttons = [...document.querySelectorAll('button')];

    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.dataset.tone)).toEqual(['neutral', 'neutral']);
    expect(buttons.map((button) => button.dataset.emphasis)).toEqual(['medium', 'medium']);
  });
});
