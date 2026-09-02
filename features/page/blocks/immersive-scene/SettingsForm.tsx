'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { getMapColorSchemeOptions } from '../constants';
import {
  ImmersiveSceneSceneSettingsPanel,
  type ImmersiveSceneSceneMessageKey,
} from './ImmersiveSceneSceneSettingsPanel';
import { ImmersiveSceneUnitSettingsPanel, type ImmersiveSceneUnitMessageKey } from './ImmersiveSceneUnitSettingsPanel';
import type { MeshOptimizationMessageKey } from './MeshOptimizationPanel';
import {
  IMMERSIVE_SCENE_MESH_VALUES,
  IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES,
  IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES,
  IMMERSIVE_SCENE_TEXTURE_SIZE_VALUES,
  diffRemovedImmersiveSceneAssetFileIds,
  parseImmersiveSceneConfig,
  serializeImmersiveSceneCopyUnits,
  serializeImmersiveSceneVisualUnits,
  type ImmersiveSceneMesh,
  type ImmersiveSceneProps,
  type ImmersiveSceneUnit,
} from './schema';
import {
  createImmersiveSceneUnit,
  diffRemovedMeshOptimizationSources,
  getRotationAxisValues,
  hasImmersiveSceneUnitCopy,
  moveImmersiveSceneUnit,
  replaceImmersiveSceneUnit,
  type RemovedMeshOptimizationSource,
} from './settings-model';
import { useImmersiveAssetUploadController } from './useImmersiveAssetUploadController';
import { useImmersiveUnitAssetUploads } from './useImmersiveUnitAssetUploads';
import type { ImmersiveSceneUploadControls } from './upload-types';

export type { ImmersiveSceneUploadControls } from './upload-types';

type ImmersiveSceneSettingsMessageKey =
  | ImmersiveSceneSceneMessageKey
  | ImmersiveSceneUnitMessageKey
  | `blockEditor.options.immersiveSceneMesh.${ImmersiveSceneMesh}`
  | 'blockEditor.labels.sceneUnit'
  | 'blockEditor.options.meshSource.primitive'
  | 'blockEditor.options.meshSource.file'
  | 'blockEditor.options.textureSource.color'
  | 'blockEditor.options.textureSource.image'
  | 'blockEditor.options.textureSource.inherit'
  | 'blockEditor.options.textColorSource.theme'
  | 'blockEditor.options.textColorSource.custom'
  | 'blockEditor.options.textColorSource.inherit';

interface ImmersiveSceneSettingsFormProps {
  sectionId: string;
  pageId: string;
  props: Partial<ImmersiveSceneProps>;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
  uploadControls: ImmersiveSceneUploadControls;
  panel?: 'unit' | 'scene';
  selectedUnitId?: string;
  onSelectedUnitChange?: (unitId: string) => void;
}

