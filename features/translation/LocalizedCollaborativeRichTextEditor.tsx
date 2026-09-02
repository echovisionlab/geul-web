'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { Box } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import { useTranslations } from 'next-intl';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import { MediaFilePanel } from '@/features/editor/components/MediaFilePanel';
import { MediaIngestDialog, type MediaIngestDialogCloseReason } from '@/features/editor/components/MediaIngestDialog';
import { MediaIngestOverlay } from '@/features/editor/components/MediaIngestOverlay';
import { EditorMediaIngestProvider } from '@/features/editor/contexts/EditorMediaIngestContext';
import { EditorAuthoringModeProvider, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { MapInsertModal } from '@/features/editor/MapInsertModal';
import { useEntityMediaSurface } from '@/features/editor/hooks/useEntityMediaSurface';
import { createMapBlock } from '@/features/editor/hooks/useEditorFeatures';
import { isFileDragTransfer, isMediaPlaceholderDropTarget } from '@/features/editor/lib/file-drag';
import { createEditorMediaRuntimeStore } from '@/features/editor/lib/editor-media-runtime-store';
import { createTiptapEditorMediaCommandPort } from '@/features/editor/lib/media-block-updates';
import {
  captureInsertPosition,
  insertBlockAtPosition,
  type DeferredBlockInsert,
} from '@/features/editor/lib/block-insert';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { createTiptapEditorGeneration, type TiptapEditorGeneration } from '@/features/editor/tiptap/editor-generation';
import {
  createFileBlockInsert,
  createFileBlockInsertSession,
  type FileBlockInsertSession,
} from '@/features/editor/tiptap/integration/file-block-workflow';
import { applyMapInsertWorkflow } from '@/features/editor/tiptap/integration/map-insert-workflow';
import type { TiptapSlashActionContext } from '@/features/editor/tiptap/slash/types';
import { UPLOAD_FAILED_MESSAGE, UPLOAD_INTERRUPTED_MESSAGE } from '@/lib/hooks/useFileUpload';
import { createMediaStatusLabels, resolveMediaLifecycleDisplay } from '@/lib/media/status';
import { EditorRuntimeProvider } from '@/lib/contexts/EditorRuntimeContext';
import { getMapPlacesByIdsAction } from '@/lib/actions/map-place';
import { listMapThemesAction, resolveMapThemeAction } from '@/lib/actions/map-theme';

interface LocalizedCollaborativeRichTextEditorSharedProps {
  provider: HocuspocusProvider;
  userName: string;
  editable?: boolean;
  allowNeutralBlockEdits?: boolean;
  allowStructuralEdits?: boolean;
  blockRoomController: RichTextBlockRoomTiptapController;
  entityId?: string | null;
  entityType?: TranscodeEntityType | null;
  aiTarget?: AIDocumentTarget;
}

export type LocalizedCollaborativeRichTextEditorProps = LocalizedCollaborativeRichTextEditorSharedProps;

function resolveEntityKind(
  entityType: TranscodeEntityType | null | undefined,
): 'post' | 'page' | 'work' | 'program_event' {
  switch (entityType) {
    case TranscodeEntityType.PAGE:
      return 'page';
    case TranscodeEntityType.WORK:
      return 'work';
    case TranscodeEntityType.PROGRAM_EVENT:
      return 'program_event';
    case TranscodeEntityType.POST:
    default:
      return 'post';
  }
}

function loadMapPlacesByIds(ids: readonly string[]) {
  return getMapPlacesByIdsAction([...ids]);
}

function LocalizedCollaborativeRichTextEditorSurface({
  provider,
  blockRoomController,
  userName,
  editable = true,
  allowNeutralBlockEdits = false,
  allowStructuralEdits = false,
  entityId = null,
  entityType = null,
  aiTarget,
}: LocalizedCollaborativeRichTextEditorProps) {
  if (!provider.awareness) {
    throw new Error('Typed Block-room editor requires provider awareness.');
  }
  const mediaRuntimeStore = useMemo(() => createEditorMediaRuntimeStore(), []);
  const tEditorCommon = useTranslations('editorCommon');
  const tMedia = useTranslations('editorCommon.media');
  const tCommonNotifications = useTranslations('common.notifications');
  const [localizedEditor, setLocalizedEditor] = useState<Editor | null>(null);
  const [activeFileDialog, setActiveFileDialog] = useState<
    | { kind: 'block'; blockId: string }
    | {
        kind: 'insert';
        session: FileBlockInsertSession;
      }
    | null
  >(null);
  const [pendingMapInsert, setPendingMapInsert] = useState<{
    context: TiptapSlashActionContext;
    editorGeneration: TiptapEditorGeneration;
  } | null>(null);
  const collaborationUser = useMemo(
    () => ({
      name: userName,
      color: `#${Math.floor(Math.random() * 16_777_215)
        .toString(16)
        .padStart(6, '0')}`,
    }),
    [userName],
  );
  const canEditLocalized = editable;
  const canEditNeutral =
    canEditLocalized && allowNeutralBlockEdits && allowStructuralEdits && Boolean(entityId) && entityType != null;
  const authoringMode = useMemo<EditorAuthoringMode>(
    () => ({
      allowNeutralBlockEdits: canEditNeutral,
      allowLocalizedBlockEdits: canEditLocalized,
    }),
    [canEditLocalized, canEditNeutral],
  );
  const editorRef = useRef<ReturnType<typeof createTiptapEditorMediaCommandPort> | null>(null);
  const insertBlockAtSavedPosition = useCallback<DeferredBlockInsert>((block, savedPosition) => {
    const editor = editorRef.current;
    return editor ? insertBlockAtPosition(editor, block, savedPosition) : { ok: false, reason: 'unavailable' };
  }, []);
  const localizedMediaPort = useMemo(
    () =>
      localizedEditor ? createTiptapEditorMediaCommandPort(localizedEditor, { runtimeStore: mediaRuntimeStore }) : null,
    [localizedEditor, mediaRuntimeStore],
  );
  const localizedEditorGeneration = useMemo(
    () => (localizedEditor ? createTiptapEditorGeneration(localizedEditor) : null),
    [localizedEditor],
  );
  editorRef.current = localizedMediaPort;
  const handleLocalizedEditorReady = useCallback((editor: Editor | null) => {
    setLocalizedEditor(editor);
  }, []);

  const mediaStatusLabels = useMemo(() => createMediaStatusLabels(tMedia), [tMedia]);
  const {
    dropFilesAtBlock,
    dropFilesAtTarget,
    insertFilesAtSavedPosition,
    selectLibraryFilesAtBlock,
    selectLibraryFilesAtSavedPosition,
    externalImageProgress,
    mediaTiptapExtensions,
    uploadProgress,
  } = useEntityMediaSurface({
    entityId: entityId ?? '',
    entityType: entityType ?? TranscodeEntityType.POST,
    provider,
    mediaCommandProvider: provider,
    allowStructuralEdits: canEditNeutral,
    allowInsertEdits: canEditNeutral,
    insertBlockAtPosition: canEditNeutral ? insertBlockAtSavedPosition : undefined,
    onUploadError: (fileName, message) => {
      notifications.show({
        title: tCommonNotifications('uploadFailed'),
        message: tEditorCommon('notifications.uploadFailedMessage', {
          name: fileName,
          message:
            message === UPLOAD_INTERRUPTED_MESSAGE || message === UPLOAD_FAILED_MESSAGE
              ? tCommonNotifications('uploadFailed')
              : message,
        }),
        color: 'red',
      });
    },
  });
  const additionalExtensions = mediaTiptapExtensions;
  const map = useMemo(
    () => ({
      loadPlacesByIds: loadMapPlacesByIds,
      loadThemes: listMapThemesAction,
      resolveTheme: resolveMapThemeAction,
    }),
    [],
  );

  const activateFile = useCallback(
    (blockId: string, context?: TiptapSlashActionContext) => {
      if (!canEditNeutral || !localizedEditorGeneration || !localizedMediaPort) {
        return;
      }
      const existingBlock = localizedMediaPort.getBlock(blockId);
      if (existingBlock?.type === 'file') {
        setActiveFileDialog({ kind: 'block', blockId });
        return;
      }
      if (!context || blockId !== context.targetBlockId) {
        return;
      }
      const position = captureInsertPosition(localizedMediaPort, context.blockId);
      if (position) {
        setActiveFileDialog({
          kind: 'insert',
          session: createFileBlockInsertSession(context, localizedEditorGeneration, localizedMediaPort, position),
        });
      }
    },
    [canEditNeutral, localizedEditorGeneration, localizedMediaPort],
  );

  const activateMap = useCallback(
    (context: TiptapSlashActionContext) => {
      if (canEditNeutral && localizedEditorGeneration) {
        setPendingMapInsert({ context, editorGeneration: localizedEditorGeneration });
      }
    },
    [canEditNeutral, localizedEditorGeneration],
  );
  const closeMapInsert = useCallback(() => setPendingMapInsert(null), []);
  const selectMapPlace = useCallback(
    (placeId: string | null, placeData: { lat: number; lng: number } | null) => {
      if (!canEditNeutral || !pendingMapInsert || !placeId || !placeData) {
        return;
      }
      const mapBlock = createMapBlock(placeId, placeData);
      mapBlock.id = pendingMapInsert.context.targetBlockId;
      if (applyMapInsertWorkflow(pendingMapInsert.editorGeneration, pendingMapInsert.context, mapBlock)) {
        setPendingMapInsert(null);
      }
    },
    [canEditNeutral, pendingMapInsert],
  );

  const handleEditorFileDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!canEditNeutral || !isFileDragTransfer(event.dataTransfer) || isMediaPlaceholderDropTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    [canEditNeutral],
  );

  const handleEditorFileDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const files = event.dataTransfer.files;
      if (
        !canEditNeutral ||
        !localizedMediaPort ||
        !isFileDragTransfer(event.dataTransfer) ||
        isMediaPlaceholderDropTarget(event.target) ||
        files.length === 0
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void dropFilesAtTarget(localizedMediaPort, event.target, files);
    },
    [canEditNeutral, dropFilesAtTarget, localizedMediaPort],
  );

  const closeFileDialog = useCallback((_reason: MediaIngestDialogCloseReason) => {
    setActiveFileDialog(null);
  }, []);

  useEffect(() => {
    if (
      activeFileDialog &&
      (!canEditNeutral ||
        !localizedMediaPort ||
        (activeFileDialog.kind === 'insert' &&
          activeFileDialog.session.editorGeneration !== localizedEditorGeneration) ||
        (activeFileDialog.kind === 'block' && !localizedMediaPort.getBlock(activeFileDialog.blockId)))
    ) {
      setActiveFileDialog(null);
    }
  }, [activeFileDialog, canEditNeutral, localizedEditorGeneration, localizedMediaPort]);

  useEffect(() => {
    if (pendingMapInsert && (!canEditNeutral || pendingMapInsert.editorGeneration !== localizedEditorGeneration)) {
      setPendingMapInsert(null);
    }
  }, [canEditNeutral, localizedEditorGeneration, pendingMapInsert?.editorGeneration]);

  const externalImageLifecycleLabel = externalImageProgress
    ? resolveMediaLifecycleDisplay(externalImageProgress.stage, externalImageProgress.percentage, mediaStatusLabels)
        .label
    : null;
  const uploadLifecycleLabel = uploadProgress
    ? resolveMediaLifecycleDisplay(uploadProgress.stage, uploadProgress.percentage, mediaStatusLabels).label
    : null;

  return (
    <EditorMediaIngestProvider
      dropFilesAtBlock={(referenceBlockId, files) =>
        localizedMediaPort ? dropFilesAtBlock(localizedMediaPort, referenceBlockId, files) : Promise.resolve(false)
      }
      selectLibraryFilesAtBlock={(referenceBlockId, files) =>
        Boolean(localizedMediaPort && selectLibraryFilesAtBlock(localizedMediaPort, referenceBlockId, files))
      }
    >
      <Box
        pos="relative"
        data-editor-engine="tiptap"
        data-localized-user={userName}
        onDragOverCapture={handleEditorFileDragOver}
        onDropCapture={handleEditorFileDrop}
      >
        {externalImageProgress ? (
          <MediaIngestOverlay
            title={tEditorCommon('uploadOverlay.importingExternalImages')}
            percentage={externalImageProgress.percentage}
            detail={externalImageLifecycleLabel}
          />
        ) : uploadProgress ? (
          <MediaIngestOverlay
            title={tMedia('statuses.uploading')}
            percentage={uploadProgress.percentage}
            detail={uploadLifecycleLabel}
          />
        ) : null}
        <EditorAuthoringModeProvider value={authoringMode}>
          <TiptapEditor
            blockRoomController={blockRoomController}
            awareness={provider.awareness}
            localUser={collaborationUser}
            editable={canEditLocalized}
            structureLocked={canEditLocalized && !canEditNeutral}
            additionalExtensions={additionalExtensions}
            onEditorReady={handleLocalizedEditorReady}
            onFileActivate={canEditNeutral ? activateFile : undefined}
            mediaRuntimeStore={mediaRuntimeStore}
            externalVideo={blockRoomController.paragraphExternalVideo ? undefined : false}
            map={map}
            ai={canEditLocalized && aiTarget ? { target: aiTarget } : false}
            authoringCallbacks={{ onMapActivate: canEditNeutral ? activateMap : undefined }}
          />
        </EditorAuthoringModeProvider>
        {canEditNeutral && activeFileDialog?.kind === 'block' && localizedMediaPort ? (
          <MediaFilePanel blockId={activeFileDialog.blockId} editor={localizedMediaPort} onClose={closeFileDialog} />
        ) : null}
        {canEditNeutral && activeFileDialog?.kind === 'insert' && localizedMediaPort ? (
          <MediaIngestDialog
            opened
            editor={localizedMediaPort}
            selectedBlock={{ id: activeFileDialog.session.context.targetBlockId, type: 'file', props: {} }}
            blockType="file"
            mode="add"
            onClose={closeFileDialog}
            onUploadFiles={(files) => {
              void insertFilesAtSavedPosition(
                localizedMediaPort,
                activeFileDialog.session.position,
                files,
                createFileBlockInsert(activeFileDialog.session),
              );
            }}
            onSelectLibraryFiles={(files) => {
              selectLibraryFilesAtSavedPosition(
                localizedMediaPort,
                activeFileDialog.session.position,
                files,
                createFileBlockInsert(activeFileDialog.session),
              );
            }}
          />
        ) : null}
        {canEditNeutral ? (
          <MapInsertModal opened={pendingMapInsert !== null} onClose={closeMapInsert} onPlaceSelect={selectMapPlace} />
        ) : null}
      </Box>
    </EditorMediaIngestProvider>
  );
}

export function LocalizedCollaborativeRichTextEditor(props: LocalizedCollaborativeRichTextEditorProps) {
  return (
    <EditorRuntimeProvider
      provider={props.provider}
      entityType={resolveEntityKind(props.entityType)}
      entityId={props.entityId ?? ''}
    >
      <LocalizedCollaborativeRichTextEditorSurface {...props} />
    </EditorRuntimeProvider>
  );
}
