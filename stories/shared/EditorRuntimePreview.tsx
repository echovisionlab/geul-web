import { fromJson } from '@bufbuild/protobuf';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { CellSelection } from '@tiptap/pm/tables';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import type { Editor as TiptapEditorInstance } from '@tiptap/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { semanticThemes } from '@/components/core/design-tokens';
import { SegmentedControl } from '@/components/core/Input';
import { LayoutInline, LayoutInset, LayoutStack } from '@/components/core/Layout';
import { SectionCard, ToolbarSurface } from '@/components/core/Section';
import { Code, Text } from '@/components/core/Typography';
import { MediaIngestDialog } from '@/features/editor/components/MediaIngestDialog';
import type { FileManagerFileRow } from '@/lib/actions/file';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import { createEditorLibraryFilePatch } from '@/features/editor/lib/editor-library-file-selection';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import { createTiptapPlaygroundRoom } from '@/features/editor/tiptap/TiptapPlayground.story-fixtures';
import classes from '@/features/editor/tiptap/TiptapPlayground.module.css';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { insertLocalPreviewFiles } from './local-media-insert';
import { localFilePreviewLabel } from './local-file-labels';
import { createLocalFileLibrarySource } from './local-file-library';

type RuntimeScenario = 'table' | 'code' | 'p5' | 'three' | 'shader' | 'callout' | 'file';
type PlaygroundRoom = ReturnType<typeof createTiptapPlaygroundRoom>;
const authoringMode = { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true };
const localUser = { name: 'Playground', color: semanticThemes.light['action-primary'] };

function PublishedDocument({ room }: { room: PlaygroundRoom }) {
  const locale = useLocale();
  const [blocks, setBlocks] = useState(() =>
    materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot()),
  );
  useEffect(
    () =>
      room.bridge.observe(() =>
        setBlocks(materializeLocalizedRichTextTree(room.controller.getLocalizedDocumentSnapshot())),
      ),
    [room],
  );
  return (
    <article className="prose document-content" data-playground-view="published">
      {blocks.map((block) => (
        <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={locale} />
      ))}
    </article>
  );
}

