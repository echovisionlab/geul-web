'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconArrowDown, IconArrowUp, IconPhoto, IconPlus, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { Disclosure } from '@/components/core/Disclosure';
import { Progress } from '@/components/core/Progress';
import { FilePicker, ColorInput, NumberInput, Select, Slider, TextInput } from '@/components/core/Input';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';

import { Tabs } from '@/components/core/Tabs';
import { ImmersiveSceneDescriptionEditor } from './DescriptionEditor';
import {
  MeshOptimizationPanel,
  type ImmersiveSceneMeshOptimizationControls,
  type MeshOptimizationMessageKey,
} from './MeshOptimizationPanel';
import { RotationAxisInputs } from './RotationAxisInputs';
import {
  parseImmersiveSceneConfig,
  resolveImmersiveSceneUnitMeshOffsetY,
  resolveImmersiveSceneUnitMeshScale,
  resolveImmersiveSceneUnitParticleSize,
  type ImmersiveSceneMesh,
  type ImmersiveSceneUnit,
} from './schema';
import {
  buildRotationAxisPatch,
  clearMeshOptimizationFields,
  getRotationAxisValues,
  meshOptimizationPatchFromCandidate,
  resolveAssetAttachment,
  resolveDarkTextureSourceInput,
  resolveMeshOptimizationSelection,
} from './settings-model';

type SceneConfig = ReturnType<typeof parseImmersiveSceneConfig>;
type RotationValues = ReturnType<typeof getRotationAxisValues>;
type Option = { value: string; label: string };

export type ImmersiveSceneUnitMessageKey =
  | 'blockEditor.actions.addSceneUnit'
  | 'blockEditor.actions.cancelDarkTextureUpload'
  | 'blockEditor.actions.cancelMeshUpload'
  | 'blockEditor.actions.cancelTextureUpload'
  | 'blockEditor.actions.clearDarkTextureAsset'
  | 'blockEditor.actions.clearMeshAsset'
  | 'blockEditor.actions.clearTextureAsset'
  | 'blockEditor.actions.moveUnitDown'
  | 'blockEditor.actions.moveUnitUp'
  | 'blockEditor.actions.removeSceneUnit'
  | 'blockEditor.actions.replaceDarkTexture'
  | 'blockEditor.actions.replaceMesh'
  | 'blockEditor.actions.replaceTexture'
  | 'blockEditor.actions.uploadDarkTexture'
  | 'blockEditor.actions.uploadMesh'
  | 'blockEditor.actions.uploadTexture'
  | 'blockEditor.labels.color'
  | 'blockEditor.labels.darkColor'
  | 'blockEditor.labels.darkFallbackColor'
  | 'blockEditor.labels.darkTextureSource'
  | 'blockEditor.labels.darkTextureUploadProgress'
  | 'blockEditor.labels.description'
  | 'blockEditor.labels.fallbackColor'
  | 'blockEditor.labels.fallbackMesh'
  | 'blockEditor.labels.initialRotation'
  | 'blockEditor.labels.mesh'
  | 'blockEditor.labels.meshObjectName'
  | 'blockEditor.labels.meshOffsetY'
  | 'blockEditor.labels.meshScale'
  | 'blockEditor.labels.meshSource'
  | 'blockEditor.labels.meshUploadProgress'
  | 'blockEditor.labels.particleSize'
  | 'blockEditor.labels.rotationSpeedAxes'
  | 'blockEditor.labels.sceneUnit'
  | 'blockEditor.labels.sceneUnitName'
  | 'blockEditor.labels.scrollRotationAxes'
  | 'blockEditor.labels.textureSource'
  | 'blockEditor.labels.lightTextureUploadProgress'
  | 'blockEditor.labels.title'
  | 'blockEditor.labels.unitAttribution'
  | 'blockEditor.labels.unitHoldOverrideSeconds'
  | 'blockEditor.descriptions.rotationOverride'
  | 'blockEditor.descriptions.unitAttribution'
  | 'blockEditor.sections.content'
  | 'blockEditor.sections.sceneMesh'
  | 'blockEditor.sections.sceneMotion'
  | 'blockEditor.sections.sceneTexture'
  | 'blockEditor.sections.sceneTiming'
  | 'blockEditor.sections.sceneUnits';

