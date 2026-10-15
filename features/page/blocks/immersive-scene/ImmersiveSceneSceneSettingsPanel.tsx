'use client';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { Disclosure } from '@/components/core/Disclosure';
import { ColorInput, NumberInput, SegmentedControl, Select, Slider, Switch } from '@/components/core/Input';
import {
  DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS,
  DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS,
  parseImmersiveSceneConfig,
} from './schema';
import { RotationAxisInputs } from './RotationAxisInputs';
import { buildRotationAxisPatch, getRotationAxisValues } from './settings-model';

type SceneConfig = ReturnType<typeof parseImmersiveSceneConfig>;
type RotationValues = ReturnType<typeof getRotationAxisValues>;
type Option = { value: string; label: string };

export type ImmersiveSceneSceneMessageKey =
  | 'blockEditor.labels.backgroundColor'
  | 'blockEditor.labels.backgroundEnabled'
  | 'blockEditor.labels.colorScheme'
  | 'blockEditor.labels.darkBackgroundColor'
  | 'blockEditor.labels.darkParticleBrightness'
  | 'blockEditor.labels.darkTextColor'
  | 'blockEditor.labels.darkTextColorSource'
  | 'blockEditor.labels.hoverEnabled'
  | 'blockEditor.labels.hoverRepelRadius'
  | 'blockEditor.labels.initialRotation'
  | 'blockEditor.labels.lightTextColor'
  | 'blockEditor.labels.loop'
  | 'blockEditor.labels.particleBrightness'
  | 'blockEditor.labels.particleSize'
  | 'blockEditor.labels.rotationEnabled'
  | 'blockEditor.labels.rotationSpeedAxes'
  | 'blockEditor.labels.sceneHeight'
  | 'blockEditor.labels.scrollHeight'
  | 'blockEditor.labels.scrollRotationAxes'
  | 'blockEditor.labels.scrollRotationEnabled'
  | 'blockEditor.labels.textColorSource'
  | 'blockEditor.labels.textureSize'
  | 'blockEditor.labels.transition'
  | 'blockEditor.labels.transitionWindow'
  | 'blockEditor.labels.unitGapSeconds'
  | 'blockEditor.labels.unitHoldSeconds'
  | 'blockEditor.options.playback.autoplay'
  | 'blockEditor.options.playback.scroll'
  | 'blockEditor.options.transition.linear'
  | 'blockEditor.options.transition.smooth'
  | 'blockEditor.sections.sceneAppearance'
  | 'blockEditor.sections.sceneMotion'
  | 'blockEditor.sections.sceneParticles'
  | 'blockEditor.sections.scenePlayback';

interface Props {
  config: SceneConfig;
  isStatic: boolean;
  isAutoplay: boolean;
  backgroundEnabled: boolean;
  particleBrightness: number;
  darkParticleBrightness: number;
  rotationEnabled: boolean;
  scrollRotationEnabled: boolean;
  sceneRotation: RotationValues;
  sceneRotationSpeed: RotationValues;
  sceneScrollRotationTurns: RotationValues;
  hoverEnabled: boolean;
  hoverRepelRadius: number;
  colorSchemeOptions: readonly Option[];
  textColorSourceOptions: readonly Option[];
  darkTextColorSourceOptions: readonly Option[];
  textureSizeOptions: readonly Option[];
  updateSharedProps: (props: Record<string, unknown>) => void;
  tb: (key: ImmersiveSceneSceneMessageKey, fallback: string) => string;
}

