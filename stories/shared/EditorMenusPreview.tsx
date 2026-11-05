'use client';
import { useEffect, useState, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useLocale, useMessages, useTranslations, type Messages } from 'next-intl';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '@/features/editor/tiptap/wire-schema';
import { TiptapAuthoringControls } from '@/features/editor/tiptap/TiptapAuthoringControls';
import {
  createSelectionBubbleMenuLabels,
  SelectionBubbleMenuView,
  TiptapSelectionBubbleMenu,
} from '@/features/editor/tiptap/menus/SelectionBubbleMenu';
import { createSelectionBubbleMenuCommands } from '@/features/editor/tiptap/menus/selection-bubble-commands';
import { TiptapBlockMenu, TIPTAP_BLOCK_COLORS, type TiptapBlockColor } from '@/features/editor/tiptap/TiptapBlockMenu';
import { MapSelectionMenu } from '@/features/editor/tiptap/menus/map-external/MapSelectionMenu';
import { ExternalVideoSelectionMenu } from '@/features/editor/tiptap/menus/map-external/ExternalVideoSelectionMenu';
import type { ContextualBlockAlignment } from '@/features/editor/tiptap/menus/map-external/AlignmentMenuActions';
import type { ExternalVideoAspectRatio } from '@echovisionlab/geul-common/media/block-schemas';
import { useDisplaySizeLabels } from '@/features/editor/tiptap/menus/map-external/useDisplaySizeLabels';

const authoringMode = { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true };
const documentWithText = (text: string) => ({
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [
        {
          type: 'blockContainer',
          attrs: { id: 'kit-document' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        },
      ],
    },
  ],
});

/** Local editor state, actual production wire schema, commands and menu views. */
export function EditorSelectionPreview({
  kind = 'bubble',
  floating = false,
}: {
  kind?: 'bubble' | 'slash';
  floating?: boolean;
}) {
  const locale = useLocale();
  const messages = useMessages() as Messages;
  const actions = useTranslations('common.actions');
  const common = useTranslations('common.labels');
  const labels = useTranslations('common.labels');
  const [, refresh] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createTiptapWireExtensions(),
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': common('content'), 'aria-multiline': 'true', lang: locale },
    },
    content: documentWithText(kind === 'slash' ? '/' : 'Select this sentence to format it.'),
    onTransaction: () => refresh((value) => value + 1),
  });
  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.commands.focus();
    editor.commands.setTextSelection(kind === 'slash' ? 4 : { from: 3, to: 16 });
  }, [editor, kind]);
  if (!editor) {
    return null;
  }
  const menuLabels = createSelectionBubbleMenuLabels(messages.editorCommon.editor, {
    save: actions('save'),
    more: common('options'),
    cancel: actions('cancel'),
  });
  return (
    <EditorAuthoringModeProvider value={authoringMode}>
      <LayoutStack gap="md">
        <LayoutInline gap="sm">
          <Button
            onClick={() => {
              editor.commands.setContent(
                documentWithText(kind === 'slash' ? '/' : 'Select this sentence to format it.'),
              );
              editor.commands.focus();
              editor.commands.setTextSelection(kind === 'slash' ? 4 : { from: 3, to: 16 });
            }}
          >
            {actions('refresh')}
          </Button>
          <Text size="sm">{labels('preview')}</Text>
        </LayoutInline>
        {kind === 'bubble' && !floating ? (
          <SelectionBubbleMenuView
            commands={createSelectionBubbleMenuCommands(editor)}
            labels={menuLabels}
            selectionSnapshot={{ from: editor.state.selection.from, to: editor.state.selection.to }}
            editorElement={editor.view.dom}
            navigationEnabled
          />
        ) : null}
        <div className="tiptap-editor document-content" style={{ position: 'relative', minHeight: 360 }}>
          <EditorContent editor={editor} />
          {kind === 'slash' ? (
            <TiptapAuthoringControls
              editor={editor}
              capabilities={{
                file: false,
                map: false,
                externalVideo: false,
                p5: false,
                shader: false,
                three: false,
                mermaid: false,
                table: false,
              }}
            />
          ) : floating ? (
            <TiptapSelectionBubbleMenu editor={editor} labels={menuLabels} />
          ) : null}
        </div>
      </LayoutStack>
    </EditorAuthoringModeProvider>
  );
}

