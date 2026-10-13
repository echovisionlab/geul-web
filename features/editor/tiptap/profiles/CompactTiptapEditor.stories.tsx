import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { fromJson } from '@bufbuild/protobuf';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { createBlockRoomProseMirrorBridge } from '../block-room-prosemirror-bridge';
import { createRichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { CompactTiptapEditor, createCompactTiptapExtensions } from './CompactTiptapEditor';
import { EditorContent, useEditor } from '@tiptap/react';
import { createTiptapBlockContainer } from '../TiptapBlockContainerNodeView';
import editorClasses from '../TiptapEditor.module.css';
const meta = { title: 'Feature/Editor/Compact Frame' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
function useCompactFixture() {
  const locale = useLocale();
  const fixture = useMemo(() => {
    const document = new Y.Doc();
    const id = '019cce25-dbc0-7d12-9f1f-735b1a6c6b31';
    const text =
      locale === 'ko'
        ? '필요한 내용만 담는 짧은 소개입니다.'
        : locale === 'ar'
          ? 'نبذة قصيرة يمكن تحديدها ونسخها.'
          : 'A short description that remains selectable and readable.';
    hydrateCanonicalBlockRoom(
      document,
      'artist',
      locale,
      fromJson(LocalizedRichTextDocumentSchema, {
        blockCatalogFingerprint: contentBlockCatalogFingerprint,
        profile: RichTextProfile.COMPACT,
        locale,
        base: { nodes: [{ block: { id, paragraph: { props: {} } }, placement: { index: 0 } }] },
        localeOverlay: { locale, blocks: [{ blockId: id, paragraph: { props: {}, content: [{ text: { text } }] } }] },
      }),
      [],
    );
    const bridge = createBlockRoomProseMirrorBridge({ document, documentType: 'artist', locale });
    return {
      document,
      awareness: new Awareness(document),
      controller: createRichTextBlockRoomTiptapController(bridge),
    };
  }, [locale]);
  useEffect(
    () => () => {
      fixture.awareness.destroy();
      fixture.document.destroy();
    },
    [fixture],
  );
  return fixture;
}
function CompactPreview({ readOnly = false }: { readOnly?: boolean }) {
  const fixture = useCompactFixture();
  return (
    <CompactTiptapEditor
      id="compact-description-preview"
      blockRoomController={fixture.controller}
      awareness={fixture.awareness}
      readOnly={readOnly}
    />
  );
}
export const Editable: Story = { render: () => <CompactPreview /> };
export const ReadOnly: Story = { render: () => <CompactPreview readOnly /> };

/** Real node view and canonical controller, isolated from unrelated media/executable previews. */
function BlockGutterPreview() {
  const fixture = useCompactFixture();
  const extensions = useMemo(
    () => [
      ...createCompactTiptapExtensions('').filter((extension) => extension.name !== 'blockContainer'),
      createTiptapBlockContainer({ allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true }),
      fixture.controller.extension,
    ],
    [fixture],
  );
  const editor = useEditor(
    {
      extensions,
      content: fixture.controller.initialContent,
      immediatelyRender: false,
      editorProps: { attributes: { class: editorClasses.content, 'data-testid': 'tiptap-editor-content' } },
    },
    [extensions],
  );
  useEffect(() => (editor ? fixture.controller.connect(editor) : undefined), [editor, fixture]);
  return (
    <div className={editorClasses.editor} data-editor-editable="true">
      <EditorContent editor={editor} className={editorClasses.surface} />
    </div>
  );
}
export const BlockGutter: Story = { render: () => <BlockGutterPreview /> };
