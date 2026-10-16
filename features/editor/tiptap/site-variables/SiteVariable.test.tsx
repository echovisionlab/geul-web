// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '@tiptap/core';
import { EditorContent } from '@tiptap/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import en from '@/messages/en.json';
import { createTiptapWireExtensions } from '../wire-schema';
import { siteVariableManifest } from './site-variable.story-fixtures';

describe('siteVariable editor adapter', () => {
  it('refreshes a resolved chip without editing the document, then converts it to literal text', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const editor = new Editor({
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: '10000000-0000-4000-8000-000000000401' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'Hello ' },
                      { type: 'siteVariable', attrs: { key: 'site.title', linked: false } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const render = async (title: string) => {
      await act(async () =>
        root.render(
          <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
            <DesignSystemProvider locale="en" forceColorScheme="light">
              <ManifestProvider
                manifest={{
                  ...siteVariableManifest,
                  settings: { ...siteVariableManifest.settings, site_title: title },
                }}
              >
                <EditorContent editor={editor} />
              </ManifestProvider>
            </DesignSystemProvider>
          </NextIntlClientProvider>,
        ),
      );
    };
    try {
      await render('rawsector');
      const authored = editor.getJSON();
      expect(host.querySelector('button[aria-label="Site name: rawsector"]')).not.toBeNull();
      expect(editor.getText()).toContain('Hello rawsector');
      await render('Updated site');
      expect(host.querySelector('button[aria-label="Site name: Updated site"]')).not.toBeNull();
      expect(editor.getJSON()).toEqual(authored);
      await act(async () =>
        host.querySelector<HTMLButtonElement>('button[aria-label="Site name: Updated site"]')!.click(),
      );
      expect(document.querySelector('[role="dialog"][aria-label="Inspect variable"]')).not.toBeNull();
      const convert = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === 'Convert to text',
      );
      expect(convert).toBeDefined();
      await act(async () => convert!.click());
      expect(editor.getText()).toContain('Hello Updated site');
      expect(JSON.stringify(editor.getJSON())).not.toContain('siteVariable');
    } finally {
      await act(async () => root.unmount());
      editor.destroy();
      host.remove();
    }
  });
});