export function ContextualMenuPreview({ kind = 'map' }: { kind?: 'map' | 'external-video' }) {
  const t = useTranslations('editorCommon.editor');
  const common = useTranslations('common.labels');
  const actions = useTranslations('common.actions');
  const runtime = useTranslations('editorCommon.editor.runtimeLabels');
  const placesCopy = useTranslations('editorCommon.mapPlacesModal');
  const [alignment, setAlignment] = useState<ContextualBlockAlignment>('left');
  const [aspectRatio, setAspectRatio] = useState<ExternalVideoAspectRatio>('16:9');
  const [places, setPlaces] = useState([{ id: 'studio', name: 'Studio', centered: true }]);
  const [deleted, setDeleted] = useState(false);
  const [editingLink, setEditingLink] = useState(false);
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [caption, setCaption] = useState('');
  const captionInput = useRef<HTMLInputElement>(null);
  const displaySizeLabels = useDisplaySizeLabels();
  const [displaySize, setDisplaySize] = useState(60);
  const sharedLabels = {
    alignment: t('formatting.alignment'),
    alignLeft: t('formatting.alignLeft'),
    alignCenter: t('formatting.alignCenter'),
    alignRight: t('formatting.alignRight'),
    ...displaySizeLabels,
  };
  return (
    <LayoutStack gap="md">
      {deleted ? (
        <Button onClick={() => setDeleted(false)}>{actions('refresh')}</Button>
      ) : kind === 'map' ? (
        <MapSelectionMenu
          labels={{
            ...sharedLabels,
            menu: t('embeds.map'),
            places: t('map.managePlaces'),
            addPlace: actions('add'),
            centerPlace: placesCopy('setAsCenterTitle'),
            removePlace: actions('remove'),
            width: common('width'),
            resizeHint: t('resize.map'),
            resizing: t('resize.map'),
            focusCaption: common('caption'),
            deleteBlock: actions('delete'),
          }}
          places={places}
          textAlignment={alignment}
          displaySize={displaySize}
          onChangeAlignment={setAlignment}
          onChangeDisplaySize={setDisplaySize}
          onAddPlace={() =>
            setPlaces((value) => [
              ...value,
              { id: `place-${value.length}`, name: `Place ${value.length + 1}`, centered: false },
            ])
          }
          onRemovePlace={(id) => setPlaces((value) => value.filter((place) => place.id !== id))}
          onCenterPlace={(id) => setPlaces((value) => value.map((place) => ({ ...place, centered: place.id === id })))}
          onFocusCaption={() => captionInput.current?.focus()}
          onDelete={() => setDeleted(true)}
        />
      ) : (
        <ExternalVideoSelectionMenu
          labels={{
            ...sharedLabels,
            menu: t('embeds.externalVideo'),
            editLink: runtime('externalVideo.editLink'),
            aspectRatio: runtime('externalVideo.aspectRatio'),
            automaticAspectRatio: runtime('externalVideo.automaticAspectRatio'),
            width: common('width'),
            resizeHint: t('resize.externalVideo'),
          }}
          aspectRatio={aspectRatio}
          textAlignment={alignment}
          displaySize={displaySize}
          onChangeAspectRatio={setAspectRatio}
          onChangeAlignment={setAlignment}
          onChangeDisplaySize={setDisplaySize}
          onEditLink={() => setEditingLink((value) => !value)}
        />
      )}
      {!deleted && (
        <div data-testid="contextual-block-preview" style={{ textAlign: alignment }}>
          {kind === 'map' ? (
            <LayoutStack gap="xs">
              {places.map((place) => (
                <Text key={place.id} weight={place.centered ? 'strong' : 'regular'}>
                  {place.name}
                </Text>
              ))}
              <TextInput
                ref={captionInput}
                label={common('caption')}
                value={caption}
                onChange={(event) => setCaption(event.currentTarget.value)}
              />
            </LayoutStack>
          ) : (
            <LayoutStack gap="sm">
              {editingLink && (
                <TextInput
                  label={runtime('externalVideo.editLink')}
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                />
              )}
              <a href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <Text>{aspectRatio}</Text>
            </LayoutStack>
          )}
        </div>
      )}
    </LayoutStack>
  );
}

export function BlockMenuPreview() {
  const t = useTranslations('editorCommon.editor');
  const [textColor, setTextColor] = useState<TiptapBlockColor>('default');
  const [backgroundColor, setBackgroundColor] = useState<TiptapBlockColor>('default');
  const [deleted, setDeleted] = useState(false);
  const labels = {
    open: t('drag.openBlockMenu'),
    delete: t('drag.delete'),
    colors: t('drag.colors'),
    textColor: t('colors.text'),
    backgroundColor: t('colors.background'),
    colorNames: Object.fromEntries(TIPTAP_BLOCK_COLORS.map((color) => [color, t(`colors.names.${color}`)])) as Record<
      TiptapBlockColor,
      string
    >,
  };
  return (
    <LayoutStack gap="md">
      {!deleted && (
        <TiptapBlockMenu
          labels={labels}
          canSetTextColor
          canSetBackgroundColor
          textColor={textColor}
          backgroundColor={backgroundColor}
          canDelete={!deleted}
          onDelete={() => setDeleted(true)}
          onTextColorChange={setTextColor}
          onBackgroundColorChange={setBackgroundColor}
        />
      )}
      <div className="prose document-content" data-testid="block-color-preview">
        {!deleted && (
          <p data-text-color={textColor} data-bg-color={backgroundColor}>
            Select this block to change its colors.
          </p>
        )}
      </div>
      {deleted && <Button onClick={() => setDeleted(false)}>{t('formatting.blockType')}</Button>}
    </LayoutStack>
  );
}