interface Props {
  pageId: string;
  contentLanguage?: string;
  sectionId: string;
  config: SceneConfig;
  activeSelectedUnitId: string;
  isAutoplay: boolean;
  isStatic: boolean;
  rotationEnabled: boolean;
  scrollRotationEnabled: boolean;
  sceneRotation: RotationValues;
  sceneRotationSpeed: RotationValues;
  sceneScrollRotationTurns: RotationValues;
  meshOptions: readonly Option[];
  meshSourceOptions: readonly Option[];
  textureSourceOptions: readonly Option[];
  darkTextureSourceOptions: readonly Option[];
  meshAcceptString: string;
  textureAcceptString: string;
  isUploadingMesh: boolean;
  textureUploadBusy: boolean;
  uploadingAssetKeys: ReadonlySet<string>;
  assetUploadProgress: ReadonlyMap<string, number>;
  meshOptimizationControls?: ImmersiveSceneMeshOptimizationControls;
  addUnit: () => void;
  selectUnit: (unitId: string) => void;
  reorderUnit: (unitId: string, direction: -1 | 1) => void;
  removeUnit: (unitId: string) => void;
  replaceVisualUnit: (unitId: string, patch: Partial<ImmersiveSceneUnit>) => void;
  replaceCopyUnit: (unitId: string, patch: Partial<ImmersiveSceneUnit>) => void;
  setAssetFileInputReset: (assetKey: string, reset: (() => void) | null) => void;
  uploadUnitMesh: (unit: ImmersiveSceneUnit, file: File | null) => Promise<void>;
  uploadUnitTexture: (unit: ImmersiveSceneUnit, file: File | null, variant: 'light' | 'dark') => Promise<void>;
  cancelMeshUpload: (assetKey: string) => void;
  cancelTextureUpload: (assetKey: string) => void;
  tb: (key: ImmersiveSceneUnitMessageKey, fallback: string) => string;
  tBlockEditor: (key: MeshOptimizationMessageKey) => string;
}

