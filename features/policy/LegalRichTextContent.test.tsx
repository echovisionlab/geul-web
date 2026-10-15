// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { renderToReadableStream } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { siteVariableManifest } from '@/features/editor/tiptap/site-variables/site-variable.story-fixtures';
import {
  resolvedSiteVariableLinkLabel,
  siteVariableLinkBlock,
  siteVariableHrefCases,
  siteVariableHrefBlock,
} from '@/test/site-variable-link';
import enMessages from '@/messages/en.json';
import { LegalRichTextContent } from './LegalRichTextContent';

vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});

describe('LegalRichTextContent', () => {
  it.each(siteVariableHrefCases)('renders policy href: $name', async ({ source, expected, settings }) => {
    const stream = await renderToReadableStream(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <ManifestProvider
          manifest={{ ...siteVariableManifest, settings: { ...siteVariableManifest.settings, ...settings } }}
        >
          <LegalRichTextContent blocks={[siteVariableHrefBlock(source)]} className="policy-content" />
        </ManifestProvider>
      </NextIntlClientProvider>,
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain('<strong>Contact</strong>');
    if (expected) {
      expect(html).toContain(`href="${expected}"`);
    } else {
      expect(html).not.toContain('<a ');
    }
  });

  it('renders migrated policy link labels with the six manifest values and preserves literal unknown tokens', async () => {
    const stream = await renderToReadableStream(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <ManifestProvider manifest={siteVariableManifest}>
          <LegalRichTextContent
            blocks={[siteVariableLinkBlock]}
            className="policy-content"
            contentLocale="en"
            readingMeasure
          />
        </ManifestProvider>
      </NextIntlClientProvider>,
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain('class="policy-content" lang="en" data-reading-measure=""');
    expect(html).toContain('href="/tools/hwp"');
    expect(html).toContain(`<strong>${resolvedSiteVariableLinkLabel}</strong>`);
  });
});