export function ImmersiveSceneSettingsForm({
  sectionId,
  pageId,
  props,
  updateSharedProps,
  updateLocalizedProps,
  uploadControls,
  panel = 'unit',
  selectedUnitId,
  onSelectedUnitChange,
}: ImmersiveSceneSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const {
    uploadMeshFile,
    uploadTextureFile,
    isUploadingMesh,
    isUploadingTexture,
    meshAcceptString,
    textureAcceptString,
    abortMeshUpload,
    abortTextureUpload,
    deleteUploadedFile,
    meshOptimizationControls,
  } = uploadControls;
  const tb = (key: ImmersiveSceneSettingsMessageKey, _fallback: string) => tPageEditor(key);
  const tBlockEditor = (key: MeshOptimizationMessageKey) => tPageEditor(key);
  const config = parseImmersiveSceneConfig(props);
  const unitsRef = useRef(config.units);
  const isStatic = config.units.length <= 1;
  const isAutoplay = config.playback === 'autoplay' && !isStatic;
  const [uncontrolledSelectedUnitId, setUncontrolledSelectedUnitId] = useState('');
  const activeSelectedUnitId = selectedUnitId ?? uncontrolledSelectedUnitId;
  const selectUnit = onSelectedUnitChange ?? setUncontrolledSelectedUnitId;
  useEffect(() => {
    unitsRef.current = config.units;
  }, [config.units]);

  useEffect(() => {
    if (activeSelectedUnitId !== '' && !config.units.some((unit) => unit.id === activeSelectedUnitId)) {
      selectUnit('');
    }
  }, [activeSelectedUnitId, config.units, selectUnit]);

  const {
    uploadingAssetKeys,
    assetUploadProgress,
    beginAssetUpload,
    isCurrentAssetUpload,
    finishAssetUpload,
    cancelMeshUpload,
    cancelTextureUpload,
    cancelUnitUploads,
    setAssetProgress,
    setAssetFileInputReset,
    resetAssetFileInput,
  } = useImmersiveAssetUploadController({ abortMeshUpload, abortTextureUpload });

  const updateSharedUnitList = useCallback(
    (units: ImmersiveSceneUnit[]) => {
      unitsRef.current = units;
      updateSharedProps({
        unitsJson: serializeImmersiveSceneVisualUnits(units),
      });
    },
    [updateSharedProps],
  );

  const deleteRemovedAssetFile = useCallback(
    (fileId: string) => {
      if (!deleteUploadedFile) {
        return;
      }
      void deleteUploadedFile(fileId)
        .then((result) => {
          if (result.error) {
            notifications.show({
              message: `Asset reference removed, but file cleanup failed: ${result.error}`,
              color: 'yellow',
            });
          }
        })
        .catch((error) => {
          notifications.show({
            message:
              error instanceof Error
                ? `Asset reference removed, but file cleanup failed: ${error.message}`
                : 'Asset reference removed, but file cleanup failed',
            color: 'yellow',
          });
        });
    },
    [deleteUploadedFile],
  );

  const clearRemovedMeshOptimizationSource = useCallback(
    (source: RemovedMeshOptimizationSource) => {
      if (!meshOptimizationControls) {
        return;
      }
      void meshOptimizationControls
        .clearCandidates({
          sourceFileId: source.sourceFileId,
          entityId: pageId,
          entityType: TranscodeEntityType.PAGE,
          sectionId,
          unitId: source.unitId,
        })
        .then((result) => {
          if (result.error) {
            notifications.show({
              message: tPageEditor('blockEditor.status.optimizedMeshCleanupFailed', {
                error: result.error,
              }),
              color: 'yellow',
            });
          }
        })
        .catch((error) => {
          notifications.show({
            message:
              error instanceof Error
                ? tPageEditor('blockEditor.status.optimizedMeshCleanupFailed', {
                    error: error.message,
                  })
                : tPageEditor('blockEditor.status.optimizedMeshCleanupFailedDefault'),
            color: 'yellow',
          });
        });
    },
    [meshOptimizationControls, pageId, sectionId, tPageEditor],
  );

  const cleanupRemovedAssets = useCallback(
    (previousUnits: ImmersiveSceneUnit[], nextUnits: ImmersiveSceneUnit[]) => {
      const removedOptimizationSources = diffRemovedMeshOptimizationSources(previousUnits, nextUnits);
      for (const source of removedOptimizationSources) {
        clearRemovedMeshOptimizationSource(source);
      }
      const optimizationFileIds = new Set(
        previousUnits.map((unit) => unit.meshOptimizationFileId).filter((fileId): fileId is string => Boolean(fileId)),
      );
      const removedFileIds = diffRemovedImmersiveSceneAssetFileIds(previousUnits, nextUnits);
      for (const fileId of removedFileIds) {
        if (optimizationFileIds.has(fileId)) {
          continue;
        }
        deleteRemovedAssetFile(fileId);
      }
    },
    [clearRemovedMeshOptimizationSource, deleteRemovedAssetFile],
  );

  const cleanupUnreferencedUploadedFile = useCallback(
    (fileId: string) => {
      const referencedFileIds = new Set(
        unitsRef.current.flatMap((unit) => [
          unit.meshFileId,
          unit.meshOptimizationFileId,
          unit.textureFileId,
          unit.darkTextureFileId,
        ]),
      );
      if (referencedFileIds.has(fileId)) {
        return;
      }
      deleteRemovedAssetFile(fileId);
    },
    [deleteRemovedAssetFile],
  );

  const updateLocalizedUnitList = useCallback(
    (units: ImmersiveSceneUnit[]) => {
      unitsRef.current = units;
      updateLocalizedProps({
        copyJson: serializeImmersiveSceneCopyUnits(units),
      });
    },
    [updateLocalizedProps],
  );

  const preserveLocalizedUnitCopy = useCallback(
    (units: ImmersiveSceneUnit[]) => {
      if (typeof props.copyJson !== 'string' && !hasImmersiveSceneUnitCopy(units)) {
        return;
      }
      updateLocalizedUnitList(units);
    },
    [props.copyJson, updateLocalizedUnitList],
  );

  const replaceVisualUnit = useCallback(
    (id: string, patch: Partial<ImmersiveSceneUnit>) => {
      const previousUnits = unitsRef.current;
      const nextUnits = replaceImmersiveSceneUnit(previousUnits, id, patch);
      updateSharedUnitList(nextUnits);
      preserveLocalizedUnitCopy(nextUnits);
      cleanupRemovedAssets(previousUnits, nextUnits);
    },
    [cleanupRemovedAssets, preserveLocalizedUnitCopy, updateSharedUnitList],
  );

  const replaceCopyUnit = useCallback(
    (id: string, patch: Partial<ImmersiveSceneUnit>) => {
      updateLocalizedUnitList(replaceImmersiveSceneUnit(unitsRef.current, id, patch));
    },
    [updateLocalizedUnitList],
  );

  const { uploadUnitMesh, uploadUnitTexture } = useImmersiveUnitAssetUploads({
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
  });

  const addUnit = useCallback(() => {
    const unit = createImmersiveSceneUnit(
      `${tb('blockEditor.labels.sceneUnit', 'Unit')} ${unitsRef.current.length + 1}`,
    );
    const units = [...unitsRef.current, unit];
    updateSharedUnitList(units);
    updateLocalizedUnitList(units);
    selectUnit(unit.id);
  }, [selectUnit, tb, updateLocalizedUnitList, updateSharedUnitList]);

  const removeUnit = useCallback(
    (id: string) => {
      const currentUnits = unitsRef.current;
      if (currentUnits.length <= 1) {
        return;
      }

      cancelUnitUploads(id);
      const units = currentUnits.filter((unit) => unit.id !== id);
      updateSharedUnitList(units);
      updateLocalizedUnitList(units);
      cleanupRemovedAssets(currentUnits, units);
      if (activeSelectedUnitId === id) {
        selectUnit('');
      }
    },
    [
      cancelUnitUploads,
      cleanupRemovedAssets,
      activeSelectedUnitId,
      selectUnit,
      updateLocalizedUnitList,
      updateSharedUnitList,
    ],
  );

  const reorderUnit = useCallback(
    (index: number, direction: -1 | 1) => {
      const units = moveImmersiveSceneUnit(unitsRef.current, index, direction);
      updateSharedUnitList(units);
      updateLocalizedUnitList(units);
    },
    [updateLocalizedUnitList, updateSharedUnitList],
  );

  const meshOptions = IMMERSIVE_SCENE_MESH_VALUES.map((mesh) => ({
    value: mesh,
    label: tb(`blockEditor.options.immersiveSceneMesh.${mesh}`, mesh),
  }));
  const meshSourceOptions = [
    {
      value: 'primitive',
      label: tb('blockEditor.options.meshSource.primitive', 'Primitive'),
    },
    { value: 'file', label: tb('blockEditor.options.meshSource.file', 'GLB') },
  ];
  const textureSourceOptions = [
    {
      value: 'color',
      label: tb('blockEditor.options.textureSource.color', 'Color'),
    },
    {
      value: 'image',
      label: tb('blockEditor.options.textureSource.image', 'Image'),
    },
  ];
  const darkTextureSourceOptions = [
    {
      value: 'inherit',
      label: tb('blockEditor.options.textureSource.inherit', 'Follow light'),
    },
    ...textureSourceOptions,
  ];
  const textureSizeOptions = IMMERSIVE_SCENE_TEXTURE_SIZE_VALUES.map((size) => ({
    value: size,
    label: `${size} x ${size}`,
  }));
  const colorSchemeOptions = getMapColorSchemeOptions({
    auto: tPageEditor('blockEditor.options.colorScheme.auto'),
    light: tPageEditor('blockEditor.options.colorScheme.light'),
    dark: tPageEditor('blockEditor.options.colorScheme.dark'),
  });
  const textColorSourceOptions = IMMERSIVE_SCENE_TEXT_COLOR_SOURCE_VALUES.map((source) => ({
    value: source,
    label:
      source === 'theme'
        ? tb('blockEditor.options.textColorSource.theme', 'Follow theme')
        : tb('blockEditor.options.textColorSource.custom', 'Custom'),
  }));
  const darkTextColorSourceOptions = IMMERSIVE_SCENE_DARK_TEXT_COLOR_SOURCE_VALUES.map((source) => ({
    value: source,
    label:
      source === 'inherit'
        ? tb('blockEditor.options.textColorSource.inherit', 'Follow light')
        : tb('blockEditor.options.textColorSource.custom', 'Custom'),
  }));
  const backgroundEnabled = config.backgroundEnabled !== 'false';
  const particleBrightness = Number(config.particleBrightness);
  const darkParticleBrightness = Number(config.darkParticleBrightness);
  const rotationEnabled = config.rotationEnabled !== 'false';
  const scrollRotationEnabled = config.scrollRotationEnabled !== 'false';
  const sceneRotation = getRotationAxisValues(config, 'rotation');
  const sceneRotationSpeed = getRotationAxisValues(config, 'rotationSpeed');
  const sceneScrollRotationTurns = getRotationAxisValues(config, 'scrollRotationTurns');
  const hoverEnabled = config.hoverEnabled !== 'false';
  const hoverRepelRadius = Number(config.hoverRepelRadius);
  const textureUploadBusy = isUploadingTexture || [...uploadingAssetKeys].some((key) => key.endsWith('-texture'));

  if (panel === 'unit') {
    return (
      <ImmersiveSceneUnitSettingsPanel
        pageId={pageId}
        sectionId={sectionId}
        config={config}
        activeSelectedUnitId={activeSelectedUnitId}
        isAutoplay={isAutoplay}
        isStatic={isStatic}
        rotationEnabled={rotationEnabled}
        scrollRotationEnabled={scrollRotationEnabled}
        sceneRotation={sceneRotation}
        sceneRotationSpeed={sceneRotationSpeed}
        sceneScrollRotationTurns={sceneScrollRotationTurns}
        meshOptions={meshOptions}
        meshSourceOptions={meshSourceOptions}
        textureSourceOptions={textureSourceOptions}
        darkTextureSourceOptions={darkTextureSourceOptions}
        meshAcceptString={meshAcceptString}
        textureAcceptString={textureAcceptString}
        isUploadingMesh={isUploadingMesh}
        textureUploadBusy={textureUploadBusy}
        uploadingAssetKeys={uploadingAssetKeys}
        assetUploadProgress={assetUploadProgress}
        meshOptimizationControls={meshOptimizationControls}
        addUnit={addUnit}
        selectUnit={selectUnit}
        reorderUnit={reorderUnit}
        removeUnit={removeUnit}
        replaceVisualUnit={replaceVisualUnit}
        replaceCopyUnit={replaceCopyUnit}
        setAssetFileInputReset={setAssetFileInputReset}
        uploadUnitMesh={uploadUnitMesh}
        uploadUnitTexture={uploadUnitTexture}
        cancelMeshUpload={cancelMeshUpload}
        cancelTextureUpload={cancelTextureUpload}
        tb={tb}
        tBlockEditor={tBlockEditor}
      />
    );
  }

  if (panel === 'scene') {
    return (
      <ImmersiveSceneSceneSettingsPanel
        config={config}
        isStatic={isStatic}
        isAutoplay={isAutoplay}
        backgroundEnabled={backgroundEnabled}
        particleBrightness={particleBrightness}
        darkParticleBrightness={darkParticleBrightness}
        rotationEnabled={rotationEnabled}
        scrollRotationEnabled={scrollRotationEnabled}
        sceneRotation={sceneRotation}
        sceneRotationSpeed={sceneRotationSpeed}
        sceneScrollRotationTurns={sceneScrollRotationTurns}
        hoverEnabled={hoverEnabled}
        hoverRepelRadius={hoverRepelRadius}
        colorSchemeOptions={colorSchemeOptions}
        textColorSourceOptions={textColorSourceOptions}
        darkTextColorSourceOptions={darkTextColorSourceOptions}
        textureSizeOptions={textureSizeOptions}
        updateSharedProps={updateSharedProps}
        tb={tb}
      />
    );
  }

  return null;
}