export function ImmersiveSceneUnitSettingsPanel({
  pageId,
  contentLanguage,
  sectionId,
  config,
  activeSelectedUnitId,
  isAutoplay,
  isStatic,
  rotationEnabled,
  scrollRotationEnabled,
  sceneRotation,
  sceneRotationSpeed,
  sceneScrollRotationTurns,
  meshOptions,
  meshSourceOptions,
  textureSourceOptions,
  darkTextureSourceOptions,
  meshAcceptString,
  textureAcceptString,
  isUploadingMesh,
  textureUploadBusy,
  uploadingAssetKeys,
  assetUploadProgress,
  meshOptimizationControls,
  addUnit,
  selectUnit,
  reorderUnit,
  removeUnit,
  replaceVisualUnit,
  replaceCopyUnit,
  setAssetFileInputReset,
  uploadUnitMesh,
  uploadUnitTexture,
  cancelMeshUpload,
  cancelTextureUpload,
  tb,
  tBlockEditor,
}: Props) {
  const selectedIndex = Math.max(
    0,
    config.units.findIndex((unit) => unit.id === activeSelectedUnitId),
  );
  const unit = config.units[selectedIndex] ?? config.units[0];
  const meshAssetKey = `${unit.id}:mesh`;
  const lightTextureAssetKey = `${unit.id}:light-texture`;
  const darkTextureAssetKey = `${unit.id}:dark-texture`;
  const meshUploadBusy = uploadingAssetKeys.has(meshAssetKey) || isUploadingMesh;
  const meshAttachment = resolveAssetAttachment(unit, 'mesh');
  const unitHoldOverride = Number(unit.holdSeconds);
  const unitHoldOverrideValue = Number.isFinite(unitHoldOverride) ? unitHoldOverride : undefined;

  return (
    <DsLayoutStack gap="md" data-page-block-editor="immersive-scene-unit">
      <DsLayoutInline justify="between" gap="xs" align="center">
        <DsText size="xs" tone="secondary" weight="strong">
          {tb('blockEditor.sections.sceneUnits', 'Units')}
        </DsText>
        <IconButton
          size="xs"
          emphasis="low"
          title={tb('blockEditor.actions.addSceneUnit', 'Add unit')}
          aria-label={tb('blockEditor.actions.addSceneUnit', 'Add unit')}
          onClick={addUnit}
        >
          <IconPlus size={14} />
        </IconButton>
      </DsLayoutInline>

      <DsLayoutStack gap="none">
        {config.units.map((candidate, index) => (
          <Disclosure
            key={candidate.id}
            opened={candidate.id === activeSelectedUnitId}
            onChange={(opened) => selectUnit(opened ? candidate.id : '')}
            label={
              <DsText size="sm" truncate>
                {index + 1}. {candidate.name?.trim() || `${tb('blockEditor.labels.sceneUnit', 'Unit')} ${index + 1}`}
              </DsText>
            }
            actions={
              <DsLayoutInset inlineEnd="xxs">
                <DsLayoutInline gap="xxs" wrap="nowrap">
                  <IconButton
                    size="xs"
                    emphasis="low"
                    disabled={index === 0}
                    aria-label={tb('blockEditor.actions.moveUnitUp', 'Move unit up')}
                    onClick={() => reorderUnit(candidate.id, -1)}
                  >
                    <IconArrowUp size={14} />
                  </IconButton>
                  <IconButton
                    size="xs"
                    emphasis="low"
                    disabled={index === config.units.length - 1}
                    aria-label={tb('blockEditor.actions.moveUnitDown', 'Move unit down')}
                    onClick={() => reorderUnit(candidate.id, 1)}
                  >
                    <IconArrowDown size={14} />
                  </IconButton>
                  <IconButton
                    size="xs"
                    tone="danger"
                    emphasis="low"
                    disabled={config.units.length <= 1}
                    aria-label={tb('blockEditor.actions.removeSceneUnit', 'Remove unit')}
                    onClick={() => removeUnit(candidate.id)}
                  >
                    <IconTrash size={14} />
                  </IconButton>
                </DsLayoutInline>
              </DsLayoutInset>
            }
          >
            {candidate.id === activeSelectedUnitId ? (
              <DsLayoutStack gap="md">
                <TextInput
                  label={tb('blockEditor.labels.sceneUnitName', 'Unit name')}
                  value={unit.name ?? ''}
                  placeholder={`${tb('blockEditor.labels.sceneUnit', 'Unit')} ${selectedIndex + 1}`}
                  onChange={(event) => replaceVisualUnit(unit.id, { name: event.currentTarget.value })}
                />

                <Tabs defaultValue="content" keepMounted={false}>
                  <Tabs.List grow>
                    <Tabs.Tab value="content">{tb('blockEditor.sections.content', 'Content')}</Tabs.Tab>
                    <Tabs.Tab value="mesh">{tb('blockEditor.sections.sceneMesh', 'Mesh')}</Tabs.Tab>
                    <Tabs.Tab value="motion">{tb('blockEditor.sections.sceneMotion', 'Motion')}</Tabs.Tab>
                    <Tabs.Tab value="texture">{tb('blockEditor.sections.sceneTexture', 'Texture')}</Tabs.Tab>
                    {isAutoplay ? (
                      <Tabs.Tab value="timing">{tb('blockEditor.sections.sceneTiming', 'Timing')}</Tabs.Tab>
                    ) : null}
                  </Tabs.List>

                  <Tabs.Panel value="content" paddingTop="md">
                    <DsLayoutStack gap="md">
                      <TextInput
                        label={tb('blockEditor.labels.title', 'Title')}
                        value={unit.title}
                        onChange={(event) =>
                          replaceCopyUnit(unit.id, {
                            title: event.currentTarget.value,
                          })
                        }
                      />
                      <ImmersiveSceneDescriptionEditor
                        contentLanguage={contentLanguage}
                        label={tb('blockEditor.labels.description', 'Description')}
                        testId={`immersive-scene-unit-description-${unit.id}`}
                        value={unit.text}
                        onChange={(value) =>
                          replaceCopyUnit(unit.id, {
                            text: value,
                          })
                        }
                      />
                      <ImmersiveSceneDescriptionEditor
                        contentLanguage={contentLanguage}
                        label={tb('blockEditor.labels.unitAttribution', 'Unit attribution')}
                        description={tb(
                          'blockEditor.descriptions.unitAttribution',
                          'Optional · shown at the lower right · shared across languages',
                        )}
                        testId={`immersive-scene-unit-attribution-${unit.id}`}
                        value={unit.attribution ?? ''}
                        variant="attribution"
                        onChange={(value) =>
                          replaceVisualUnit(unit.id, {
                            attribution: value,
                          })
                        }
                      />
                    </DsLayoutStack>
                  </Tabs.Panel>

                  <Tabs.Panel value="mesh" paddingTop="md">
                    <DsLayoutStack gap="md">
                      <Select
                        label={tb('blockEditor.labels.meshSource', 'Mesh source')}
                        data-testid={`immersive-scene-mesh-source-${unit.id}`}
                        value={unit.meshSource || 'primitive'}
                        data={meshSourceOptions}
                        disabled={meshUploadBusy}
                        onChange={(value) => {
                          if (value === 'file') {
                            replaceVisualUnit(unit.id, { meshSource: 'file' });
                            return;
                          }
                          if (uploadingAssetKeys.has(meshAssetKey)) {
                            cancelMeshUpload(meshAssetKey);
                          }
                          replaceVisualUnit(unit.id, {
                            meshSource: undefined,
                            meshFileId: undefined,
                            meshUrl: undefined,
                            meshFileName: undefined,
                            meshFileSize: undefined,
                            meshObjectName: undefined,
                            ...clearMeshOptimizationFields(),
                          });
                        }}
                      />
                      <Select
                        label={
                          unit.meshSource === 'file'
                            ? tb('blockEditor.labels.fallbackMesh', 'Built-in mesh')
                            : tb('blockEditor.labels.mesh', 'Mesh')
                        }
                        value={unit.mesh}
                        data={meshOptions}
                        onChange={(value) => {
                          if (value) {
                            replaceVisualUnit(unit.id, {
                              mesh: value as ImmersiveSceneMesh,
                            });
                          }
                        }}
                      />
                      <NumberInput
                        label={tb('blockEditor.labels.meshScale', 'Mesh scale')}
                        data-testid={`immersive-scene-mesh-scale-${unit.id}`}
                        value={resolveImmersiveSceneUnitMeshScale(unit.scale)}
                        min={0.1}
                        max={8}
                        step={0.1}
                        onChange={(value) =>
                          replaceVisualUnit(unit.id, {
                            scale: String(value || 1),
                          })
                        }
                      />
                      <DsLayoutStack gap="xxs" data-testid={`immersive-scene-mesh-offset-y-${unit.id}`}>
                        <DsLayoutInline justify="between" gap="xs">
                          <DsText size="xs" weight="medium">
                            {tb('blockEditor.labels.meshOffsetY', 'Mesh height offset')}
                          </DsText>
                          <DsText
                            size="xs"
                            tone="secondary"
                            data-testid={`immersive-scene-mesh-offset-y-value-${unit.id}`}
                          >
                            {resolveImmersiveSceneUnitMeshOffsetY(unit.meshOffsetY).toFixed(1)}
                          </DsText>
                        </DsLayoutInline>
                        <Slider
                          thumbLabel={tb('blockEditor.labels.meshOffsetY', 'Mesh height offset')}
                          min={-5}
                          max={5}
                          step={0.1}
                          value={resolveImmersiveSceneUnitMeshOffsetY(unit.meshOffsetY)}
                          onChange={(value) =>
                            replaceVisualUnit(unit.id, {
                              meshOffsetY: value === 0 ? undefined : String(value),
                            })
                          }
                        />
                      </DsLayoutStack>
                      <NumberInput
                        label={tb('blockEditor.labels.particleSize', 'Particle size')}
                        data-testid={`immersive-scene-particle-size-${unit.id}`}
                        value={
                          unit.particleSize == null
                            ? undefined
                            : resolveImmersiveSceneUnitParticleSize(unit.particleSize, Number(config.particleSize))
                        }
                        placeholder={config.particleSize}
                        min={0.2}
                        max={5}
                        step={0.1}
                        onChange={(value) =>
                          replaceVisualUnit(unit.id, {
                            particleSize:
                              typeof value === 'number' ? String(value) : value.trim() === '' ? undefined : value,
                          })
                        }
                      />

                      {unit.meshSource === 'file' ? (
                        <>
                          <FilePicker
                            accept={`${meshAcceptString},.glb`}
                            resetRef={(reset) => setAssetFileInputReset(meshAssetKey, reset)}
                            onChange={(files) => void uploadUnitMesh(unit, files[0] ?? null)}
                          >
                            {(onBrowse) => (
                              <Button
                                onClick={onBrowse}
                                data-testid={`immersive-scene-upload-mesh-${unit.id}`}
                                size="xs"
                                emphasis="medium"
                                leftSection={<IconUpload size={14} />}
                                disabled={meshUploadBusy}
                                loading={uploadingAssetKeys.has(meshAssetKey)}
                              >
                                {unit.meshFileId
                                  ? tb('blockEditor.actions.replaceMesh', 'Replace GLB')
                                  : tb('blockEditor.actions.uploadMesh', 'Upload GLB')}
                              </Button>
                            )}
                          </FilePicker>
                          {uploadingAssetKeys.has(meshAssetKey) ? (
                            <DsLayoutInline gap="xxs" align="center" wrap="nowrap">
                              <div style={{ flex: 1 }}>
                                <Progress
                                  aria-label={tb('blockEditor.labels.meshUploadProgress', 'Mesh upload progress')}
                                  value={assetUploadProgress.get(meshAssetKey) ?? 0}
                                  size="xs"
                                />
                              </div>
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                aria-label={tb('blockEditor.actions.cancelMeshUpload', 'Cancel GLB upload')}
                                onClick={() => cancelMeshUpload(meshAssetKey)}
                              >
                                <IconX size={14} />
                              </IconButton>
                            </DsLayoutInline>
                          ) : null}
                          <DsLayoutInline gap="xs" justify="between" wrap="nowrap">
                            <DsText
                              size="xs"
                              tone="secondary"
                              flexible
                              lines={1}
                              data-testid={`immersive-scene-mesh-attachment-${unit.id}`}
                            >
                              {meshAttachment.name || 'No GLB attached'}
                              {meshAttachment.size ? ` (${meshAttachment.size})` : null}
                            </DsText>
                            {meshAttachment.fileId || meshAttachment.url ? (
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                disabled={meshUploadBusy}
                                title={tb('blockEditor.actions.clearMeshAsset', 'Clear mesh asset')}
                                aria-label={tb('blockEditor.actions.clearMeshAsset', 'Clear mesh asset')}
                                onClick={() =>
                                  replaceVisualUnit(unit.id, {
                                    meshFileId: undefined,
                                    meshUrl: undefined,
                                    meshFileName: undefined,
                                    meshFileSize: undefined,
                                    meshObjectName: undefined,
                                    ...clearMeshOptimizationFields(),
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
                            ) : null}
                          </DsLayoutInline>
                          <TextInput
                            label={tb('blockEditor.labels.meshObjectName', 'Mesh object')}
                            value={unit.meshObjectName || ''}
                            disabled={meshUploadBusy}
                            onChange={(event) =>
                              replaceVisualUnit(unit.id, {
                                meshObjectName: event.currentTarget.value,
                              })
                            }
                          />
                          {meshOptimizationControls && (meshAttachment.fileId || meshAttachment.url) ? (
                            <MeshOptimizationPanel
                              pageId={pageId}
                              entityType={TranscodeEntityType.PAGE}
                              sectionId={sectionId}
                              unitId={unit.id}
                              sourceFile={meshAttachment}
                              selection={resolveMeshOptimizationSelection(unit)}
                              controls={meshOptimizationControls}
                              disabled={meshUploadBusy}
                              onUseCandidate={(candidate) =>
                                replaceVisualUnit(unit.id, meshOptimizationPatchFromCandidate(unit, candidate))
                              }
                              onClearSelected={() => replaceVisualUnit(unit.id, clearMeshOptimizationFields())}
                              t={tBlockEditor}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </DsLayoutStack>
                  </Tabs.Panel>

                  <Tabs.Panel value="motion" paddingTop="md">
                    <DsLayoutStack gap="md">
                      <RotationAxisInputs
                        label={tb('blockEditor.labels.initialRotation', 'Initial rotation')}
                        description={tb(
                          'blockEditor.descriptions.rotationOverride',
                          'Blank axes inherit the scene value.',
                        )}
                        values={getRotationAxisValues(unit, 'rotation')}
                        placeholders={sceneRotation}
                        min={-360}
                        max={360}
                        step={1}
                        suffix="°"
                        testId={`immersive-scene-unit-rotation-${unit.id}`}
                        onChange={(axis, value) =>
                          replaceVisualUnit(unit.id, buildRotationAxisPatch('rotation', axis, value))
                        }
                      />
                      {rotationEnabled ? (
                        <RotationAxisInputs
                          label={tb('blockEditor.labels.rotationSpeedAxes', 'Rotation speed')}
                          description={tb(
                            'blockEditor.descriptions.rotationOverride',
                            'Blank axes inherit the scene value.',
                          )}
                          values={getRotationAxisValues(unit, 'rotationSpeed')}
                          placeholders={sceneRotationSpeed}
                          min={-2}
                          max={2}
                          step={0.02}
                          testId={`immersive-scene-unit-rotation-speed-${unit.id}`}
                          onChange={(axis, value) =>
                            replaceVisualUnit(unit.id, buildRotationAxisPatch('rotationSpeed', axis, value))
                          }
                        />
                      ) : null}
                      {!isStatic && config.playback === 'scroll' && rotationEnabled && scrollRotationEnabled ? (
                        <RotationAxisInputs
                          label={tb('blockEditor.labels.scrollRotationAxes', 'Scroll rotation')}
                          description={tb(
                            'blockEditor.descriptions.rotationOverride',
                            'Blank axes inherit the scene value.',
                          )}
                          values={getRotationAxisValues(unit, 'scrollRotationTurns')}
                          placeholders={sceneScrollRotationTurns}
                          min={-2}
                          max={2}
                          step={0.05}
                          testId={`immersive-scene-unit-scroll-rotation-${unit.id}`}
                          onChange={(axis, value) =>
                            replaceVisualUnit(unit.id, buildRotationAxisPatch('scrollRotationTurns', axis, value))
                          }
                        />
                      ) : null}
                    </DsLayoutStack>
                  </Tabs.Panel>

                  <Tabs.Panel value="texture" paddingTop="md">
                    <DsLayoutStack gap="md">
                      <Select
                        label={tb('blockEditor.labels.textureSource', 'Light texture')}
                        data-testid={`immersive-scene-texture-source-${unit.id}`}
                        value={unit.textureSource || 'color'}
                        data={textureSourceOptions}
                        disabled={textureUploadBusy}
                        onChange={(value) => {
                          if (value === 'image') {
                            replaceVisualUnit(unit.id, { textureSource: 'image' });
                            return;
                          }
                          replaceVisualUnit(unit.id, {
                            textureSource: undefined,
                            textureFileId: undefined,
                            textureUrl: undefined,
                            textureFileName: undefined,
                            textureFileSize: undefined,
                          });
                        }}
                      />
                      <ColorInput
                        label={
                          unit.textureSource === 'image'
                            ? tb('blockEditor.labels.fallbackColor', 'Light color')
                            : tb('blockEditor.labels.color', 'Light color')
                        }
                        value={unit.color}
                        format="hex"
                        disabled={textureUploadBusy}
                        onChange={(value) => replaceVisualUnit(unit.id, { color: value })}
                      />
                      {unit.textureSource === 'image' ? (
                        <DsLayoutStack gap="xxs">
                          <DsLayoutInline gap="xs" align="center">
                            <FilePicker
                              accept={textureAcceptString}
                              resetRef={(reset) => setAssetFileInputReset(lightTextureAssetKey, reset)}
                              onChange={(files) => void uploadUnitTexture(unit, files[0] ?? null, 'light')}
                            >
                              {(onBrowse) => (
                                <Button
                                  onClick={onBrowse}
                                  data-testid={`immersive-scene-upload-light-texture-${unit.id}`}
                                  size="xs"
                                  emphasis="medium"
                                  leftSection={<IconPhoto size={14} />}
                                  disabled={textureUploadBusy}
                                  loading={uploadingAssetKeys.has(lightTextureAssetKey)}
                                >
                                  {unit.textureFileId
                                    ? tb('blockEditor.actions.replaceTexture', 'Replace light texture')
                                    : tb('blockEditor.actions.uploadTexture', 'Upload light texture')}
                                </Button>
                              )}
                            </FilePicker>
                            {unit.textureFileId || unit.textureUrl ? (
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                aria-label={tb('blockEditor.actions.clearTextureAsset', 'Clear texture')}
                                onClick={() =>
                                  replaceVisualUnit(unit.id, {
                                    textureFileId: undefined,
                                    textureUrl: undefined,
                                    textureFileName: undefined,
                                    textureFileSize: undefined,
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
                            ) : null}
                          </DsLayoutInline>
                          {uploadingAssetKeys.has(lightTextureAssetKey) ? (
                            <DsLayoutInline gap="xxs" align="center" wrap="nowrap">
                              <div style={{ flex: 1 }}>
                                <Progress
                                  aria-label={tb(
                                    'blockEditor.labels.lightTextureUploadProgress',
                                    'Light texture upload progress',
                                  )}
                                  value={assetUploadProgress.get(lightTextureAssetKey) ?? 0}
                                  size="xs"
                                />
                              </div>
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                aria-label={tb(
                                  'blockEditor.actions.cancelTextureUpload',
                                  'Cancel light texture upload',
                                )}
                                onClick={() => cancelTextureUpload(lightTextureAssetKey)}
                              >
                                <IconX size={14} />
                              </IconButton>
                            </DsLayoutInline>
                          ) : null}
                        </DsLayoutStack>
                      ) : null}

                      <Select
                        label={tb('blockEditor.labels.darkTextureSource', 'Dark texture')}
                        data-testid={`immersive-scene-dark-texture-source-${unit.id}`}
                        value={resolveDarkTextureSourceInput(unit)}
                        data={darkTextureSourceOptions}
                        disabled={textureUploadBusy}
                        onChange={(value) => {
                          if (value === 'image') {
                            replaceVisualUnit(unit.id, { darkTextureSource: 'image' });
                            return;
                          }
                          if (value === 'color') {
                            replaceVisualUnit(unit.id, {
                              darkTextureSource: 'color',
                              darkTextureFileId: undefined,
                              darkTextureUrl: undefined,
                              darkTextureFileName: undefined,
                              darkTextureFileSize: undefined,
                            });
                            return;
                          }
                          replaceVisualUnit(unit.id, {
                            darkColor: undefined,
                            darkTextureSource: undefined,
                            darkTextureFileId: undefined,
                            darkTextureUrl: undefined,
                            darkTextureFileName: undefined,
                            darkTextureFileSize: undefined,
                          });
                        }}
                      />
                      {resolveDarkTextureSourceInput(unit) !== 'inherit' ? (
                        <ColorInput
                          label={
                            resolveDarkTextureSourceInput(unit) === 'image'
                              ? tb('blockEditor.labels.darkFallbackColor', 'Dark color')
                              : tb('blockEditor.labels.darkColor', 'Dark color')
                          }
                          value={unit.darkColor || unit.color}
                          format="hex"
                          disabled={textureUploadBusy}
                          onChange={(value) => replaceVisualUnit(unit.id, { darkColor: value })}
                        />
                      ) : null}
                      {resolveDarkTextureSourceInput(unit) === 'image' ? (
                        <DsLayoutStack gap="xxs">
                          <DsLayoutInline gap="xs" align="center">
                            <FilePicker
                              accept={textureAcceptString}
                              resetRef={(reset) => setAssetFileInputReset(darkTextureAssetKey, reset)}
                              onChange={(files) => void uploadUnitTexture(unit, files[0] ?? null, 'dark')}
                            >
                              {(onBrowse) => (
                                <Button
                                  onClick={onBrowse}
                                  data-testid={`immersive-scene-upload-dark-texture-${unit.id}`}
                                  size="xs"
                                  emphasis="medium"
                                  leftSection={<IconPhoto size={14} />}
                                  disabled={textureUploadBusy}
                                  loading={uploadingAssetKeys.has(darkTextureAssetKey)}
                                >
                                  {unit.darkTextureFileId
                                    ? tb('blockEditor.actions.replaceDarkTexture', 'Replace dark texture')
                                    : tb('blockEditor.actions.uploadDarkTexture', 'Upload dark texture')}
                                </Button>
                              )}
                            </FilePicker>
                            {unit.darkTextureFileId || unit.darkTextureUrl ? (
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                aria-label={tb('blockEditor.actions.clearDarkTextureAsset', 'Clear dark texture')}
                                onClick={() =>
                                  replaceVisualUnit(unit.id, {
                                    darkTextureFileId: undefined,
                                    darkTextureUrl: undefined,
                                    darkTextureFileName: undefined,
                                    darkTextureFileSize: undefined,
                                  })
                                }
                              >
                                <IconTrash size={14} />
                              </IconButton>
                            ) : null}
                          </DsLayoutInline>
                          {uploadingAssetKeys.has(darkTextureAssetKey) ? (
                            <DsLayoutInline gap="xxs" align="center" wrap="nowrap">
                              <div style={{ flex: 1 }}>
                                <Progress
                                  aria-label={tb(
                                    'blockEditor.labels.darkTextureUploadProgress',
                                    'Dark texture upload progress',
                                  )}
                                  value={assetUploadProgress.get(darkTextureAssetKey) ?? 0}
                                  size="xs"
                                />
                              </div>
                              <IconButton
                                size="xs"
                                tone="danger"
                                emphasis="low"
                                aria-label={tb(
                                  'blockEditor.actions.cancelDarkTextureUpload',
                                  'Cancel dark texture upload',
                                )}
                                onClick={() => cancelTextureUpload(darkTextureAssetKey)}
                              >
                                <IconX size={14} />
                              </IconButton>
                            </DsLayoutInline>
                          ) : null}
                        </DsLayoutStack>
                      ) : null}
                    </DsLayoutStack>
                  </Tabs.Panel>

                  {isAutoplay ? (
                    <Tabs.Panel value="timing" paddingTop="md">
                      <NumberInput
                        label={tb('blockEditor.labels.unitHoldOverrideSeconds', 'Hold override')}
                        data-testid={`immersive-scene-unit-hold-${unit.id}`}
                        value={unitHoldOverrideValue}
                        placeholder={config.unitHoldSeconds}
                        min={0.2}
                        max={60}
                        step={0.1}
                        decimalScale={1}
                        suffix="s"
                        onChange={(value) =>
                          replaceVisualUnit(unit.id, {
                            holdSeconds: typeof value === 'number' ? String(value) : undefined,
                          })
                        }
                      />
                    </Tabs.Panel>
                  ) : null}
                </Tabs>
              </DsLayoutStack>
            ) : null}
          </Disclosure>
        ))}
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
