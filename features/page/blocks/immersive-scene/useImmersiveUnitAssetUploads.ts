'use client';

import { useCallback, type RefObject } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { notifications } from '@mantine/notifications';
import { UPLOAD_ABORTED_MESSAGE } from '@/lib/upload/failure';
import type { ImmersiveSceneUnit } from './schema';
import { buildSceneAssetSlotId, clearMeshOptimizationFields } from './settings-model';
import type { ImmersiveSceneUploadControls } from './upload-types';
import type { useImmersiveAssetUploadController } from './useImmersiveAssetUploadController';

type UploadLifecycle = Pick<
  ReturnType<typeof useImmersiveAssetUploadController>,
  'beginAssetUpload' | 'finishAssetUpload' | 'isCurrentAssetUpload' | 'resetAssetFileInput' | 'setAssetProgress'
>;

interface Options extends UploadLifecycle {
  pageId: string;
  sectionId: string;
  unitsRef: RefObject<ImmersiveSceneUnit[]>;
  uploadMeshFile: ImmersiveSceneUploadControls['uploadMeshFile'];
  uploadTextureFile: ImmersiveSceneUploadControls['uploadTextureFile'];
  cleanupUnreferencedUploadedFile: (fileId: string) => void;
  replaceVisualUnit: (id: string, patch: Partial<ImmersiveSceneUnit>) => void;
}

export function useImmersiveUnitAssetUploads({
  pageId,
  sectionId,
  unitsRef,
  uploadMeshFile,
  uploadTextureFile,
  cleanupUnreferencedUploadedFile,
  replaceVisualUnit,
  beginAssetUpload,
  finishAssetUpload,
  isCurrentAssetUpload,
  resetAssetFileInput,
  setAssetProgress,
}: Options) {
  const uploadUnitMesh = useCallback(
    async (unit: ImmersiveSceneUnit, file: File | null) => {
      if (!file) {
        return;
      }

      const assetKey = `${unit.id}:mesh`;
      resetAssetFileInput(assetKey);
      const generation = beginAssetUpload(assetKey);
      try {
        const result = await uploadMeshFile(file, {
          entityId: pageId,
          entityType: TranscodeEntityType.PAGE,
          slotId: buildSceneAssetSlotId(sectionId, unit.id, 'mesh'),
          onProgress: (progress) => {
            if (isCurrentAssetUpload(assetKey, generation)) {
              setAssetProgress(assetKey, progress.percentage);
            }
          },
        });
        const currentUnit = unitsRef.current.find((candidate) => candidate.id === unit.id);
        if (!isCurrentAssetUpload(assetKey, generation) || !currentUnit || currentUnit.meshSource !== 'file') {
          cleanupUnreferencedUploadedFile(result.fileId);
          return;
        }
        replaceVisualUnit(unit.id, {
          meshSource: 'file',
          meshFileId: result.fileId,
          meshUrl: result.url,
          meshFileName: file.name,
          meshFileSize: String(file.size),
          ...clearMeshOptimizationFields(),
        });
      } catch (error) {
        if (error instanceof Error && error.message === UPLOAD_ABORTED_MESSAGE) {
          return;
        }
        notifications.show({
          message: error instanceof Error ? error.message : 'Failed to upload mesh',
          color: 'red',
        });
      } finally {
        resetAssetFileInput(assetKey);
        finishAssetUpload(assetKey, generation);
      }
    },
    [
      beginAssetUpload,
      finishAssetUpload,
      isCurrentAssetUpload,
      cleanupUnreferencedUploadedFile,
      pageId,
      replaceVisualUnit,
      resetAssetFileInput,
      sectionId,
      setAssetProgress,
      unitsRef,
      uploadMeshFile,
    ],
  );

  const uploadUnitTexture = useCallback(
    async (unit: ImmersiveSceneUnit, file: File | null, variant: 'light' | 'dark') => {
      if (!file) {
        return;
      }

      const assetKey = `${unit.id}:${variant}-texture`;
      resetAssetFileInput(assetKey);
      const generation = beginAssetUpload(assetKey);
      try {
        const result = await uploadTextureFile(file, {
          entityId: pageId,
          entityType: TranscodeEntityType.PAGE,
          slotId: buildSceneAssetSlotId(sectionId, unit.id, variant === 'dark' ? 'dark-texture' : 'texture'),
          onProgress: (progress) => {
            if (isCurrentAssetUpload(assetKey, generation)) {
              setAssetProgress(assetKey, progress.percentage);
            }
          },
        });
        const currentUnit = unitsRef.current.find((candidate) => candidate.id === unit.id);
        if (!isCurrentAssetUpload(assetKey, generation) || !currentUnit) {
          cleanupUnreferencedUploadedFile(result.fileId);
          return;
        }
        if (variant === 'dark') {
          if (currentUnit.darkTextureSource !== 'image') {
            cleanupUnreferencedUploadedFile(result.fileId);
            return;
          }
          replaceVisualUnit(unit.id, {
            darkTextureSource: 'image',
            darkTextureFileId: result.fileId,
            darkTextureUrl: result.url,
            darkTextureFileName: file.name,
            darkTextureFileSize: String(file.size),
          });
        } else {
          if (currentUnit.textureSource !== 'image') {
            cleanupUnreferencedUploadedFile(result.fileId);
            return;
          }
          replaceVisualUnit(unit.id, {
            textureSource: 'image',
            textureFileId: result.fileId,
            textureUrl: result.url,
            textureFileName: file.name,
            textureFileSize: String(file.size),
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message === UPLOAD_ABORTED_MESSAGE) {
          return;
        }
        notifications.show({
          message: error instanceof Error ? error.message : 'Failed to upload texture',
          color: 'red',
        });
      } finally {
        resetAssetFileInput(assetKey);
        finishAssetUpload(assetKey, generation);
      }
    },
    [
      beginAssetUpload,
      finishAssetUpload,
      isCurrentAssetUpload,
      cleanupUnreferencedUploadedFile,
      pageId,
      replaceVisualUnit,
      resetAssetFileInput,
      sectionId,
      setAssetProgress,
      unitsRef,
      uploadTextureFile,
    ],
  );

  return { uploadUnitMesh, uploadUnitTexture };
}