function ResidentPlayground({
  initialView = 'edit',
  initialScenario,
  onReset,
}: {
  initialView?: 'edit' | 'preview';
  initialScenario?: RuntimeScenario;
  onReset: () => void;
}) {
  const [room, setRoom] = useState<PlaygroundRoom | null>(null);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [view, setView] = useState(initialView);
  const [editor, setEditor] = useState<TiptapEditorInstance | null>(null);
  const [mediaOpened, setMediaOpened] = useState(initialScenario === 'file');
  const [runtimeStore] = useState(createEditorMediaRuntimeStore);
  const localUrls = useRef<string[]>([]);
  const uploadLifetime = useRef<AbortController | null>(null);
  const appliedScenario = useRef(false);
  const [libraryFiles, setLibraryFiles] = useState<FileManagerFileRow[]>([]);
  const locale = useLocale();
  const libraryDataSource = useMemo(() => createLocalFileLibrarySource(libraryFiles, locale), [libraryFiles, locale]);
  const mediaPort = useMemo(
    () => (editor ? createTiptapEditorMediaCommandPort(editor, { runtimeStore }) : null),
    [editor, runtimeStore],
  );
  const [fileError, setFileError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; type: string; size: number }[]>([]);
  const actions = useTranslations('common.actions');
  const labels = useTranslations('common.labels');
  const editorCopy = useTranslations('editorCommon.editor');
  const editorReady = useCallback((value: TiptapEditorInstance | null) => setEditor(value), []);
  useEffect(() => {
    const lifetime = new AbortController();
    uploadLifetime.current = lifetime;
    const current = createTiptapPlaygroundRoom(
      initialScenario
        ? fromJson(LocalizedRichTextDocumentSchema, {
            blockCatalogFingerprint: contentBlockCatalogFingerprint,
            profile: RichTextProfile.POST,
            locale: 'ko',
            base: {
              nodes: [
                {
                  block: { id: '10000000-0000-4000-8000-000000000300', paragraph: { props: {} } },
                  placement: { index: 0 },
                },
              ],
            },
            localeOverlay: {
              locale: 'ko',
              blocks: [{ blockId: '10000000-0000-4000-8000-000000000300', paragraph: { props: {}, content: [] } }],
            },
          })
        : undefined,
    );
    setRoom(current);
    return () => {
      lifetime.abort();
      if (uploadLifetime.current === lifetime) {
        uploadLifetime.current = null;
      }
      current.awareness.destroy();
      current.document.destroy();
      queryClient.clear();
      localUrls.current.forEach((url) => URL.revokeObjectURL(url));
      localUrls.current = [];
    };
  }, [queryClient, initialScenario]);
  useEffect(() => {
    if (!editor || !initialScenario || appliedScenario.current) {
      return;
    }
    appliedScenario.current = true;
    if (initialScenario === 'table') {
      editor.chain().focus('end').insertTable({ rows: 3, columns: 3, withHeaderRow: true }).run();
      const values = ['Instrument', 'Category', 'Status', 'Monome', 'Controller', 'Ready', 'TX–6', 'Mixer', 'Ready'];
      const positions: number[] = [];
      editor.state.doc.descendants((node, position) => {
        if (['tableCell', 'tableHeader'].includes(node.type.name)) {
          positions.push(position + 2);
        }
      });
      const content = editor.state.tr;
      for (let index = positions.length - 1; index >= 0; index -= 1) {
        content.insertText(values[index]!, positions[index]!);
      }
      editor.view.dispatch(content);
      let cell: number | undefined;
      editor.state.doc.descendants((node, position) => {
        if (cell === undefined && ['tableCell', 'tableHeader'].includes(node.type.name)) {
          cell = position;
        }
      });
      if (cell !== undefined) {
        editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, cell)));
      }
    } else if (initialScenario === 'code') {
      editor
        .chain()
        .focus('end')
        .insertContent({
          type: 'blockContainer',
          attrs: { id: '10000000-0000-4000-8000-000000000301' },
          content: [
            {
              type: 'codeBlock',
              attrs: { language: 'javascript' },
              content: [{ type: 'text', text: 'const value = 1;' }],
            },
          ],
        })
        .run();
      let code: number | undefined;
      editor.state.doc.descendants((node, position) => {
        if (code === undefined && node.type.name === 'codeBlock') {
          code = position;
        }
      });
      if (code !== undefined) {
        editor.chain().focus().setNodeSelection(code).run();
      }
    } else if (initialScenario !== 'file') {
      editor.chain().focus('end').run();
      if (initialScenario === 'p5') {
        editor.commands.insertP5Sketch({ mode: 'preview' });
      }
      if (initialScenario === 'three') {
        editor.commands.insertThreeScene({ mode: 'preview' });
      }
      if (initialScenario === 'shader') {
        editor.commands.insertShader({ mode: 'preview' });
      }
      if (initialScenario === 'callout') {
        editor.commands.insertContent({
          type: 'blockContainer',
          attrs: { id: '10000000-0000-4000-8000-000000000303' },
          content: [
            {
              type: 'callout',
              attrs: { icon: '💡' },
              content: [{ type: 'text', text: 'Callout with nested content' }],
            },
            {
              type: 'blockGroup',
              content: [
                {
                  type: 'blockContainer',
                  attrs: { id: '10000000-0000-4000-8000-000000000304' },
                  content: [{ type: 'paragraph' }],
                },
                {
                  type: 'blockContainer',
                  attrs: { id: '10000000-0000-4000-8000-000000000305' },
                  content: [{ type: 'callout', attrs: { icon: '🔥' } }],
                },
              ],
            },
          ],
        });
      }
      const nodeName = { p5: 'p5Sketch', three: 'threeScene', shader: 'shader', callout: 'callout' }[initialScenario];
      let nodePosition: number | undefined;
      editor.state.doc.descendants((node, position) => {
        if (nodePosition === undefined && node.type.name === nodeName) {
          nodePosition = position;
        }
      });
      if (nodePosition !== undefined) {
        editor.chain().focus().setNodeSelection(nodePosition).run();
      }
    }
  }, [editor, initialScenario]);
  const startSlash = () => {
    if (!editor) {
      return;
    }
    const group = editor.state.doc.firstChild;
    if (!group) {
      return;
    }
    // Preserve a dismissed slash draft and start a new, unambiguous command line.
    editor
      .chain()
      .insertContentAt(group.nodeSize - 1, {
        type: 'blockContainer',
        attrs: { id: crypto.randomUUID() },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '/' }] }],
      })
      .focus('end')
      .run();
  };
  const selectText = () => {
    if (!editor) {
      return;
    }
    let range: { from: number; to: number } | undefined;
    editor.state.doc.descendants((node, position) => {
      if (!range && node.isText && node.text?.trim()) {
        range = { from: position, to: position + Math.min(node.text.length, 12) };
      }
    });
    if (range) {
      editor.chain().focus().setTextSelection(range).run();
    }
  };
  if (!room) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutInset space={{ base: 'sm', sm: 'lg' }}>
        <div className={classes.playground}>
          <LayoutStack gap="md">
            <ToolbarSurface label={labels('preview')} width="full" appearance="embedded">
              <LayoutInline gap="sm" wrap="wrap" flexible>
                <SegmentedControl
                  aria-label={actions('view')}
                  value={view}
                  onChange={(value) => setView(value === 'edit' ? 'edit' : 'preview')}
                  data={[
                    { value: 'edit', label: actions('edit') },
                    { value: 'preview', label: labels('preview') },
                  ]}
                />
                <Button onClick={onReset} size="xs">
                  {actions('refresh')}
                </Button>
                {view === 'edit' && !initialScenario ? (
                  <>
                    <Button size="xs" onClick={selectText} disabled={!editor}>
                      {editorCopy('formatting.blockType')}
                    </Button>
                    <Button size="xs" onClick={startSlash} disabled={!editor}>
                      {actions('add')}
                    </Button>
                    <Button
                      size="xs"
                      onClick={() =>
                        editor?.chain().focus('end').insertTable({ rows: 3, columns: 3, withHeaderRow: true }).run()
                      }
                      disabled={!editor}
                    >
                      {editorCopy('slashMenu.items.table.title')}
                    </Button>
                  </>
                ) : null}
                {!initialScenario || initialScenario === 'file' ? (
                  <Button size="xs" onClick={() => setMediaOpened(true)}>
                    {labels('file')}
                  </Button>
                ) : null}
              </LayoutInline>
            </ToolbarSurface>
            <SectionCard padding="none" withBorder>
              <div className={classes.resident}>
                <EditorAuthoringModeProvider value={authoringMode}>
                  <div hidden={view !== 'edit' && selectedFiles.length === 0} data-playground-view="editor">
                    <TiptapEditor
                      blockRoomController={room.controller}
                      mediaRuntimeStore={runtimeStore}
                      awareness={room.awareness}
                      localUser={localUser}
                      ai={false}
                      editable={view === 'edit'}
                      autoRunReadOnlyExecutables={false}
                      onEditorReady={editorReady}
                      authoringCapabilities={{
                        ai: false,
                        file: !initialScenario || initialScenario === 'file',
                        map: false,
                      }}
                      onFileActivate={() => setMediaOpened(true)}
                    />
                  </div>
                  {view === 'preview' && selectedFiles.length === 0 ? (
                    <LayoutInset space="md">
                      <PublishedDocument room={room} />
                    </LayoutInset>
                  ) : null}
                </EditorAuthoringModeProvider>
              </div>
            </SectionCard>
            {selectedFiles.length ? (
              <Code block wrap="anywhere">
                {JSON.stringify(selectedFiles, null, 2)}
              </Code>
            ) : null}
            {fileError ? <Text tone="danger">{fileError}</Text> : null}
            {initialScenario === 'file' && (
              <Text size="xs" tone="secondary">
                {localFilePreviewLabel(locale)}
              </Text>
            )}
          </LayoutStack>
        </div>
      </LayoutInset>
      {mediaPort ? (
        <MediaIngestDialog
          opened={mediaOpened}
          editor={mediaPort}
          selectedBlock={{ id: '10000000-0000-4000-8000-000000000405', type: 'file', props: {} }}
          blockType="file"
          mode="add"
          onClose={() => setMediaOpened(false)}
          libraryDataSource={libraryDataSource}
          onUploadFiles={async (files) => {
            const lifetime = uploadLifetime.current;
            if (!editor || !lifetime || lifetime.signal.aborted) {
              return;
            }
            setFileError('');
            editor.chain().focus('end').run();
            await insertLocalPreviewFiles({
              editor,
              runtimeStore,
              signal: lifetime.signal,
              files,
              retainUrl: (url) => localUrls.current.push(url),
              onError: (name, message) => setFileError(`${name}: ${message}`),
              onDelivered: (id, file, url) => {
                const extension = file.name.includes('.') ? file.name.split('.').at(-1)! : '';
                setLibraryFiles((current) => [
                  ...current,
                  {
                    kind: 'file',
                    id,
                    fileName: extension ? file.name.slice(0, -(extension.length + 1)) : file.name,
                    extension,
                    mimeType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                    createdAt: new Date(file.lastModified).toISOString(),
                    updatedAt: new Date(file.lastModified).toISOString(),
                    usageCount: 1,
                    inlineUrl: url,
                    downloadUrl: url,
                  },
                ]);
              },
            });
            if (!lifetime.signal.aborted && !editor.isDestroyed) {
              setSelectedFiles(files.map((file) => ({ name: file.name, type: file.type, size: file.size })));
            }
          }}
          onSelectLibraryFiles={(files) => {
            editor?.chain().focus('end').run();
            for (const file of files) {
              mediaPort.insertBlock(
                { type: 'file', props: createEditorLibraryFilePatch('file', {}, file) },
                mediaPort.captureInsertPosition(),
              );
            }
          }}
        />
      ) : null}
    </QueryClientProvider>
  );
}

export function EditorRuntimePreview({
  initialView = 'edit',
  initialScenario,
}: {
  initialView?: 'edit' | 'preview';
  initialScenario?: RuntimeScenario;
}) {
  const [generation, setGeneration] = useState(0);
  return (
    <ResidentPlayground
      key={generation}
      initialView={initialView}
      initialScenario={initialScenario}
      onReset={() => setGeneration((value) => value + 1)}
    />
  );
}