export function ImmersiveSceneSceneSettingsPanel({
  config,
  isStatic,
  isAutoplay,
  backgroundEnabled,
  particleBrightness,
  darkParticleBrightness,
  rotationEnabled,
  scrollRotationEnabled,
  sceneRotation,
  sceneRotationSpeed,
  sceneScrollRotationTurns,
  hoverEnabled,
  hoverRepelRadius,
  colorSchemeOptions,
  textColorSourceOptions,
  darkTextColorSourceOptions,
  textureSizeOptions,
  updateSharedProps,
  tb,
}: Props) {
  return (
    <DsLayoutStack gap="lg" data-page-block-editor="immersive-scene-scene">
      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="strong">
          {tb('blockEditor.sections.scenePlayback', 'Playback')}
        </DsText>
        {!isStatic ? (
          <SegmentedControl
            value={config.playback}
            onChange={(value) => updateSharedProps({ playback: value })}
            data={[
              {
                value: 'scroll',
                label: tb('blockEditor.options.playback.scroll', 'Scroll'),
              },
              {
                value: 'autoplay',
                label: tb('blockEditor.options.playback.autoplay', 'Autoplay'),
              },
            ]}
          />
        ) : null}
        <NumberInput
          label={tb('blockEditor.labels.sceneHeight', 'Scene height')}
          value={Number(config.minHeightPx)}
          min={360}
          max={1600}
          suffix="px"
          onChange={(value) => updateSharedProps({ minHeightPx: String(value || 720) })}
        />
        {!isStatic && config.playback === 'scroll' ? (
          <NumberInput
            label={tb('blockEditor.labels.scrollHeight', 'Scroll height')}
            value={Number(config.heightVh)}
            min={120}
            max={900}
            suffix="vh"
            onChange={(value) => updateSharedProps({ heightVh: String(value || 360) })}
          />
        ) : null}
        {isAutoplay ? (
          <DsLayoutStack gap="md">
            <NumberInput
              label={tb('blockEditor.labels.unitHoldSeconds', 'Unit hold')}
              value={Number(config.unitHoldSeconds)}
              min={0.2}
              max={60}
              step={0.1}
              decimalScale={1}
              suffix="s"
              onChange={(value) =>
                updateSharedProps({
                  unitHoldSeconds: String(
                    typeof value === 'number' ? value : DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS,
                  ),
                })
              }
            />
            <NumberInput
              label={tb('blockEditor.labels.unitGapSeconds', 'Unit gap')}
              value={Number(config.unitGapSeconds)}
              min={0}
              max={30}
              step={0.1}
              decimalScale={1}
              suffix="s"
              onChange={(value) =>
                updateSharedProps({
                  unitGapSeconds: String(typeof value === 'number' ? value : DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS),
                })
              }
            />
            <Switch
              label={tb('blockEditor.labels.loop', 'Loop')}
              checked={config.loop === 'true'}
              onChange={(event) =>
                updateSharedProps({
                  loop: event.currentTarget.checked ? 'true' : 'false',
                })
              }
            />
          </DsLayoutStack>
        ) : null}
      </DsLayoutStack>

      <DsLayoutStack gap="none">
        <Disclosure defaultOpened label={tb('blockEditor.sections.sceneAppearance', 'Appearance')}>
          <DsLayoutStack gap="md">
            <Select
              label={tb('blockEditor.labels.colorScheme', 'Theme')}
              value={config.preferredScheme}
              data={[...colorSchemeOptions]}
              onChange={(value) => updateSharedProps({ preferredScheme: value || 'auto' })}
            />
            <Switch
              label={tb('blockEditor.labels.backgroundEnabled', 'Scene background')}
              checked={backgroundEnabled}
              onChange={(event) =>
                updateSharedProps({
                  backgroundEnabled: event.currentTarget.checked ? 'true' : 'false',
                })
              }
            />
            {backgroundEnabled ? (
              <>
                <ColorInput
                  label={tb('blockEditor.labels.backgroundColor', 'Light background')}
                  value={config.backgroundColor}
                  format="hex"
                  onChange={(value) => updateSharedProps({ backgroundColor: value })}
                />
                <ColorInput
                  label={tb('blockEditor.labels.darkBackgroundColor', 'Dark background')}
                  value={config.darkBackgroundColor}
                  format="hex"
                  onChange={(value) => updateSharedProps({ darkBackgroundColor: value })}
                />
              </>
            ) : null}
            <Select
              label={tb('blockEditor.labels.textColorSource', 'Text color')}
              value={config.textColorSource}
              data={textColorSourceOptions}
              onChange={(value) => updateSharedProps({ textColorSource: value || 'theme' })}
            />
            {config.textColorSource === 'custom' ? (
              <>
                <ColorInput
                  label={tb('blockEditor.labels.lightTextColor', 'Light text')}
                  value={config.lightTextColor}
                  format="hex"
                  onChange={(value) => updateSharedProps({ lightTextColor: value })}
                />
                <Select
                  label={tb('blockEditor.labels.darkTextColorSource', 'Dark text')}
                  value={config.darkTextColorSource}
                  data={darkTextColorSourceOptions}
                  onChange={(value) =>
                    updateSharedProps({
                      darkTextColorSource: value || 'inherit',
                    })
                  }
                />
                {config.darkTextColorSource === 'custom' ? (
                  <ColorInput
                    label={tb('blockEditor.labels.darkTextColor', 'Dark text color')}
                    value={config.darkTextColor}
                    format="hex"
                    onChange={(value) => updateSharedProps({ darkTextColor: value })}
                  />
                ) : null}
              </>
            ) : null}
          </DsLayoutStack>
        </Disclosure>

        <Disclosure label={tb('blockEditor.sections.sceneParticles', 'Particles')}>
          <DsLayoutStack gap="md">
            <Select
              label={tb('blockEditor.labels.textureSize', 'Particle count')}
              value={config.textureSize}
              data={textureSizeOptions}
              onChange={(value) => updateSharedProps({ textureSize: value || '64' })}
            />
            <NumberInput
              label={tb('blockEditor.labels.particleSize', 'Particle size')}
              value={Number(config.particleSize)}
              min={0.2}
              max={5}
              step={0.1}
              onChange={(value) => updateSharedProps({ particleSize: String(value || 1) })}
            />
            <DsLayoutStack gap="xxs">
              <DsLayoutInline justify="between" gap="xs">
                <DsText size="xs" weight="medium">
                  {tb('blockEditor.labels.particleBrightness', 'Light particle brightness')}
                </DsText>
                <DsText size="xs" tone="secondary">
                  {Number.isFinite(particleBrightness) ? particleBrightness.toFixed(2) : '1.25'}
                </DsText>
              </DsLayoutInline>
              <Slider
                thumbLabel={tb('blockEditor.labels.particleBrightness', 'Light particle brightness')}
                min={0.2}
                max={3}
                step={0.05}
                value={Number.isFinite(particleBrightness) ? particleBrightness : 1.25}
                onChange={(value) => updateSharedProps({ particleBrightness: String(value) })}
              />
            </DsLayoutStack>
            <DsLayoutStack gap="xxs">
              <DsLayoutInline justify="between" gap="xs">
                <DsText size="xs" weight="medium">
                  {tb('blockEditor.labels.darkParticleBrightness', 'Dark particle brightness')}
                </DsText>
                <DsText size="xs" tone="secondary">
                  {Number.isFinite(darkParticleBrightness) ? darkParticleBrightness.toFixed(2) : '1.45'}
                </DsText>
              </DsLayoutInline>
              <Slider
                thumbLabel={tb('blockEditor.labels.darkParticleBrightness', 'Dark particle brightness')}
                min={0.2}
                max={3}
                step={0.05}
                value={Number.isFinite(darkParticleBrightness) ? darkParticleBrightness : 1.45}
                onChange={(value) =>
                  updateSharedProps({
                    darkParticleBrightness: String(value),
                  })
                }
              />
            </DsLayoutStack>
          </DsLayoutStack>
        </Disclosure>

        <Disclosure label={tb('blockEditor.sections.sceneMotion', 'Motion')}>
          <DsLayoutStack gap="md">
            <Select
              label={tb('blockEditor.labels.transition', 'Transition')}
              value={config.transition}
              data={[
                {
                  value: 'smooth',
                  label: tb('blockEditor.options.transition.smooth', 'Smooth'),
                },
                {
                  value: 'linear',
                  label: tb('blockEditor.options.transition.linear', 'Linear'),
                },
              ]}
              onChange={(value) => updateSharedProps({ transition: value || 'smooth' })}
            />
            <NumberInput
              label={tb('blockEditor.labels.transitionWindow', 'Text blend')}
              value={Number(config.transitionWindow)}
              min={0.08}
              max={0.8}
              step={0.02}
              onChange={(value) =>
                updateSharedProps({
                  transitionWindow: String(value || 0.22),
                })
              }
            />
            <RotationAxisInputs
              label={tb('blockEditor.labels.initialRotation', 'Initial rotation')}
              values={sceneRotation}
              min={-360}
              max={360}
              step={1}
              suffix="°"
              testId="immersive-scene-rotation"
              onChange={(axis, value) => updateSharedProps(buildRotationAxisPatch('rotation', axis, value ?? '0'))}
            />
            <Switch
              label={tb('blockEditor.labels.rotationEnabled', 'Animate rotation')}
              checked={rotationEnabled}
              onChange={(event) =>
                updateSharedProps({
                  rotationEnabled: event.currentTarget.checked ? 'true' : 'false',
                })
              }
            />
            {rotationEnabled ? (
              <RotationAxisInputs
                label={tb('blockEditor.labels.rotationSpeedAxes', 'Rotation speed')}
                values={sceneRotationSpeed}
                min={-2}
                max={2}
                step={0.02}
                testId="immersive-scene-rotation-speed"
                onChange={(axis, value) =>
                  updateSharedProps(
                    buildRotationAxisPatch('rotationSpeed', axis, value ?? (axis === 'y' ? '0.18' : '0')),
                  )
                }
              />
            ) : null}
            {!isStatic && config.playback === 'scroll' && rotationEnabled ? (
              <>
                <Switch
                  label={tb('blockEditor.labels.scrollRotationEnabled', 'Add scroll rotation')}
                  checked={scrollRotationEnabled}
                  onChange={(event) =>
                    updateSharedProps({
                      scrollRotationEnabled: event.currentTarget.checked ? 'true' : 'false',
                    })
                  }
                />
                {scrollRotationEnabled ? (
                  <RotationAxisInputs
                    label={tb('blockEditor.labels.scrollRotationAxes', 'Scroll rotation')}
                    values={sceneScrollRotationTurns}
                    min={-2}
                    max={2}
                    step={0.05}
                    testId="immersive-scene-scroll-rotation"
                    onChange={(axis, value) =>
                      updateSharedProps(
                        buildRotationAxisPatch('scrollRotationTurns', axis, value ?? (axis === 'y' ? '0.35' : '0')),
                      )
                    }
                  />
                ) : null}
              </>
            ) : null}
            <Switch
              label={tb('blockEditor.labels.hoverEnabled', 'Pointer interaction')}
              checked={hoverEnabled}
              onChange={(event) =>
                updateSharedProps({
                  hoverEnabled: event.currentTarget.checked ? 'true' : 'false',
                })
              }
            />
            {hoverEnabled ? (
              <DsLayoutStack gap="xxs">
                <DsLayoutInline justify="between" gap="xs">
                  <DsText size="xs" weight="medium">
                    {tb('blockEditor.labels.hoverRepelRadius', 'Hover radius')}
                  </DsText>
                  <DsText size="xs" tone="secondary">
                    {Number.isFinite(hoverRepelRadius) ? hoverRepelRadius.toFixed(2) : '0.45'}
                  </DsText>
                </DsLayoutInline>
                <Slider
                  thumbLabel={tb('blockEditor.labels.hoverRepelRadius', 'Hover radius')}
                  min={0.05}
                  max={2}
                  step={0.05}
                  value={Number.isFinite(hoverRepelRadius) ? hoverRepelRadius : 0.45}
                  onChange={(value) => updateSharedProps({ hoverRepelRadius: String(value) })}
                />
              </DsLayoutStack>
            ) : null}
          </DsLayoutStack>
        </Disclosure>
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
