// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';
import { EditorFileInsertView } from './EditorFileInsertView';

describe('EditorFileInsertView', () => {
  it('emphasizes upload while keeping the library action secondary', () => {
    const html = renderToStaticMarkup(
      <DesignSystemProvider forceColorScheme="light">
        <EditorFileInsertView
          labels={{
            description: 'Upload files or choose from the library.',
            browse: 'Browse files',
            openLibrary: 'File library',
          }}
          onBrowse={vi.fn()}
          onOpenLibrary={vi.fn()}
        />
      </DesignSystemProvider>,
    );

    const document = new DOMParser().parseFromString(html, 'text/html');
    const buttons = [...document.querySelectorAll('button')];

    expect(buttons).toHaveLength(2);
    const descriptionId = buttons[1].getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Upload files or choose from the library.');
    expect(buttons[1].textContent).toBe('Browse files');
    expect(buttons[1].hasAttribute('aria-label')).toBe(false);
    expect(buttons.map((button) => button.dataset.controlSize)).toEqual(['xs', 'xs']);
    expect(buttons.map((button) => button.dataset.tone)).toEqual(['neutral', 'neutral']);
    expect(buttons.map((button) => button.dataset.emphasis)).toEqual(['low', 'strong']);
  });
});
