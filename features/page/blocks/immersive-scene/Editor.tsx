'use client';

import { useEffect, useMemo, useState } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { deleteFileAction } from '../../../../lib/actions/file.ts';
import {
  clearImmersiveSceneMeshOptimizationCandidatesAction,
  generateImmersiveSceneMeshOptimizationCandidateAction,
  isImmersiveSceneMeshOptimizationApiAvailableAction,
  listImmersiveSceneMeshOptimizationCandidatesAction,
  useImmersiveSceneMeshOptimizationCandidateAction,
} from '@/lib/actions/immersive-scene-optimization';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { useUpload } from '@/lib/hooks/useUpload';
import type { BlockEditorProps, BlockSettingsEditorProps, BlockSettingsSurfaceProps } from '../types';
import { ImmersiveScenePreview } from './CanvasPreview';
import type { ImmersiveSceneProps } from './schema';
import { ImmersiveSceneSettingsForm, type ImmersiveSceneUploadControls } from './SettingsForm';
import { useAuthenticatedImmersiveSceneProps } from './useAuthenticatedMedia';
import { ImmersiveSceneWorkspace } from './Workspace';

function useImmersiveSceneUploadControls(): ImmersiveSceneUploadControls {
  const [meshOptimizationApiAvailable, setMeshOptimizationApiAvailable] = useState(false);
  const {
    uploadFile: uploadMeshFile,
    abort: abortMeshUpload,
    isUploading: isUploadingMesh,
    acceptString: meshAcceptString,
  } = useUpload(UploadType.EDITOR_MESH);
  const {
    uploadFile: uploadTextureFile,
    abort: abortTextureUpload,
    isUploading: isUploadingTexture,
    acceptString: textureAcceptString,
  } = useUpload(UploadType.EDITOR_IMAGE);

  useEffect(() => {
    let cancelled = false;

    void isImmersiveSceneMeshOptimizationApiAvailableAction().then((available) => {
      if (!cancelled) {
        setMeshOptimizationApiAvailable(available);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      uploadMeshFile,
      uploadTextureFile,
      isUploadingMesh,
      isUploadingTexture,
      meshAcceptString,
      textureAcceptString,
      abortMeshUpload,
      abortTextureUpload,
      deleteUploadedFile: deleteFileAction,
      meshOptimizationControls: meshOptimizationApiAvailable
        ? {
            listCandidates: listImmersiveSceneMeshOptimizationCandidatesAction,
            generateCandidate: generateImmersiveSceneMeshOptimizationCandidateAction,
            useCandidate: useImmersiveSceneMeshOptimizationCandidateAction,
            clearCandidates: clearImmersiveSceneMeshOptimizationCandidatesAction,
          }
        : undefined,
    }),
    [
      abortMeshUpload,
      abortTextureUpload,
      isUploadingMesh,
      isUploadingTexture,
      meshOptimizationApiAvailable,
      meshAcceptString,
      textureAcceptString,
      uploadMeshFile,
      uploadTextureFile,
    ],
  );
}

export function ImmersiveSceneEditor({ props }: BlockEditorProps<ImmersiveSceneProps>) {
  const hydratedProps = useAuthenticatedImmersiveSceneProps(props);
  return <ImmersiveScenePreview props={hydratedProps} />;
}

export function ImmersiveSceneSettingsEditor({
  sectionId,
  props,
  updateSharedProps,
  updateLocalizedProps,
}: BlockSettingsEditorProps<ImmersiveSceneProps>) {
  const { pageId } = usePageEditor();
  const uploadControls = useImmersiveSceneUploadControls();
  const hydratedProps = useAuthenticatedImmersiveSceneProps(props);

  return (
    <ImmersiveSceneSettingsForm
      sectionId={sectionId}
      pageId={pageId}
      props={hydratedProps}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
      uploadControls={uploadControls}
    />
  );
}

export function ImmersiveSceneSettingsSurface({
  opened,
  title,
  onClose,
  sectionSettings,
  sectionId,
  props,
  updateSharedProps,
  updateLocalizedProps,
}: BlockSettingsSurfaceProps<ImmersiveSceneProps>) {
  const { pageId } = usePageEditor();
  const uploadControls = useImmersiveSceneUploadControls();
  const hydratedProps = useAuthenticatedImmersiveSceneProps(props);

  return (
    <ImmersiveSceneWorkspace
      opened={opened}
      title={title}
      onClose={onClose}
      sectionId={sectionId}
      pageId={pageId}
      props={hydratedProps}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
      uploadControls={uploadControls}
      sectionSettings={sectionSettings}
    />
  );
}

export { ImmersiveSceneCanvasPreview } from './CanvasPreview';
