import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import { siteVariableHrefCases } from '@/test/site-variable-link';
import { parseMarkdown } from './parse-markdown';

describe('authored form Markdown links', () => {
  it.each(siteVariableHrefCases)('resolves href once: $name', ({ source, expected, settings }) => {
    const html = renderToStaticMarkup(
      <ManifestProvider
        manifest={{ ...siteVariableManifest, settings: { ...siteVariableManifest.settings, ...settings } }}
      >
        {parseMarkdown(`[**Contact**](${source})`)}
      </ManifestProvider>,
    );
    expect(html).toContain('<strong>Contact</strong>');
    if (expected) {
      expect(html).toContain(`href="${expected}"`);
    } else {
      expect(html).not.toContain('<a ');
    }
  });
});
