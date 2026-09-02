'use client';

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import {
  useOptionalEditorAuthoringMode,
  useRegisterEditorAuthoringMode,
  type EditorAuthoringMode,
} from '@/features/editor/EditorAuthoringMode';
import { createCollaborationExtension, type CollaborationUser } from './collaboration';
import { CodeBlockSelectionMenu, createTiptapCodeBlock, type CodeBlockSelectionMenuLabels } from './code';
import { TiptapAIAssistantSurface, useTiptapAIController } from './ai/TiptapAIController';
import type { TiptapAINodeTypes } from './ai';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import { createBrowserAIEditorAssistantClient, type AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';
import { createTiptapFileNode } from './TiptapFileBlockNodeView';
import {
  createTiptapExternalVideoExtension,
  updateTiptapExternalVideoSource,
  type TiptapExternalVideoLabels,
  type TiptapExternalVideoOptions,
} from './external-video';
import { ExternalVideoInsertDialog } from '@/features/editor/ExternalVideoInsertDialog';
import { replaceParagraphWithExternalVideoLink } from '@/features/editor/external-video-insert';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';
import type { TiptapAnyExtension } from '@/lib/editor/extensions/tiptap';
import type { EditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import type { RichTextBlockRoomTiptapController } from './block-room-tiptap-controller';
import { createBlockRoomPresenceExtension } from './block-room-presence';
import { createTiptapMapNode, type TiptapMapNodeOptions } from './map';
import type { SelectionBubbleMenuLabels } from './menus';
import {
  createExecutableSelectionMenuRegistry,
  ExecutableSelectionMenuRegistryProvider,
  TiptapExecutableSelectionBubbleMenu,
  type ExecutableSelectionMenuRegistry,
} from './menus/executable';
import {
  createTiptapMapSelectionMenuRegistry,
  TiptapExternalVideoSelectionBubbleMenu,
  TiptapMapSelectionBubbleMenu,
  TiptapMapSelectionMenuRegistryProvider,
  type ExternalVideoSelectionMenuLabels,
  type MapSelectionMenuLabels,
  type TiptapMapSelectionMenuRegistry,
} from './menus/map-external';
import { withTiptapMathExtensions } from './math';
import { createP5SketchExtension, type P5SketchLabels } from './p5';
import {
  createShaderExtension,
  type ShaderAssetResolver,
  type ShaderFilePickerProps,
  type ShaderLabels,
} from './shader';
import {
  createTiptapPaginationExtension,
  resolvePaginationLayout,
  type PaginationInput,
  type PaginationLayout,
} from './pagination';
import { createTiptapTableExtensions } from './table';
import { createThreeSceneExtension, type ThreeSceneLabels } from './three';
import { createAuthoringShortcutGuard } from './integration/authoring-shortcuts';
import { BlockBoundaryNavigation } from './integration/block-boundary-navigation';
import { TiptapContextualMenuRouter } from './integration/contextual-menu-router';
import { createTiptapBlockContainer } from './TiptapBlockContainerNodeView';
import {
  TiptapAuthoringControls,
  type TiptapAuthoringCapabilities,
  type TiptapAuthoringControlsCallbacks,
  type TiptapSlashActionContext,
} from './TiptapAuthoringControls';
import { createTiptapWireExtensions } from './wire-schema';
import classes from './TiptapEditor.module.css';

const DENIED_AUTHORING_MODE: EditorAuthoringMode = {
  allowNeutralBlockEdits: false,
  allowLocalizedBlockEdits: false,
};
const EMPTY_ADDITIONAL_EXTENSIONS: readonly TiptapAnyExtension[] = [];

type RuntimeExternalVideoOptions = Omit<TiptapExternalVideoOptions, 'labels'> & {
  labels: TiptapExternalVideoLabels;
};

interface TiptapEditorAIOptions {
  client?: AIEditorAssistantClient;
  target: AIDocumentTarget;
  supportedNodeTypes?: TiptapAINodeTypes;
  onClose?: () => void;
}

interface TiptapEditorSharedProps {
  editable?: boolean;
  onFileActivate?: TiptapAuthoringControlsCallbacks['onFileActivate'];
  mediaRuntimeStore?: EditorMediaRuntimeStore;
  externalVideo?: TiptapExternalVideoOptions | false;
  ai?: TiptapEditorAIOptions | false;
  map?: TiptapMapNodeOptions;
  authoringCallbacks?: Omit<TiptapAuthoringControlsCallbacks, 'onFileActivate'>;
  className?: string;
  pagination?: PaginationInput;
  paginationLead?: ReactNode;
  shaderFilePicker?: ComponentType<ShaderFilePickerProps>;
  resolveShaderAsset?: ShaderAssetResolver;
  /** Disables read-only executable runtimes for hidden synchronization mirrors. */
  autoRunReadOnlyExecutables?: boolean;
  /** Keeps locale-owned text editable while rejecting block structure changes. */
  structureLocked?: boolean;
  /** Internal extension port for entity-owned editor integrations. */
  additionalExtensions?: readonly TiptapAnyExtension[];
  /** Internal integration port for fragment ownership and projection. */
  onEditorReady?: (editor: Editor | null) => void;
  /** Narrows the shared command surface to the active durable profile. */
  authoringCapabilities?: TiptapAuthoringCapabilities;
}

type TiptapEditorCollaborationBinding =
  | {
      /** Typed one-entity Block-room authority. */
      blockRoomController: RichTextBlockRoomTiptapController;
      fragment?: never;
      awareness: Awareness;
      localUser: CollaborationUser;
    }
  | {
      /** Legacy fragment authority for domains that have not cut over yet. */
      blockRoomController?: never;
      fragment: Y.XmlFragment;
      awareness?: Awareness;
      localUser?: CollaborationUser;
    };

export type TiptapEditorProps = TiptapEditorSharedProps & TiptapEditorCollaborationBinding;

type PaginationCssProperties = CSSProperties & {
  '--page-width': string;
  '--page-height': string;
  '--page-margin-top': string;
  '--page-margin-right': string;
  '--page-margin-bottom': string;
  '--page-margin-left': string;
  '--page-gap': string;
  '--pages-height': string;
};

const IsolatedEditorContent = memo(({ editor }: { editor: Editor | null }) => {
  return <EditorContent editor={editor} className={classes.surface} />;
});

function paginationCssProperties(layout: PaginationLayout): PaginationCssProperties {
  return {
    '--page-width': `${layout.width}px`,
    '--page-height': `${layout.height}px`,
    '--page-margin-top': `${layout.marginTop}px`,
    '--page-margin-right': `${layout.marginRight}px`,
    '--page-margin-bottom': `${layout.marginBottom}px`,
    '--page-margin-left': `${layout.marginLeft}px`,
    '--page-gap': `${layout.gap}px`,
    '--pages-height': `${layout.height}px`,
  };
}

interface EditorChromeProps {
  editor: Editor;
  editable: boolean;
  authoringMode: EditorAuthoringMode | null;
  onFileActivate?: TiptapAuthoringControlsCallbacks['onFileActivate'];
  externalVideo: TiptapExternalVideoOptions | false | undefined;
  externalVideoRuntimeLabels: TiptapExternalVideoLabels;
  codeBlockLabels: CodeBlockSelectionMenuLabels;
  ai: TiptapEditorProps['ai'];
  mapSelectionRegistry: TiptapMapSelectionMenuRegistry;
  executableSelectionRegistry: ExecutableSelectionMenuRegistry;
  authoringCallbacks: TiptapEditorProps['authoringCallbacks'];
  authoringCapabilities: TiptapEditorProps['authoringCapabilities'];
}

type ExternalVideoDialogContext =
  { mode: 'insert'; context: TiptapSlashActionContext } | { mode: 'edit'; blockId: string; url: string; label: string };

function EditorChrome({
  editor,
  editable,
  authoringMode,
  onFileActivate,
  externalVideo,
  externalVideoRuntimeLabels,
  codeBlockLabels,
  ai,
  mapSelectionRegistry,
  executableSelectionRegistry,
  authoringCallbacks,
  authoringCapabilities,
}: EditorChromeProps) {
  const commonActions = useTranslations('common.actions');
  const commonLabels = useTranslations('common.labels');
  const editorMessages = useTranslations('editorCommon.editor');
  const mapPlacesLabels = useTranslations('editorCommon.mapPlacesModal');
  const browserAIClient = useMemo(() => createBrowserAIEditorAssistantClient(), []);
  const aiRuntime = ai ? { client: ai.client ?? browserAIClient, target: ai.target } : null;
  const aiReady = Boolean(aiRuntime);
  const canMutateStructure = editable && authoringMode?.allowNeutralBlockEdits === true;
  const canEditLocalized = editable && authoringMode?.allowLocalizedBlockEdits === true;
  const aiController = useTiptapAIController({
    editor,
    editable: editable && canEditLocalized && aiReady,
    allowGenerate: canMutateStructure,
    supportedNodeTypes: ai === false ? undefined : ai?.supportedNodeTypes,
    onClose: ai === false ? undefined : ai?.onClose,
  });
  const [externalVideoContext, setExternalVideoContext] = useState<ExternalVideoDialogContext | null>(null);
  const selectionLabels = useMemo<SelectionBubbleMenuLabels>(
    () => ({
      menu: editorMessages('formatting.blockType'),
      blockType: editorMessages('formatting.blockType'),
      blockTypes: {
        paragraph: editorMessages('slashMenu.items.paragraph.title'),
        'heading-1': editorMessages('slashMenu.items.heading.title'),
        'heading-2': editorMessages('slashMenu.items.heading2.title'),
        'heading-3': editorMessages('slashMenu.items.heading3.title'),
        bulletListItem: editorMessages('slashMenu.items.bulletList.title'),
        numberedListItem: editorMessages('slashMenu.items.numberedList.title'),
        checkListItem: editorMessages('slashMenu.items.checkList.title'),
        quote: editorMessages('slashMenu.items.quote.title'),
        codeBlock: editorMessages('slashMenu.items.codeBlock.title'),
      },
      formatting: {
        bold: editorMessages('formatting.bold'),
        italic: editorMessages('formatting.italic'),
        underline: editorMessages('formatting.underline'),
        strike: editorMessages('formatting.strike'),
        code: editorMessages('formatting.code'),
      },
      alignment: {
        group: editorMessages('formatting.alignment'),
        left: editorMessages('formatting.alignLeft'),
        center: editorMessages('formatting.alignCenter'),
        right: editorMessages('formatting.alignRight'),
      },
      colors: {
        button: editorMessages('drag.colors'),
        text: editorMessages('colors.text'),
        background: editorMessages('colors.background'),
        values: {
          default: editorMessages('colors.names.default'),
          gray: editorMessages('colors.names.gray'),
          brown: editorMessages('colors.names.brown'),
          red: editorMessages('colors.names.red'),
          orange: editorMessages('colors.names.orange'),
          yellow: editorMessages('colors.names.yellow'),
          green: editorMessages('colors.names.green'),
          blue: editorMessages('colors.names.blue'),
          purple: editorMessages('colors.names.purple'),
          pink: editorMessages('colors.names.pink'),
        },
      },
      nest: editorMessages('formatting.nest'),
      unnest: editorMessages('formatting.unnest'),
      link: {
        create: editorMessages('link.create'),
        open: editorMessages('link.open'),
        edit: editorMessages('link.edit'),
        remove: editorMessages('link.remove'),
        url: editorMessages('link.urlPlaceholder'),
        text: editorMessages('link.titlePlaceholder'),
        textPlaceholder: editorMessages('link.titlePlaceholder'),
        urlPlaceholder: editorMessages('link.urlPlaceholder'),
        save: commonActions('save'),
        cancel: commonActions('cancel'),
      },
      inlineMath: editorMessages('formatting.inlineMath'),
      ai: editorMessages('formatting.ai'),
    }),
    [commonActions, editorMessages],
  );
  const callbacks = useMemo<TiptapAuthoringControlsCallbacks>(
    () => ({
      ...authoringCallbacks,
      onFileActivate,
      onExternalVideoActivate:
        externalVideo === false
          ? undefined
          : (authoringCallbacks?.onExternalVideoActivate ??
            ((context) => setExternalVideoContext({ mode: 'insert', context }))),
      onAIAssistantActivate: aiReady
        ? (context) => {
            authoringCallbacks?.onAIAssistantActivate?.(context);
            aiController.open();
          }
        : undefined,
    }),
    [aiController, aiReady, authoringCallbacks, externalVideo, onFileActivate],
  );
  const contextualAlignmentLabels = useMemo(
    () => ({
      alignment: editorMessages('formatting.alignment'),
      alignLeft: editorMessages('formatting.alignLeft'),
      alignCenter: editorMessages('formatting.alignCenter'),
      alignRight: editorMessages('formatting.alignRight'),
    }),
    [editorMessages],
  );
  const mapMenuLabels = useMemo<MapSelectionMenuLabels>(
    () => ({
      menu: editorMessages('embeds.map'),
      places: editorMessages('map.managePlaces'),
      addPlace: commonActions('add'),
      centerPlace: mapPlacesLabels('setAsCenterTitle'),
      removePlace: commonActions('remove'),
      width: commonLabels('width'),
      resizeHint: editorMessages('resize.map'),
      resizing: editorMessages('resize.map'),
      focusCaption: commonLabels('caption'),
      deleteBlock: commonActions('delete'),
      ...contextualAlignmentLabels,
    }),
    [commonActions, commonLabels, contextualAlignmentLabels, editorMessages, mapPlacesLabels],
  );
  const externalMenuLabels = useMemo<ExternalVideoSelectionMenuLabels>(
    () => ({
      menu: editorMessages('embeds.externalVideo'),
      editLink: externalVideoRuntimeLabels.editLink,
      aspectRatio: externalVideoRuntimeLabels.aspectRatio,
      automaticAspectRatio: externalVideoRuntimeLabels.automaticAspectRatio,
      width: commonLabels('width'),
      resizeHint: editorMessages('resize.externalVideo'),
      ...contextualAlignmentLabels,
    }),
    [commonLabels, contextualAlignmentLabels, editorMessages, externalVideoRuntimeLabels],
  );

  return (
    <>
      {canMutateStructure ? (
        <TiptapAuthoringControls
          editor={editor}
          capabilities={{
            ai: aiReady,
            externalVideo: externalVideo !== false,
            file: Boolean(onFileActivate),
            map: Boolean(authoringCallbacks?.onMapActivate),
            math: true,
            p5: true,
            shader: true,
            table: true,
            three: true,
            ...authoringCapabilities,
          }}
          {...callbacks}
        />
      ) : null}
      {canEditLocalized ? (
        <TiptapContextualMenuRouter
          editor={editor}
          selectionLabels={selectionLabels}
          onAIActivate={canEditLocalized && aiReady ? aiController.open : undefined}
          allowTableMenu={canMutateStructure}
        />
      ) : null}
      {canMutateStructure ? (
        <TiptapExecutableSelectionBubbleMenu editor={editor} registry={executableSelectionRegistry} />
      ) : null}
      {canMutateStructure ? (
        <CodeBlockSelectionMenu editor={editor} authoringMode={authoringMode} labels={codeBlockLabels} />
      ) : null}
      {canMutateStructure ? (
        <TiptapMapSelectionBubbleMenu editor={editor} labels={mapMenuLabels} registry={mapSelectionRegistry} />
      ) : null}
      {canMutateStructure && externalVideo !== false ? (
        <TiptapExternalVideoSelectionBubbleMenu
          editor={editor}
          labels={externalMenuLabels}
          onEditLink={(video) => {
            const label = typeof video.node.attrs.label === 'string' ? video.node.attrs.label.trim() : '';
            setExternalVideoContext({
              mode: 'edit',
              blockId: video.blockId,
              url: video.url,
              label: label || video.url,
            });
          }}
        />
      ) : null}
      {aiRuntime ? (
        <TiptapAIAssistantSurface controller={aiController} client={aiRuntime.client} target={aiRuntime.target} />
      ) : null}
      <ExternalVideoInsertDialog
        opened={externalVideoContext !== null}
        onClose={() => setExternalVideoContext(null)}
        initialUrl={externalVideoContext?.mode === 'edit' ? externalVideoContext.url : ''}
        initialLabel={externalVideoContext?.mode === 'edit' ? externalVideoContext.label : ''}
        onInsert={(input) => {
          if (externalVideoContext?.mode === 'insert') {
            replaceParagraphWithExternalVideoLink(editor, input, externalVideoContext.context.targetBlockId);
          } else if (externalVideoContext?.mode === 'edit') {
            updateTiptapExternalVideoSource(editor, input, externalVideoContext.blockId);
          }
        }}
      />
    </>
  );
}

export function TiptapEditor({
  fragment,
  blockRoomController,
  awareness,
  localUser,
  editable = true,
  onFileActivate,
  mediaRuntimeStore,
  externalVideo,
  ai,
  map,
  authoringCallbacks,
  className,
  pagination = false,
  paginationLead,
  shaderFilePicker,
  resolveShaderAsset,
  autoRunReadOnlyExecutables = true,
  structureLocked = false,
  additionalExtensions = EMPTY_ADDITIONAL_EXTENSIONS,
  onEditorReady,
  authoringCapabilities,
}: TiptapEditorProps) {
  const paginationLayout = resolvePaginationLayout(pagination);
  const authoringMode = useOptionalEditorAuthoringMode();
  const runtimeLabels = useTranslations('editorCommon.editor.runtimeLabels');
  const commonActions = useTranslations('common.actions');
  const commonLabels = useTranslations('common.labels');
  const searchCombobox = useTranslations('searchCombobox');
  const editorMessages = useTranslations('editorCommon.editor');
  const codeBlockLabels = useMemo<CodeBlockSelectionMenuLabels>(
    () => ({
      menu: editorMessages('slashMenu.items.codeBlock.title'),
      edit: runtimeLabels('code.edit'),
      source: commonLabels('source'),
      language: commonLabels('language'),
      languageNoResults: searchCombobox('noResults'),
      copy: commonActions('copy'),
      delete: commonActions('delete'),
      alignment: editorMessages('formatting.alignment'),
      alignLeft: editorMessages('formatting.alignLeft'),
      alignCenter: editorMessages('formatting.alignCenter'),
      alignRight: editorMessages('formatting.alignRight'),
      resizeLeft: runtimeLabels('p5.resizeLeft'),
      resizeRight: runtimeLabels('p5.resizeRight'),
    }),
    [commonActions, commonLabels, editorMessages, runtimeLabels, searchCombobox],
  );
  const p5Labels = useMemo<P5SketchLabels>(
    () => ({
      title: runtimeLabels('p5.title'),
      edit: runtimeLabels('p5.edit'),
      source: runtimeLabels('p5.source'),
      preview: runtimeLabels('p5.preview'),
      run: runtimeLabels('p5.run'),
      stop: runtimeLabels('p5.stop'),
      restart: runtimeLabels('p5.restart'),
      apply: commonActions('apply'),
      copy: runtimeLabels('p5.copy'),
      resetOriginal: runtimeLabels('p5.resetOriginal'),
      sourceInput: runtimeLabels('p5.sourceInput'),
      copied: runtimeLabels('p5.copied'),
      running: runtimeLabels('p5.running'),
      stopped: runtimeLabels('p5.stopped'),
      error: runtimeLabels('p5.error'),
      resizeLeft: runtimeLabels('p5.resizeLeft'),
      resizeRight: runtimeLabels('p5.resizeRight'),
      capabilities: runtimeLabels('p5.capabilities'),
      capabilitiesDescription: runtimeLabels('p5.capabilitiesDescription'),
      suggestedByCode: runtimeLabels('p5.suggestedByCode'),
      unsupportedCapability: runtimeLabels('p5.unsupportedCapability'),
      capabilityLabels: {
        camera: runtimeLabels('p5.capabilityCamera'),
        microphone: runtimeLabels('p5.capabilityMicrophone'),
        motion: runtimeLabels('p5.capabilityMotion'),
        midi: runtimeLabels('p5.capabilityMidi'),
        gamepad: runtimeLabels('p5.capabilityGamepad'),
        serial: runtimeLabels('p5.capabilitySerial'),
        location: runtimeLabels('p5.capabilityLocation'),
        bluetooth: runtimeLabels('p5.capabilityBluetooth'),
      },
    }),
    [commonActions, commonLabels, runtimeLabels],
  );
  const threeLabels = useMemo<ThreeSceneLabels>(
    () => ({
      title: runtimeLabels('three.title'),
      edit: runtimeLabels('three.edit'),
      source: runtimeLabels('three.source'),
      preview: runtimeLabels('three.preview'),
      run: runtimeLabels('three.run'),
      stop: runtimeLabels('three.stop'),
      restart: runtimeLabels('three.restart'),
      apply: commonActions('apply'),
      copy: runtimeLabels('three.copy'),
      resetOriginal: runtimeLabels('three.resetOriginal'),
      sourceInput: runtimeLabels('three.sourceInput'),
      copied: runtimeLabels('three.copied'),
      running: runtimeLabels('three.running'),
      stopped: runtimeLabels('three.stopped'),
      error: runtimeLabels('three.error'),
      resizeLeft: runtimeLabels('three.resizeLeft'),
      resizeRight: runtimeLabels('three.resizeRight'),
    }),
    [commonActions, runtimeLabels],
  );
  const shaderLabels = useMemo<ShaderLabels>(
    () => ({
      title: runtimeLabels('shader.title'),
      edit: runtimeLabels('shader.edit'),
      source: runtimeLabels('shader.source'),
      preview: runtimeLabels('shader.preview'),
      run: runtimeLabels('shader.run'),
      stop: runtimeLabels('shader.stop'),
      restart: runtimeLabels('shader.restart'),
      apply: commonActions('apply'),
      copy: runtimeLabels('shader.copy'),
      copied: runtimeLabels('shader.copied'),
      resetOriginal: runtimeLabels('p5.resetOriginal'),
      running: runtimeLabels('shader.running'),
      stopped: runtimeLabels('shader.stopped'),
      error: runtimeLabels('shader.error'),
      resizeLeft: runtimeLabels('shader.resizeLeft'),
      resizeRight: runtimeLabels('shader.resizeRight'),
      sourceInput: runtimeLabels('shader.sourceInput'),
      availableInputs: runtimeLabels('shader.availableInputs'),
      apiHint: runtimeLabels('shader.apiHint'),
      sharedStage: runtimeLabels('shader.sharedStage'),
      close: commonActions('close'),
      audio: commonLabels('audio'),
    }),
    [commonActions, commonLabels, runtimeLabels],
  );
  const externalVideoRuntimeLabels = useMemo<TiptapExternalVideoLabels>(
    () => ({
      editLink: runtimeLabels('externalVideo.editLink'),
      showPreview: runtimeLabels('externalVideo.showPreview'),
      aspectRatio: runtimeLabels('externalVideo.aspectRatio'),
      automaticAspectRatio: runtimeLabels('externalVideo.automaticAspectRatio'),
      alignLeft: runtimeLabels('externalVideo.alignLeft'),
      alignCenter: runtimeLabels('externalVideo.alignCenter'),
      alignRight: runtimeLabels('externalVideo.alignRight'),
      youtubeTitle: runtimeLabels('externalVideo.youtubeTitle'),
      vimeoTitle: runtimeLabels('externalVideo.vimeoTitle'),
    }),
    [runtimeLabels],
  );
  const effectiveExternalVideo = useMemo<RuntimeExternalVideoOptions | false>(
    () =>
      externalVideo === false
        ? false
        : {
            ...externalVideo,
            labels: {
              ...externalVideoRuntimeLabels,
              ...externalVideo?.labels,
            },
          },
    [externalVideo, externalVideoRuntimeLabels],
  );
  const mapSelectionRegistry = useMemo(() => createTiptapMapSelectionMenuRegistry(), []);
  const executableSelectionRegistry = useMemo(() => createExecutableSelectionMenuRegistry(), []);
  const executableSelectionLabels = useMemo(
    () => ({
      deleteBlock: commonActions('delete'),
      alignment: editorMessages('formatting.alignment'),
      alignLeft: editorMessages('formatting.alignLeft'),
      alignCenter: editorMessages('formatting.alignCenter'),
      alignRight: editorMessages('formatting.alignRight'),
    }),
    [commonActions, editorMessages],
  );
  const onFileActivateRef = useRef(onFileActivate);
  onFileActivateRef.current = onFileActivate;
  const extensions = useMemo(() => {
    const fileNode = createTiptapFileNode({
      onActivate: (blockId) => onFileActivateRef.current?.(blockId),
      runtimeStore: mediaRuntimeStore,
    });
    const effectiveMapOptions: TiptapMapNodeOptions = {
      ...map,
      allowNeutralBlockEdits: authoringMode?.allowNeutralBlockEdits === true,
      allowLocalizedBlockEdits: authoringMode?.allowLocalizedBlockEdits === true,
      onNeutralAttrsChange: (blockId, attributes, patch) => {
        map?.onNeutralAttrsChange?.(blockId, attributes, patch);
        authoringMode?.applyNeutralBlockProps?.(blockId, patch);
      },
      onDeleteBlock: (blockId, attributes) => {
        map?.onDeleteBlock?.(blockId, attributes);
        authoringMode?.deleteNeutralBlock?.(blockId);
      },
      selectionMenuRegistry: mapSelectionRegistry,
    };
    return [
      ...withTiptapMathExtensions([
        ...createTiptapWireExtensions({
          blockContainerNode: createTiptapBlockContainer(authoringMode),
          codeBlockNode: createTiptapCodeBlock(authoringMode, codeBlockLabels),
          externalVideoNode:
            effectiveExternalVideo === false ? undefined : createTiptapExternalVideoExtension(effectiveExternalVideo),
          fileNode,
          mapNode: createTiptapMapNode(effectiveMapOptions),
        }).filter((extension) => !['table', 'tableRow', 'tableCell', 'tableHeader'].includes(extension.name)),
        ...createTiptapTableExtensions(),
      ]),
      createP5SketchExtension({
        labels: p5Labels,
        authoringMode,
        autoRunReadOnly: autoRunReadOnlyExecutables,
        selectionMenuRegistry: executableSelectionRegistry,
        selectionMenuLabels: executableSelectionLabels,
      }),
      createThreeSceneExtension({
        labels: threeLabels,
        authoringMode,
        autoRunReadOnly: autoRunReadOnlyExecutables,
        selectionMenuRegistry: executableSelectionRegistry,
        selectionMenuLabels: executableSelectionLabels,
      }),
      createShaderExtension({
        labels: shaderLabels,
        authoringMode,
        autoRunReadOnly: autoRunReadOnlyExecutables,
        selectionMenuRegistry: executableSelectionRegistry,
        selectionMenuLabels: executableSelectionLabels,
        filePicker: shaderFilePicker,
        resolveAsset: resolveShaderAsset,
      }),
      BlockBoundaryNavigation,
      createAuthoringShortcutGuard(authoringMode),
      ...(structureLocked ? [TranslationStructureLockExtension] : []),
      ...additionalExtensions,
      createTiptapPaginationExtension(),
      ...(blockRoomController
        ? [blockRoomController.extension, createBlockRoomPresenceExtension(awareness, localUser)]
        : [createCollaborationExtension({ fragment, awareness, localUser })]),
    ];
  }, [
    authoringMode,
    additionalExtensions,
    autoRunReadOnlyExecutables,
    awareness,
    blockRoomController,
    effectiveExternalVideo,
    executableSelectionLabels,
    executableSelectionRegistry,
    codeBlockLabels,
    fragment,
    localUser,
    map,
    mediaRuntimeStore,
    mapSelectionRegistry,
    p5Labels,
    shaderLabels,
    shaderFilePicker,
    structureLocked,
    resolveShaderAsset,
    threeLabels,
  ]);
  const editor = useEditor(
    {
      extensions,
      content: blockRoomController?.initialContent,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: classes.content,
          'data-testid': 'tiptap-editor-content',
        },
      },
    },
    [extensions],
  );
  useRegisterEditorAuthoringMode(editor, authoringMode ?? DENIED_AUTHORING_MODE);

  useEffect(() => {
    if (!editor || !blockRoomController) {
      return undefined;
    }
    return blockRoomController.connect(editor);
  }, [blockRoomController, editor]);

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return undefined;
    }
    const applyPagination = () => {
      if (!editor.isDestroyed) {
        editor.commands.setPagination(paginationLayout);
      }
    };
    editor.on('mount', applyPagination);
    applyPagination();
    return () => {
      editor.off('mount', applyPagination);
    };
  }, [
    editor,
    paginationLayout.enabled,
    paginationLayout.footerText,
    paginationLayout.headerText,
    paginationLayout.orientation,
    paginationLayout.pageSize,
  ]);

  const leadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return undefined;
    }
    const root = editor.view.dom.closest<HTMLElement>('[data-editor-engine="tiptap"]');
    if (!root) {
      return undefined;
    }
    const element = leadRef.current;
    const update = () => {
      const height = paginationLayout.enabled && element ? element.getBoundingClientRect().height : 0;
      root.style.setProperty('--pagination-lead-height', `${height}px`);
      if (!editor.isDestroyed) {
        editor.view.dispatch(editor.state.tr.setMeta('addToHistory', false));
      }
    };
    const observer =
      element && typeof ResizeObserver !== 'undefined' && paginationLayout.enabled ? new ResizeObserver(update) : null;
    if (element) {
      observer?.observe(element);
    }
    update();
    return () => observer?.disconnect();
  }, [editor, paginationLayout.enabled, paginationLead]);

  return (
    <div
      className={[classes.editor, 'tiptap-editor', className].filter(Boolean).join(' ')}
      data-editor-engine="tiptap"
      data-editor-editable={editable ? 'true' : 'false'}
      data-pagination-enabled={paginationLayout.enabled ? 'true' : 'false'}
      data-pagination-page-size={paginationLayout.pageSize.toLowerCase()}
      data-pagination-orientation={paginationLayout.orientation}
      data-authoring-authority={authoringMode ? 'provided' : 'absent'}
      style={paginationCssProperties(paginationLayout)}
    >
      <TiptapMapSelectionMenuRegistryProvider registry={mapSelectionRegistry}>
        <ExecutableSelectionMenuRegistryProvider registry={executableSelectionRegistry}>
          {editor ? (
            <EditorChrome
              editor={editor}
              editable={editable}
              authoringMode={authoringMode}
              codeBlockLabels={codeBlockLabels}
              onFileActivate={onFileActivateRef.current}
              externalVideo={effectiveExternalVideo}
              externalVideoRuntimeLabels={
                effectiveExternalVideo === false ? externalVideoRuntimeLabels : effectiveExternalVideo.labels
              }
              ai={ai}
              mapSelectionRegistry={mapSelectionRegistry}
              executableSelectionRegistry={executableSelectionRegistry}
              authoringCallbacks={authoringCallbacks}
              authoringCapabilities={authoringCapabilities}
            />
          ) : null}
          <div className={classes.paper}>
            {paginationLayout.enabled && paginationLayout.headerText !== '' ? (
              <div className={classes.pageHeader} aria-hidden="true">
                {paginationLayout.headerText}
              </div>
            ) : null}
            {paginationLayout.enabled && paginationLead ? (
              <div ref={leadRef} className={classes.paginationLead} data-pagination-lead>
                {paginationLead}
              </div>
            ) : null}
            <IsolatedEditorContent editor={editor} />
            {paginationLayout.enabled ? (
              <div
                className={classes.finalPageFooter}
                data-pagination-final-footer
                data-footer-text={paginationLayout.footerText}
                aria-hidden="true"
              />
            ) : null}
          </div>
        </ExecutableSelectionMenuRegistryProvider>
      </TiptapMapSelectionMenuRegistryProvider>
    </div>
  );
}
