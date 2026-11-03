'use client';

import { AuthoringExtension, useAuthoringExtensionAvailable } from '@/features/authoring/AuthoringExtensionsContext';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { fieldBindings } from '@/components/core/bindings';
import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
  LayoutGridItem as DsLayoutGridItem,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Spinner as Loader } from '@/components/core/Display';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Button, SaveButton } from '@/components/core/Button';
import { OgGenerationRunProgress } from '@/features/metadata/OgGenerationRunProgress';
import { useOgPreview } from '@/features/metadata/useOgPreview';
import { TextInput, ColorInput, NumberInput, Slider } from '@/components/core/Input';
import { Tabs } from '@/components/core/Tabs';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard, SectionHeader, SettingsGroup, SettingsSection } from '@/components/core/Section';
import { Field } from '@/components/core/Field';
import { PageHeader } from '@/components/core/PageHeader';
import { SiteOgImagePanel, type SiteOgImageBindings } from '@/features/site/SiteOgImagePanel/SiteOgImagePanel';
import {
  regenerateAllOgImagesAction,
  updateContentOgConfigAction,
  updateHomeOgConfigAction,
} from '@/lib/actions/site-setting';
import { getAllSiteSettings, getOgConfig } from '@/lib/queries/site-setting-browser';
import { useOgGenerationRun } from '@/lib/hooks/useOgGenerationRun';
import type { ContentOgImageConfig, HomeOgImageConfig } from '@/lib/types/site-setting/config';
import { DEFAULT_CONTENT_OG_CONFIG, DEFAULT_HOME_OG_CONFIG } from '@/lib/utils/og-config';

type TabValue = 'home' | 'content';

