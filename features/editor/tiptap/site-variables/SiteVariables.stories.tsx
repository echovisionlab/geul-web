import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import type { Editor } from '@tiptap/core';
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test';
import { createTranslator } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { ManifestProvider } from '@/lib/contexts/ManifestContext';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { TiptapEditor } from '../TiptapEditor';
import { createTiptapPlaygroundRoom } from '../TiptapPlayground.story-fixtures';
import { siteVariableDocument, siteVariableManifest } from './site-variable.story-fixtures';
import { siteVariableHrefBlock, siteVariableHrefCases } from '@/test/site-variable-link';

/** Public settings and a local Y.Doc are fixtures; no settings writes or network requests. */
function Preview({ reader = false, query = false }: { reader?: boolean; query?: boolean }) {
  const [room, setRoom] = useState<ReturnType<typeof createTiptapPlaygroundRoom>>();
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => {
    const current = createTiptapPlaygroundRoom(siteVariableDocument(query));
    setRoom(current);
    return () => {
      current.awareness.destroy();
      current.document.destroy();
    };
  }, [query]);
  useEffect(() => {
    if (query && editor) {
      editor.chain().focus('end').run();
    }
  }, [editor, query]);
  return (
    <ManifestProvider manifest={siteVariableManifest}>
      <LayoutStack gap="md">
        {room && !reader ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                editor?.chain().focus('end').insertContent('/site').run();
              }}
            >
              Add
            </Button>
            <EditorAuthoringModeProvider value={{ allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true }}>
              <TiptapEditor
                blockRoomController={room.controller}
                awareness={room.awareness}
                localUser={{ name: 'Author', color: '#b02d23' }}
                onEditorReady={setEditor}
                ai={false}
              />
            </EditorAuthoringModeProvider>
          </>
        ) : null}
        {reader ? (
          <article className="prose document-content">
            {materializeLocalizedRichTextTree(siteVariableDocument()).map((block) => (
              <GeneratedRichTextBlockView key={block.id} block={block} />
            ))}
          </article>
        ) : null}
      </LayoutStack>
    </ManifestProvider>
  );
}
const meta = {
  title: 'Feature/Editor/Site Variables',
  component: Preview,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Story assertions follow the active toolbar locale, so they hold in every language. */
async function storyTranslator(globals: Record<string, unknown>) {
  const locale = normalizeLocale(typeof globals.locale === 'string' ? globals.locale : undefined) ?? DEFAULT_LOCALE;
  const { default: messages } = await import(`../../../../messages/${locale}.json`);
  return createTranslator({ locale, messages, namespace: 'editorCommon.editor.siteVariables' });
}

async function chip(canvasElement: HTMLElement, key = 'site.title') {
  return waitFor(() => {
    const element = canvasElement.querySelector<HTMLButtonElement>(`[data-site-variable="${key}"] button`);
    expect(element).not.toBeNull();
    return element!;
  });
}
export const Paragraph: Story = {
  play: async ({ canvasElement }) => {
    expect(await chip(canvasElement)).toBeVisible();
  },
};
export const DarkParagraph: Story = {
  ...Paragraph,
  parameters: {
    docs: { description: { story: 'Select Dark in the shared theme toolbar to inspect this paragraph.' } },
  },
};
export const PickerOpen: Story = {
  args: { query: true },
  play: async ({ canvasElement }) => {
    // The query document ends with the slash query, so the menu opens on load.
    const option = await waitFor(() => {
      // The slash menu and picker render in a portal.
      const item = canvasElement.ownerDocument.querySelector<HTMLElement>(
        '[data-testid="tiptap-slash-item-site-variable"]',
      );
      expect(item).not.toBeNull();
      return item!;
    });
    // The only match is highlighted; Enter chooses it as a keyboard author would.
    await waitFor(() => expect(option).toHaveAttribute('aria-selected', 'true'));
    // Sent to the editor itself: a headless runner does not always give the page keyboard focus.
    fireEvent.keyDown(canvasElement.querySelector('.ProseMirror')!, { key: 'Enter', code: 'Enter' });
    // The picker loads on demand.
    await waitFor(
      () => expect(canvasElement.ownerDocument.querySelector('[data-testid="site-variable-picker"]')).not.toBeNull(),
      { timeout: 5000 },
    );
    const options = await waitFor(() => {
      const found = document.querySelectorAll<HTMLElement>('[role="option"]');
      expect(found).toHaveLength(6);
      return found;
    });
    // Choosing a value closes the picker and inserts the variable at the caret.
    await userEvent.click(options[0]!);
    expect(await chip(canvasElement, 'site.title')).toBeVisible();
  },
};
export const Inspector: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = await storyTranslator(globals);
    await userEvent.click(await chip(canvasElement));
    const dialog = await within(document.body).findByRole('dialog', { name: t('inspect') });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: t('convert') })).toBeVisible());
  },
};
export const LinkedContact: Story = {
  play: async ({ canvasElement, globals }) => {
    const t = await storyTranslator(globals);
    await userEvent.click(await chip(canvasElement, 'contact.supportEmail'));
    const dialog = await within(document.body).findByRole('dialog', { name: t('inspect') });
    expect(within(dialog).getByRole('checkbox', { name: t('linked') })).toBeChecked();
  },
};
export const PublicReader: Story = {
  args: { reader: true },
  play: async ({ canvasElement }) => {
    const link = await within(canvasElement).findByRole('link', { name: 'support@example.com' });
    expect(link).toHaveAttribute('href', 'mailto:support@example.com');
    expect(canvasElement).toHaveTextContent('Welcome to Rawsector.');
    expect(canvasElement.querySelector('[data-site-variable]')).toBeNull();
  },
};

/** The production reader must keep unsafe destinations as styled text and expand values once. */
export const PublicTokenLinks: Story = {
  render: () => (
    <LayoutStack gap="md">
      {siteVariableHrefCases.map(({ name, source, settings }) => (
        <ManifestProvider
          key={name}
          manifest={{ ...siteVariableManifest, settings: { ...siteVariableManifest.settings, ...settings } }}
        >
          <article className="prose document-content" aria-label={name}>
            <p>{name}</p>
            <GeneratedRichTextBlockView block={siteVariableHrefBlock(source)} />
          </article>
        </ManifestProvider>
      ))}
    </LayoutStack>
  ),
};
