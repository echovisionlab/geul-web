'use client';

import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { IconArrowDown, IconArrowUp, IconPhoto, IconPlus, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { Accordion, Divider, FileButton, Group, Progress, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { ColorInput, NumberInput, Select, Slider, TextInput } from '@/components/core/Input';
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
  reorderUnit: (index: number, direction: -1 | 1) => void;
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
    <Stack gap="md" data-page-block-editor="immersive-scene-unit">
      <Group justify="space-between" gap="xs" align="center">
        <Text size="xs" c="dimmed" fw={600}>
          {tb('blockEditor.sections.sceneUnits', 'Units')}
        </Text>
        <IconButton
          size="xs"
          emphasis="low"
          title={tb('blockEditor.actions.addSceneUnit', 'Add unit')}
          aria-label={tb('blockEditor.actions.addSceneUnit', 'Add unit')}
          onClick={addUnit}
        >
          <IconPlus size={14} />
        </IconButton>
      </Group>

      <Accordion
        value={activeSelectedUnitId || null}
        onChange={(value) => selectUnit(value ?? '')}
        chevronPosition="left"
        variant="contained"
      >
        {config.units.map((candidate, index) => (
          <Accordion.Item key={candidate.id} value={candidate.id}>
            <Group gap={0} wrap="nowrap" align="center">
              <Accordion.Control style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" truncate>
                  {index + 1}. {candidate.name?.trim() || `${tb('blockEditor.labels.sceneUnit', 'Unit')} ${index + 1}`}
                </Text>
              </Accordion.Control>
              <Group gap={2} pr={6} wrap="nowrap">
                <IconButton
                  size="xs"
                  emphasis="low"
                  disabled={index === 0}
                  aria-label={tb('blockEditor.actions.moveUnitUp', 'Move unit up')}
                  onClick={() => reorderUnit(index, -1)}
                >
                  <IconArrowUp size={14} />
                </IconButton>
                <IconButton
                  size="xs"
                  emphasis="low"
                  disabled={index === config.units.length - 1}
                  aria-label={tb('blockEditor.actions.moveUnitDown', 'Move unit down')}
                  onClick={() => reorderUnit(index, 1)}
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
              </Group>
            </Group>

            <Accordion.Panel>
              {candidate.id === activeSelectedUnitId ? (
                <Stack gap="md">
                  <TextInput
                    label={tb('blockEditor.labels.sceneUnitName', 'Unit name')}
                    value={unit.name ?? ''}
                    placeholder={`${tb('blockEditor.labels.sceneUnit', 'Unit')} ${selectedIndex + 1}`}
                    size="xs"
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

                    <Tabs.Panel value="content" pt="md">
                      <Stack gap="sm">
                        <TextInput
                          label={tb('blockEditor.labels.title', 'Title')}
                          value={unit.title}
                          size="xs"
                          onChange={(event) =>
                            replaceCopyUnit(unit.id, {
                              title: event.currentTarget.value,
                            })
                          }
                        />
                        <ImmersiveSceneDescriptionEditor
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
                      </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="mesh" pt="md">
                      <Stack gap="sm">
                        <Select
                          label={tb('blockEditor.labels.meshSource', 'Mesh source')}
                          data-testid={`immersive-scene-mesh-source-${unit.id}`}
                          value={unit.meshSource || 'primitive'}
                          data={meshSourceOptions}
                          size="xs"
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
                          size="xs"
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
                          size="xs"
                          onChange={(value) =>
                            replaceVisualUnit(unit.id, {
                              scale: String(value || 1),
                            })
                          }
                        />
                        <Stack gap={6} data-testid={`immersive-scene-mesh-offset-y-${unit.id}`}>
                          <Group justify="space-between" gap="xs">
                            <Text size="xs" fw={500}>
                              {tb('blockEditor.labels.meshOffsetY', 'Mesh height offset')}
                            </Text>
                            <Text size="xs" c="dimmed" data-testid={`immersive-scene-mesh-offset-y-value-${unit.id}`}>
                              {resolveImmersiveSceneUnitMeshOffsetY(unit.meshOffsetY).toFixed(1)}
                            </Text>
                          </Group>
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
                            size="xs"
                          />
                        </Stack>
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
                          size="xs"
                          onChange={(value) =>
                            replaceVisualUnit(unit.id, {
                              particleSize:
                                typeof value === 'number' ? String(value) : value.trim() === '' ? undefined : value,
                            })
                          }
                        />

                        {unit.meshSource === 'file' ? (
                          <>
                            <FileButton
                              accept={`${meshAcceptString},.glb`}
                              resetRef={(reset) => setAssetFileInputReset(meshAssetKey, reset)}
                              onChange={(file) => void uploadUnitMesh(unit, file)}
                            >
                              {(fileButtonProps) => (
                                <Button
                                  {...fileButtonProps}
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
                            </FileButton>
                            {uploadingAssetKeys.has(meshAssetKey) ? (
                              <Group gap={4} align="center" wrap="nowrap">
                                <Progress
                                  aria-label={tb('blockEditor.labels.meshUploadProgress', 'Mesh upload progress')}
                                  value={assetUploadProgress.get(meshAssetKey) ?? 0}
                                  size="xs"
                                  style={{ flex: 1 }}
                                />
                                <IconButton
                                  size="xs"
                                  tone="danger"
                                  emphasis="low"
                                  aria-label={tb('blockEditor.actions.cancelMeshUpload', 'Cancel GLB upload')}
                                  onClick={() => cancelMeshUpload(meshAssetKey)}
                                >
                                  <IconX size={14} />
                                </IconButton>
                              </Group>
                            ) : null}
                            <Group gap="xs" justify="space-between" wrap="nowrap">
                              <Text
                                size="xs"
                                c="dimmed"
                                style={{ minWidth: 0, flex: 1 }}
                                lineClamp={1}
                                data-testid={`immersive-scene-mesh-attachment-${unit.id}`}
                              >
                                {meshAttachment.name || 'No GLB attached'}
                                {meshAttachment.size ? ` (${meshAttachment.size})` : null}
                              </Text>
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
                            </Group>
                            <TextInput
                              label={tb('blockEditor.labels.meshObjectName', 'Mesh object')}
                              value={unit.meshObjectName || ''}
                              size="xs"
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
                      </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="motion" pt="md">
                      <Stack gap="md">
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
                      </Stack>
                    </Tabs.Panel>

                    <Tabs.Panel value="texture" pt="md">
                      <Stack gap="sm">
                        <Select
                          label={tb('blockEditor.labels.textureSource', 'Light texture')}
                          data-testid={`immersive-scene-texture-source-${unit.id}`}
                          value={unit.textureSource || 'color'}
                          data={textureSourceOptions}
                          size="xs"
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
                          size="xs"
                          disabled={textureUploadBusy}
                          onChange={(value) => replaceVisualUnit(unit.id, { color: value })}
                        />
                        {unit.textureSource === 'image' ? (
                          <Stack gap={6}>
                            <Group gap="xs" align="center">
                              <FileButton
                                accept={textureAcceptString}
                                resetRef={(reset) => setAssetFileInputReset(lightTextureAssetKey, reset)}
                                onChange={(file) => void uploadUnitTexture(unit, file, 'light')}
                              >
                                {(fileButtonProps) => (
                                  <Button
                                    {...fileButtonProps}
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
                              </FileButton>
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
                            </Group>
                            {uploadingAssetKeys.has(lightTextureAssetKey) ? (
                              <Group gap={4} align="center" wrap="nowrap">
                                <Progress
                                  aria-label={tb(
                                    'blockEditor.labels.lightTextureUploadProgress',
                                    'Light texture upload progress',
                                  )}
                                  value={assetUploadProgress.get(lightTextureAssetKey) ?? 0}
                                  size="xs"
                                  style={{ flex: 1 }}
                                />
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
                              </Group>
                            ) : null}
                          </Stack>
                        ) : null}

                        <Divider />

                        <Select
                          label={tb('blockEditor.labels.darkTextureSource', 'Dark texture')}
                          data-testid={`immersive-scene-dark-texture-source-${unit.id}`}
                          value={resolveDarkTextureSourceInput(unit)}
                          data={darkTextureSourceOptions}
                          size="xs"
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
                            size="xs"
                            disabled={textureUploadBusy}
                            onChange={(value) => replaceVisualUnit(unit.id, { darkColor: value })}
                          />
                        ) : null}
                        {resolveDarkTextureSourceInput(unit) === 'image' ? (
                          <Stack gap={6}>
                            <Group gap="xs" align="center">
                              <FileButton
                                accept={textureAcceptString}
                                resetRef={(reset) => setAssetFileInputReset(darkTextureAssetKey, reset)}
                                onChange={(file) => void uploadUnitTexture(unit, file, 'dark')}
                              >
                                {(fileButtonProps) => (
                                  <Button
                                    {...fileButtonProps}
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
                              </FileButton>
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
                            </Group>
                            {uploadingAssetKeys.has(darkTextureAssetKey) ? (
                              <Group gap={4} align="center" wrap="nowrap">
                                <Progress
                                  aria-label={tb(
                                    'blockEditor.labels.darkTextureUploadProgress',
                                    'Dark texture upload progress',
                                  )}
                                  value={assetUploadProgress.get(darkTextureAssetKey) ?? 0}
                                  size="xs"
                                  style={{ flex: 1 }}
                                />
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
                              </Group>
                            ) : null}
                          </Stack>
                        ) : null}
                      </Stack>
                    </Tabs.Panel>

                    {isAutoplay ? (
                      <Tabs.Panel value="timing" pt="md">
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
                          size="xs"
                          onChange={(value) =>
                            replaceVisualUnit(unit.id, {
                              holdSeconds: typeof value === 'number' ? String(value) : undefined,
                            })
                          }
                        />
                      </Tabs.Panel>
                    ) : null}
                  </Tabs>
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