import { getOgGenerationRunAction } from '@/lib/actions/og-generation';
export interface OgImageSettingsPageBindings {
  getOgConfig: typeof getOgConfig;
  regenerateAllOgImagesAction: typeof regenerateAllOgImagesAction;
  updateContentOgConfigAction: typeof updateContentOgConfigAction;
  updateHomeOgConfigAction: typeof updateHomeOgConfigAction;
  getOgGenerationRunAction: typeof getOgGenerationRunAction;
  getSettings?: typeof getAllSiteSettings;
  siteOg?: SiteOgImageBindings;
}
const defaultBindings: OgImageSettingsPageBindings = {
  getOgConfig,
  regenerateAllOgImagesAction,
  updateContentOgConfigAction,
  updateHomeOgConfigAction,
  getOgGenerationRunAction,
};
export default function OgImageSettingsPage({
  bindings = defaultBindings,
}: { bindings?: OgImageSettingsPageBindings } = {}) {
  const t = useTranslations('ogImageSettings');
  const queryClient = useQueryClient();
  const savedConfigQuery = useQuery({
    queryKey: ['siteSettings', 'ogConfig'],
    queryFn: bindings.getOgConfig,
  });
  const { data: savedConfig, isLoading } = savedConfigQuery;
  // The home sharing image panel reads the site background from Site Settings.
  const siteSettingsQuery = useQuery({
    queryKey: ['siteSettings', 'all'],
    queryFn: bindings.getSettings ?? getAllSiteSettings,
  });

  const [activeTab, setActiveTab] = useState<TabValue>('home');
  const generationRun = useOgGenerationRun(bindings.getOgGenerationRunAction);

  // Home config form
  const homeForm = useForm<HomeOgImageConfig>({
    initialValues: DEFAULT_HOME_OG_CONFIG,
  });

  // Content config form
  const contentForm = useForm<ContentOgImageConfig>({
    initialValues: DEFAULT_CONTENT_OG_CONFIG,
  });

  // Load saved config when available
  useEffect(() => {
    if (savedConfig) {
      if (savedConfig.home) {
        homeForm.setValues(savedConfig.home);
      }
      if (savedConfig.content) {
        contentForm.setValues(savedConfig.content);
      }
    }
  }, [savedConfig]);

  const updateHomeOgConfig = useMutation({
    mutationFn: async (values: HomeOgImageConfig) => {
      const requestSequence = generationRun.beginRunRequest();
      return {
        requestSequence,
        result: await bindings.updateHomeOgConfigAction(values),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: t('notifications.homeSaved'),
        tone: 'positive',
      });
      generationRun.trackRequestedRun(requestSequence, result.ogGenerationRunId);
      queryClient.invalidateQueries({ queryKey: ['siteSettings', 'ogConfig'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const updateContentOgConfig = useMutation({
    mutationFn: async (values: ContentOgImageConfig) => {
      const requestSequence = generationRun.beginRunRequest();
      return {
        requestSequence,
        result: await bindings.updateContentOgConfigAction(values),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: t('notifications.contentSaved'),
        tone: 'positive',
      });
      generationRun.trackRequestedRun(requestSequence, result.ogGenerationRunId);
      queryClient.invalidateQueries({ queryKey: ['siteSettings', 'ogConfig'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const regenerateAll = useMutation({
    mutationFn: async () => {
      const requestSequence = generationRun.beginRunRequest();
      return {
        requestSequence,
        result: await bindings.regenerateAllOgImagesAction(),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: t('notifications.regeneratingAll'),
        tone: 'neutral',
      });
      generationRun.trackRequestedRun(requestSequence, result.runId);
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const handleHomeReset = () => {
    homeForm.setValues(DEFAULT_HOME_OG_CONFIG);
    notifications.show({ message: t('notifications.resetToDefaults'), tone: 'positive' });
  };

  const handleContentReset = () => {
    contentForm.setValues(DEFAULT_CONTENT_OG_CONFIG);
    notifications.show({ message: t('notifications.resetToDefaults'), tone: 'positive' });
  };

  if (savedConfigQuery.isError) {
    return <QueryErrorAlert queries={[savedConfigQuery]} />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <DsLayoutStack gap="lg">
      <QueryErrorAlert queries={[savedConfigQuery]} />
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <AuthoringExtension kind="generation">
            <Button
              emphasis="medium"
              tone="accent"
              onClick={() => regenerateAll.mutate()}
              loading={regenerateAll.isPending || generationRun.isActive}
            >
              {t('actions.regenerateAll')}
            </Button>
          </AuthoringExtension>
        }
      />

      <AuthoringExtension kind="generation">
        <OgGenerationRunProgress run={generationRun.run} error={generationRun.error} />
      </AuthoringExtension>

      <Tabs aria-label={t('title')} value={activeTab} onChange={(v) => setActiveTab(v as TabValue)}>
        <Tabs.List>
          <Tabs.Tab value="home">{t('tabs.home')}</Tabs.Tab>
          <Tabs.Tab value="content">{t('tabs.content')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="home" paddingTop="md">
          <HomeSettingsPanel
            sharingImage={
              siteSettingsQuery.isError ? (
                <QueryErrorAlert queries={[siteSettingsQuery]} />
              ) : siteSettingsQuery.isLoading ? (
                <PageLoader placement="flow" />
              ) : (
                <SiteOgImagePanel
                  bindings={bindings.siteOg}
                  currentBackgroundUrl={siteSettingsQuery.data?.site_og_background_url ?? null}
                />
              )
            }
            form={homeForm}
            onSubmit={(values) => updateHomeOgConfig.mutate(values)}
            onReset={handleHomeReset}
            isLoading={updateHomeOgConfig.isPending}
          />
        </Tabs.Panel>

        <Tabs.Panel value="content" paddingTop="md">
          <ContentSettingsPanel
            form={contentForm}
            onSubmit={(values) => updateContentOgConfig.mutate(values)}
            onReset={handleContentReset}
            isLoading={updateContentOgConfig.isPending}
          />
        </Tabs.Panel>
      </Tabs>
    </DsLayoutStack>
  );
}

interface HomeSettingsPanelProps {
  sharingImage: ReactNode;
  form: ReturnType<typeof useForm<HomeOgImageConfig>>;
  onSubmit: (values: HomeOgImageConfig) => void;
  onReset: () => void;
  isLoading: boolean;
}

function HomeSettingsPanel({ sharingImage, form, onSubmit, onReset, isLoading }: HomeSettingsPanelProps) {
  const t = useTranslations('ogImageSettings');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const [debouncedConfig] = useDebouncedValue(form.values, 500);
  const generationAvailable = useAuthoringExtensionAvailable('generation');
  const preview = useOgPreview({ type: 'home', config: debouncedConfig }, generationAvailable);
  const { previewUrl, isFetching: previewLoading } = preview;

  return (
    <form aria-label={`${t('title')} ${t('tabs.home')}`} aria-busy={isLoading} onSubmit={form.onSubmit(onSubmit)}>
      <DsLayoutGrid columns={12} gap="lg">
        <DsLayoutGridItem span={{ base: 12, lg: generationAvailable ? 5 : 12 }}>
          <DsLayoutStack gap="xl">
            <SettingsSection title={t('home.sections.currentImage')} description={t('home.helpers.currentImage')}>
              {sharingImage}
            </SettingsSection>

            <SettingsSection title={tCommonLabels('background')}>
              <ColorInput
                label={t('home.fields.backgroundColor')}
                format="hex"
                {...fieldBindings(form.getInputProps('darkBackground'))}
              />
            </SettingsSection>

            <SettingsSection title={t('home.sections.logoSize')} description={t('home.helpers.logoCentered')}>
              <DsLayoutInline grow>
                <NumberInput
                  label={tCommonLabels('width')}
                  min={16}
                  max={400}
                  {...fieldBindings(form.getInputProps('logo.width'))}
                />
                <NumberInput
                  label={tCommonLabels('height')}
                  min={16}
                  max={400}
                  {...fieldBindings(form.getInputProps('logo.height'))}
                />
              </DsLayoutInline>
            </SettingsSection>

            <SettingsSection title={t('shared.sections.siteTitle')} description={t('shared.helpers.siteTitleFallback')}>
              <DsLayoutStack gap="md">
                <NumberInput
                  label={tCommonLabels('fontSize')}
                  min={20}
                  max={120}
                  {...fieldBindings(form.getInputProps('siteTitle.fontSize'))}
                />
                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...fieldBindings(form.getInputProps('siteTitle.fontWeight'))}
                />
                <ColorInput
                  label={tCommonLabels('color')}
                  format="hex"
                  {...fieldBindings(form.getInputProps('siteTitle.color'))}
                />
              </DsLayoutStack>
            </SettingsSection>

            <DsLayoutInline justify="end" gap="xs">
              <Button emphasis="low" onClick={onReset}>
                {t('actions.resetToDefaults')}
              </Button>
              <SaveButton type="submit" loading={isLoading}>
                {tCommonActions('save')}
              </SaveButton>
            </DsLayoutInline>
          </DsLayoutStack>
        </DsLayoutGridItem>

        <AuthoringExtension kind="generation">
          <DsLayoutGridItem span={{ base: 12, lg: 7 }}>
            <div style={{ position: 'sticky', top: 16 }}>
              <SectionCard>
                <DsLayoutStack gap="md">
                  <SectionHeader
                    level={2}
                    title={t('shared.sections.livePreview')}
                    description={t('home.helpers.previewDescription')}
                  />

                  <QueryErrorAlert queries={[preview]} />
                  {(!preview.isError || previewUrl) && (
                    <div style={{ aspectRatio: '1200/630' }}>
                      <DsSectionCard padding="none" border="none" clip>
                        {previewLoading && !previewUrl ? (
                          <PageLoader placement="flow" message={t('shared.preview.generating')} />
                        ) : previewUrl ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {previewLoading && (
                              <div
                                style={{
                                  position: 'absolute',
                                  insetBlockStart: 'var(--geul-spacing-xs)',
                                  insetInlineEnd: 'var(--geul-spacing-xs)',
                                }}
                              >
                                <SectionCard padding="xxs" border="none" appearance="overlay">
                                  <DsLayoutInline gap="xxs">
                                    <Loader size="xs" tone="neutral" />
                                    <DsText size="xs" tone="inverse">
                                      {t('shared.preview.updating')}
                                    </DsText>
                                  </DsLayoutInline>
                                </SectionCard>
                              </div>
                            )}
                            <img
                              src={previewUrl}
                              alt={t('shared.preview.alt')}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <DsLayoutStack align="center" justify="center" fill="block">
                            <SupportingText tone="secondary">{t('shared.preview.generating')}</SupportingText>
                          </DsLayoutStack>
                        )}
                      </DsSectionCard>
                    </div>
                  )}

                  <DsText size="xs" tone="secondary">
                    {t('shared.preview.dimensions')}
                  </DsText>
                </DsLayoutStack>
              </SectionCard>
            </div>
          </DsLayoutGridItem>
        </AuthoringExtension>
      </DsLayoutGrid>
    </form>
  );
}

interface ContentSettingsPanelProps {
  form: ReturnType<typeof useForm<ContentOgImageConfig>>;
  onSubmit: (values: ContentOgImageConfig) => void;
  onReset: () => void;
  isLoading: boolean;
}

function ContentSettingsPanel({ form, onSubmit, onReset, isLoading }: ContentSettingsPanelProps) {
  const t = useTranslations('ogImageSettings');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const [testTitle, setTestTitle] = useState(() => t('content.preview.testTitleDefault'));
  const [debouncedConfig] = useDebouncedValue(form.values, 500);
  const [debouncedTitle] = useDebouncedValue(testTitle, 300);
  const generationAvailable = useAuthoringExtensionAvailable('generation');
  const preview = useOgPreview(
    { type: 'content', title: debouncedTitle, config: debouncedConfig },
    generationAvailable,
  );
  const { previewUrl, isFetching: previewLoading } = preview;

  return (
    <form aria-label={`${t('title')} ${t('tabs.content')}`} aria-busy={isLoading} onSubmit={form.onSubmit(onSubmit)}>
      <DsLayoutGrid columns={12} gap="lg">
        <DsLayoutGridItem span={{ base: 12, lg: generationAvailable ? 5 : 12 }}>
          <DsLayoutStack gap="xl">
            <SettingsSection title={tCommonLabels('background')}>
              <DsLayoutStack gap="md">
                <ColorInput
                  label={t('content.fields.darkBackgroundColor')}
                  description={t('content.fields.darkBackgroundColorDescription')}
                  format="hex"
                  {...fieldBindings(form.getInputProps('darkBackground'))}
                />
              </DsLayoutStack>
            </SettingsSection>

            <SettingsSection title={tCommonLabels('title')}>
              <DsLayoutStack gap="md">
                <ColorInput
                  label={t('content.fields.titleColor')}
                  format="hex"
                  {...fieldBindings(form.getInputProps('title.color'))}
                />

                <NumberInput
                  label={tCommonLabels('maxLength')}
                  description={t('content.fields.maxLengthDescription')}
                  min={20}
                  max={200}
                  {...fieldBindings(form.getInputProps('title.maxLength'))}
                />

                <Field
                  label={t('content.fields.fontSizeThreshold')}
                  description={t('content.fields.fontSizeThresholdDescription')}
                >
                  <Slider
                    aria-label={t('content.fields.fontSizeThreshold')}
                    min={20}
                    max={100}
                    marks={[
                      { value: 20, label: '20' },
                      { value: 60, label: '60' },
                      { value: 100, label: '100' },
                    ]}
                    {...fieldBindings(form.getInputProps('title.fontSizeThreshold'))}
                  />
                </Field>

                <DsLayoutInline grow>
                  <NumberInput
                    label={t('content.fields.largeFontSize')}
                    description={t('content.fields.largeFontSizeDescription')}
                    min={20}
                    max={100}
                    {...fieldBindings(form.getInputProps('title.fontSizeLarge'))}
                  />
                  <NumberInput
                    label={t('content.fields.smallFontSize')}
                    description={t('content.fields.smallFontSizeDescription')}
                    min={20}
                    max={100}
                    {...fieldBindings(form.getInputProps('title.fontSizeSmall'))}
                  />
                </DsLayoutInline>

                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...fieldBindings(form.getInputProps('title.fontWeight'))}
                />

                <Field label={tCommonLabels('lineHeight')}>
                  <Slider
                    aria-label={tCommonLabels('lineHeight')}
                    min={1}
                    max={2}
                    step={0.1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 1.5, label: '1.5' },
                      { value: 2, label: '2' },
                    ]}
                    {...fieldBindings(form.getInputProps('title.lineHeight'))}
                  />
                </Field>

                <SettingsGroup title={t('content.sections.padding')}>
                  <DsLayoutInline grow>
                    <NumberInput
                      label={tCommonLabels('top')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('title.padding.top'))}
                    />
                    <NumberInput
                      label={tCommonLabels('right')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('title.padding.right'))}
                    />
                  </DsLayoutInline>
                  <DsLayoutInline grow>
                    <NumberInput
                      label={tCommonLabels('bottom')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('title.padding.bottom'))}
                    />
                    <NumberInput
                      label={tCommonLabels('left')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('title.padding.left'))}
                    />
                  </DsLayoutInline>
                </SettingsGroup>
              </DsLayoutStack>
            </SettingsSection>

            <SettingsSection title={tCommonLabels('logo')}>
              <DsLayoutStack gap="md">
                <DsLayoutInline grow>
                  <NumberInput
                    label={tCommonLabels('width')}
                    min={16}
                    max={200}
                    {...fieldBindings(form.getInputProps('logo.width'))}
                  />
                  <NumberInput
                    label={tCommonLabels('height')}
                    min={16}
                    max={200}
                    {...fieldBindings(form.getInputProps('logo.height'))}
                  />
                </DsLayoutInline>

                <SettingsGroup title={t('content.sections.logoPosition')}>
                  <DsLayoutInline grow>
                    <NumberInput
                      label={tCommonLabels('bottom')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('logo.position.bottom'))}
                    />
                    <NumberInput
                      label={tCommonLabels('right')}
                      min={0}
                      max={200}
                      {...fieldBindings(form.getInputProps('logo.position.right'))}
                    />
                  </DsLayoutInline>
                </SettingsGroup>
              </DsLayoutStack>
            </SettingsSection>

            <SettingsSection title={t('shared.sections.siteTitle')} description={t('shared.helpers.siteTitleFallback')}>
              <DsLayoutStack gap="md">
                <NumberInput
                  label={tCommonLabels('fontSize')}
                  min={10}
                  max={50}
                  {...fieldBindings(form.getInputProps('siteTitle.fontSize'))}
                />

                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...fieldBindings(form.getInputProps('siteTitle.fontWeight'))}
                />

                <ColorInput
                  label={tCommonLabels('color')}
                  format="hex"
                  {...fieldBindings(form.getInputProps('siteTitle.color'))}
                />

                <Field label={tCommonLabels('opacity')}>
                  <Slider
                    aria-label={tCommonLabels('opacity')}
                    min={0}
                    max={1}
                    step={0.05}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 0.5, label: '0.5' },
                      { value: 1, label: '1' },
                    ]}
                    {...fieldBindings(form.getInputProps('siteTitle.opacity'))}
                  />
                </Field>
              </DsLayoutStack>
            </SettingsSection>
            <DsLayoutInline justify="end" gap="xs">
              <Button emphasis="low" onClick={onReset}>
                {t('actions.resetToDefaults')}
              </Button>
              <SaveButton type="submit" loading={isLoading}>
                {tCommonActions('save')}
              </SaveButton>
            </DsLayoutInline>
          </DsLayoutStack>
        </DsLayoutGridItem>

        <AuthoringExtension kind="generation">
          <DsLayoutGridItem span={{ base: 12, lg: 7 }}>
            <div style={{ position: 'sticky', top: 16 }}>
              <SectionCard>
                <DsLayoutStack gap="md">
                  <SectionHeader
                    level={2}
                    title={t('shared.sections.livePreview')}
                    description={t('content.preview.description')}
                  />

                  <TextInput
                    label={t('content.preview.testTitleLabel')}
                    description={t('content.preview.testTitleDescription')}
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                  />

                  <QueryErrorAlert queries={[preview]} />
                  {(!preview.isError || previewUrl) && (
                    <div style={{ aspectRatio: '1200/630' }}>
                      <DsSectionCard padding="none" border="none" clip>
                        {previewLoading && !previewUrl ? (
                          <PageLoader placement="flow" message={t('shared.preview.generating')} />
                        ) : previewUrl ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {previewLoading && (
                              <div
                                style={{
                                  position: 'absolute',
                                  insetBlockStart: 'var(--geul-spacing-xs)',
                                  insetInlineEnd: 'var(--geul-spacing-xs)',
                                }}
                              >
                                <SectionCard padding="xxs" border="none" appearance="overlay">
                                  <DsLayoutInline gap="xxs">
                                    <Loader size="xs" tone="neutral" />
                                    <DsText size="xs" tone="inverse">
                                      {t('shared.preview.updating')}
                                    </DsText>
                                  </DsLayoutInline>
                                </SectionCard>
                              </div>
                            )}
                            <img
                              src={previewUrl}
                              alt={t('shared.preview.alt')}
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          </div>
                        ) : (
                          <DsLayoutStack align="center" justify="center" fill="block">
                            <SupportingText tone="secondary">{t('content.preview.empty')}</SupportingText>
                          </DsLayoutStack>
                        )}
                      </DsSectionCard>
                    </div>
                  )}

                  <DsText size="xs" tone="secondary">
                    {t('shared.preview.dimensions')}
                  </DsText>
                </DsLayoutStack>
              </SectionCard>
            </div>
          </DsLayoutGridItem>
        </AuthoringExtension>
      </DsLayoutGrid>
    </form>
  );
}
