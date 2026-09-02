'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Divider, Grid, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { OgGenerationRunProgress } from '@/features/metadata/OgGenerationRunProgress';
import { TextInput, ColorInput, NumberInput, Slider } from '@/components/core/Input';
import { Tabs } from '@/components/core/Tabs';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard } from '@/components/core/Section';
import {
  regenerateAllOgImagesAction,
  updateContentOgConfigAction,
  updateHomeOgConfigAction,
} from '@/lib/actions/site-setting';
import { getOgConfig } from '@/lib/queries/site-setting-browser';
import { useOgGenerationRun } from '@/lib/hooks/useOgGenerationRun';
import type { ContentOgImageConfig, HomeOgImageConfig } from '@/lib/types/site-setting/config';
import { DEFAULT_CONTENT_OG_CONFIG, DEFAULT_HOME_OG_CONFIG } from '@/lib/utils/og-config';

type TabValue = 'home' | 'content';

export default function OgImageSettingsPage() {
  const t = useTranslations('ogImageSettings');
  const queryClient = useQueryClient();
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['siteSettings', 'ogConfig'],
    queryFn: getOgConfig,
  });

  const [activeTab, setActiveTab] = useState<TabValue>('home');
  const generationRun = useOgGenerationRun();

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
        result: await updateHomeOgConfigAction(values),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: t('notifications.homeSaved'),
        color: 'green',
      });
      generationRun.trackRequestedRun(requestSequence, result.ogGenerationRunId);
      queryClient.invalidateQueries({ queryKey: ['siteSettings', 'ogConfig'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const updateContentOgConfig = useMutation({
    mutationFn: async (values: ContentOgImageConfig) => {
      const requestSequence = generationRun.beginRunRequest();
      return {
        requestSequence,
        result: await updateContentOgConfigAction(values),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: t('notifications.contentSaved'),
        color: 'green',
      });
      generationRun.trackRequestedRun(requestSequence, result.ogGenerationRunId);
      queryClient.invalidateQueries({ queryKey: ['siteSettings', 'ogConfig'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const regenerateAll = useMutation({
    mutationFn: async () => {
      const requestSequence = generationRun.beginRunRequest();
      return {
        requestSequence,
        result: await regenerateAllOgImagesAction(),
      };
    },
    onSuccess: ({ requestSequence, result }) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: t('notifications.regeneratingAll'),
        color: 'blue',
      });
      generationRun.trackRequestedRun(requestSequence, result.runId);
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const handleHomeReset = () => {
    homeForm.setValues(DEFAULT_HOME_OG_CONFIG);
    notifications.show({ message: t('notifications.resetToDefaults'), color: 'yellow' });
  };

  const handleContentReset = () => {
    contentForm.setValues(DEFAULT_CONTENT_OG_CONFIG);
    notifications.show({ message: t('notifications.resetToDefaults'), color: 'yellow' });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{t('title')}</Title>
          <Text c="dimmed" size="sm">
            {t('description')}
          </Text>
        </div>
        <Button
          tone="accent"
          emphasis="medium"
          onClick={() => regenerateAll.mutate()}
          loading={regenerateAll.isPending || generationRun.isActive}
        >
          {t('actions.regenerateAll')}
        </Button>
      </Group>

      <OgGenerationRunProgress run={generationRun.run} error={generationRun.error} />

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as TabValue)}>
        <Tabs.List>
          <Tabs.Tab value="home">{t('tabs.home')}</Tabs.Tab>
          <Tabs.Tab value="content">{t('tabs.content')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="home" pt="md">
          <HomeSettingsPanel
            form={homeForm}
            onSubmit={(values) => updateHomeOgConfig.mutate(values)}
            onReset={handleHomeReset}
            isLoading={updateHomeOgConfig.isPending}
          />
        </Tabs.Panel>

        <Tabs.Panel value="content" pt="md">
          <ContentSettingsPanel
            form={contentForm}
            onSubmit={(values) => updateContentOgConfig.mutate(values)}
            onReset={handleContentReset}
            isLoading={updateContentOgConfig.isPending}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

interface HomeSettingsPanelProps {
  form: ReturnType<typeof useForm<HomeOgImageConfig>>;
  onSubmit: (values: HomeOgImageConfig) => void;
  onReset: () => void;
  isLoading: boolean;
}

function HomeSettingsPanel({ form, onSubmit, onReset, isLoading }: HomeSettingsPanelProps) {
  const t = useTranslations('ogImageSettings');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [debouncedConfig] = useDebouncedValue(form.values, 500);

  // Update preview when config changes
  useEffect(() => {
    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }

    previewAbortRef.current = new AbortController();
    setPreviewLoading(true);

    fetch('/api/og-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'home', config: debouncedConfig }),
      signal: previewAbortRef.current.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to generate preview');
        }
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          // Silent fail for UX
        }
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [debouncedConfig]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="md">
            <Group justify="flex-end">
              <Button emphasis="medium" onClick={onReset}>
                {t('actions.resetToDefaults')}
              </Button>
              <Button type="submit" loading={isLoading}>
                {tCommonActions('save')}
              </Button>
            </Group>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{tCommonLabels('background')}</Title>
                <Divider />
                <ColorInput
                  label={t('home.fields.backgroundColor')}
                  format="hex"
                  {...form.getInputProps('darkBackground')}
                />
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{t('home.sections.logoSize')}</Title>
                <Text size="xs" c="dimmed">
                  {t('home.helpers.logoCentered')}
                </Text>
                <Divider />
                <Group grow>
                  <NumberInput
                    label={tCommonLabels('width')}
                    min={16}
                    max={400}
                    {...form.getInputProps('logo.width')}
                  />
                  <NumberInput
                    label={tCommonLabels('height')}
                    min={16}
                    max={400}
                    {...form.getInputProps('logo.height')}
                  />
                </Group>
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{t('shared.sections.siteTitle')}</Title>
                <Text size="xs" c="dimmed">
                  {t('shared.helpers.siteTitleFallback')}
                </Text>
                <Divider />
                <NumberInput
                  label={tCommonLabels('fontSize')}
                  min={20}
                  max={120}
                  {...form.getInputProps('siteTitle.fontSize')}
                />
                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...form.getInputProps('siteTitle.fontWeight')}
                />
                <ColorInput label={tCommonLabels('color')} format="hex" {...form.getInputProps('siteTitle.color')} />
              </Stack>
            </SectionCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Box pos="sticky" top={16}>
            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{t('shared.sections.livePreview')}</Title>
                <Text size="xs" c="dimmed">
                  {t('home.helpers.previewDescription')}
                </Text>
                <Divider />

                <Paper withBorder p={0} style={{ overflow: 'hidden', aspectRatio: '1200/630' }}>
                  {previewLoading && !previewUrl ? (
                    <Stack align="center" justify="center" h="100%">
                      <Loader />
                      <Text size="sm" c="dimmed">
                        {t('shared.preview.generating')}
                      </Text>
                    </Stack>
                  ) : previewUrl ? (
                    <Box pos="relative" w="100%" h="100%">
                      {previewLoading && (
                        <Box pos="absolute" top={8} right={8} bg="rgba(0,0,0,0.5)" px={8} py={4}>
                          <Group gap={6}>
                            <Loader size="xs" color="white" />
                            <Text size="xs" c="white">
                              {t('shared.preview.updating')}
                            </Text>
                          </Group>
                        </Box>
                      )}
                      <img
                        src={previewUrl}
                        alt={t('shared.preview.alt')}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : (
                    <Stack align="center" justify="center" h="100%">
                      <Text c="dimmed">{tCommonStates('loadingPreview')}</Text>
                    </Stack>
                  )}
                </Paper>

                <Text size="xs" c="dimmed">
                  {t('shared.preview.dimensions')}
                </Text>
              </Stack>
            </SectionCard>
          </Box>
        </Grid.Col>
      </Grid>
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [debouncedConfig] = useDebouncedValue(form.values, 500);
  const [debouncedTitle] = useDebouncedValue(testTitle, 300);

  useEffect(() => {
    if (!debouncedTitle.trim()) {
      return;
    }

    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }

    previewAbortRef.current = new AbortController();
    setPreviewLoading(true);

    fetch('/api/og-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'content', title: debouncedTitle, config: debouncedConfig }),
      signal: previewAbortRef.current.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to generate preview');
        }
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = url;
        setPreviewUrl(url);
      })
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') {
          // Silent fail for UX
        }
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [debouncedConfig, debouncedTitle]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={form.onSubmit(onSubmit)}>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="md">
            <Group justify="flex-end">
              <Button emphasis="medium" onClick={onReset}>
                {t('actions.resetToDefaults')}
              </Button>
              <Button type="submit" loading={isLoading}>
                {tCommonActions('save')}
              </Button>
            </Group>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{tCommonLabels('background')}</Title>
                <Divider />
                <ColorInput
                  label={t('content.fields.darkBackgroundColor')}
                  description={t('content.fields.darkBackgroundColorDescription')}
                  format="hex"
                  {...form.getInputProps('darkBackground')}
                />
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{tCommonLabels('title')}</Title>
                <Divider />

                <ColorInput
                  label={t('content.fields.titleColor')}
                  format="hex"
                  {...form.getInputProps('title.color')}
                />

                <NumberInput
                  label={tCommonLabels('maxLength')}
                  description={t('content.fields.maxLengthDescription')}
                  min={20}
                  max={200}
                  {...form.getInputProps('title.maxLength')}
                />

                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    {t('content.fields.fontSizeThreshold')}
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    {t('content.fields.fontSizeThresholdDescription')}
                  </Text>
                  <Slider
                    min={20}
                    max={100}
                    marks={[
                      { value: 20, label: '20' },
                      { value: 60, label: '60' },
                      { value: 100, label: '100' },
                    ]}
                    {...form.getInputProps('title.fontSizeThreshold')}
                  />
                </Box>

                <Group grow>
                  <NumberInput
                    label={t('content.fields.largeFontSize')}
                    description={t('content.fields.largeFontSizeDescription')}
                    min={20}
                    max={100}
                    {...form.getInputProps('title.fontSizeLarge')}
                  />
                  <NumberInput
                    label={t('content.fields.smallFontSize')}
                    description={t('content.fields.smallFontSizeDescription')}
                    min={20}
                    max={100}
                    {...form.getInputProps('title.fontSizeSmall')}
                  />
                </Group>

                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...form.getInputProps('title.fontWeight')}
                />

                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    {tCommonLabels('lineHeight')}
                  </Text>
                  <Slider
                    min={1}
                    max={2}
                    step={0.1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 1.5, label: '1.5' },
                      { value: 2, label: '2' },
                    ]}
                    {...form.getInputProps('title.lineHeight')}
                  />
                </Box>

                <Title order={6} mt="sm">
                  {t('content.sections.padding')}
                </Title>
                <Group grow>
                  <NumberInput
                    label={tCommonLabels('top')}
                    min={0}
                    max={200}
                    {...form.getInputProps('title.padding.top')}
                  />
                  <NumberInput
                    label={tCommonLabels('right')}
                    min={0}
                    max={200}
                    {...form.getInputProps('title.padding.right')}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label={tCommonLabels('bottom')}
                    min={0}
                    max={200}
                    {...form.getInputProps('title.padding.bottom')}
                  />
                  <NumberInput
                    label={tCommonLabels('left')}
                    min={0}
                    max={200}
                    {...form.getInputProps('title.padding.left')}
                  />
                </Group>
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{tCommonLabels('logo')}</Title>
                <Divider />

                <Group grow>
                  <NumberInput
                    label={tCommonLabels('width')}
                    min={16}
                    max={200}
                    {...form.getInputProps('logo.width')}
                  />
                  <NumberInput
                    label={tCommonLabels('height')}
                    min={16}
                    max={200}
                    {...form.getInputProps('logo.height')}
                  />
                </Group>

                <Title order={6}>{t('content.sections.logoPosition')}</Title>
                <Group grow>
                  <NumberInput
                    label={tCommonLabels('bottom')}
                    min={0}
                    max={200}
                    {...form.getInputProps('logo.position.bottom')}
                  />
                  <NumberInput
                    label={tCommonLabels('right')}
                    min={0}
                    max={200}
                    {...form.getInputProps('logo.position.right')}
                  />
                </Group>
              </Stack>
            </SectionCard>

            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{t('shared.sections.siteTitle')}</Title>
                <Text size="xs" c="dimmed">
                  {t('shared.helpers.siteTitleFallback')}
                </Text>
                <Divider />

                <NumberInput
                  label={tCommonLabels('fontSize')}
                  min={10}
                  max={50}
                  {...form.getInputProps('siteTitle.fontSize')}
                />

                <NumberInput
                  label={tCommonLabels('fontWeight')}
                  min={100}
                  max={900}
                  step={100}
                  {...form.getInputProps('siteTitle.fontWeight')}
                />

                <ColorInput label={tCommonLabels('color')} format="hex" {...form.getInputProps('siteTitle.color')} />

                <Box>
                  <Text size="sm" fw={500} mb={4}>
                    {tCommonLabels('opacity')}
                  </Text>
                  <Slider
                    min={0}
                    max={1}
                    step={0.05}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 0.5, label: '0.5' },
                      { value: 1, label: '1' },
                    ]}
                    {...form.getInputProps('siteTitle.opacity')}
                  />
                </Box>
              </Stack>
            </SectionCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Box pos="sticky" top={16}>
            <SectionCard>
              <Stack gap="md">
                <Title order={4}>{t('shared.sections.livePreview')}</Title>
                <Text size="xs" c="dimmed">
                  {t('content.preview.description')}
                </Text>
                <Divider />

                <TextInput
                  label={t('content.preview.testTitleLabel')}
                  description={t('content.preview.testTitleDescription')}
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                />

                <Paper withBorder p={0} style={{ overflow: 'hidden', aspectRatio: '1200/630' }}>
                  {previewLoading && !previewUrl ? (
                    <Stack align="center" justify="center" h="100%">
                      <Loader />
                      <Text size="sm" c="dimmed">
                        {t('shared.preview.generating')}
                      </Text>
                    </Stack>
                  ) : previewUrl ? (
                    <Box pos="relative" w="100%" h="100%">
                      {previewLoading && (
                        <Box pos="absolute" top={8} right={8} bg="rgba(0,0,0,0.5)" px={8} py={4}>
                          <Group gap={6}>
                            <Loader size="xs" color="white" />
                            <Text size="xs" c="white">
                              {t('shared.preview.updating')}
                            </Text>
                          </Group>
                        </Box>
                      )}
                      <img
                        src={previewUrl}
                        alt={t('shared.preview.alt')}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </Box>
                  ) : (
                    <Stack align="center" justify="center" h="100%">
                      <Text c="dimmed">{t('content.preview.empty')}</Text>
                    </Stack>
                  )}
                </Paper>

                <Text size="xs" c="dimmed">
                  {t('shared.preview.dimensions')}
                </Text>
              </Stack>
            </SectionCard>
          </Box>
        </Grid.Col>
      </Grid>
    </form>
  );
}
