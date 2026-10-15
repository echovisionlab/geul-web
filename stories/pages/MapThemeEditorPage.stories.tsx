import { expect, userEvent, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { goBackPreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Alert } from '@/components/core/Alert';
import { ThemeEditorPageView } from '@/features/admin/MapThemeEditor/ThemeEditorPage';
import { PageLoader } from '@/features/site/PageLoader';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import type { ThemeVariant } from '@/lib/types/map-theme/model';
import type { MapThemeVariantTab } from '@/features/admin/MapThemeEditor/MapThemeVariantTabs';
function Preview({ state = 'ready' }: { state?: 'ready' | 'pending' | 'failed' | 'disconnected' }) {
  const t = useTranslations('common.actions');
  const statuses = useTranslations('common.statuses');
  const page = useTranslations('adminList.mapThemes');
  const [name, setName] = useState('Printed map');
  const [activeTab, setActiveTab] = useState<MapThemeVariantTab>('light');
  const [light, setLight] = useState<Omit<ThemeVariant, 'id'>>(DEFAULT_LIGHT_VARIANT);
  const [dark, setDark] = useState<Omit<ThemeVariant, 'id'>>(DEFAULT_DARK_VARIANT);
  const [settings, setSettings] = useState(DEFAULT_THEME_SETTINGS);
  const [isDefault, setDefault] = useState(false);
  if (state === 'pending') {
    return <ThemeEditorPageView model={{ kind: 'state', content: <PageLoader /> }} />;
  }
  if (state === 'failed') {
    return (
      <ThemeEditorPageView
        model={{
          kind: 'state',
          content: (
            <Alert role="alert" tone="danger">
              {page('loadFailed')}
            </Alert>
          ),
        }}
      />
    );
  }
  const connected = state !== 'disconnected';
  return (
    <ThemeEditorPageView
      model={{
        kind: 'ready',
        name,
        setName,
        canMutate: connected,
        headerStatus: isDefault ? 'default' : 'custom',
        headerStatusOptions: [
          { value: 'custom', label: statuses('custom'), actionLabel: statuses('custom'), tone: 'neutral' },
          { value: 'default', label: statuses('default'), actionLabel: t('setAsDefault'), tone: 'accent' },
        ],
        isConnected: connected,
        isSynced: connected,
        handleBack: goBackPreview,
        isDefault,
        handleStatusChange: () => setDefault(true),
        isSettingDefault: false,
        tCommonActions: t,
        activeTab,
        setActiveTab,
        blocked: false,
        currentVariant: activeTab === 'dark' ? dark : light,
        settings,
        handleVariantChange: activeTab === 'dark' ? setDark : setLight,
        handleSettingsChange: setSettings,
        interruption: null,
      }}
    />
  );
}
const meta = {
  title: 'Pages/Admin/Map Theme Editor',
  component: Preview,
  args: { state: 'ready' },
  render: (args) => <Preview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Complete production ThemeEditorPageView, header, variant tabs and real canvas controls. Local variant/default callbacks; map tile services, authorization and network collaboration are outside.',
      },
    },
  },
} satisfies Meta<typeof Preview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Pending: Story = { args: { state: 'pending' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Disconnected: Story = { args: { state: 'disconnected' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };

export const KeyboardViewControls: Story = {
  tags: ['a11y-operations'],
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const t = await operationsLabels(globals);
    const mode = await canvas.findByRole('radiogroup', { name: t.mapTheme('viewMode.label') });
    const twoD = within(mode).getByRole('radio', { name: t.mapTheme('viewMode.twoD') });
    const threeD = within(mode).getByRole('radio', { name: t.mapTheme('viewMode.threeD') });
    await expect(twoD).toBeChecked();
    twoD.focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(threeD).toBeChecked();
    const rotation = canvas.getByRole('switch', { name: t.map('fields.autoRotate') });
    rotation.focus();
    await userEvent.keyboard(' ');
    await expect(rotation).toBeChecked();
    const count = canvas.getByRole('radiogroup', { name: t.mapTheme('viewMode.mockPlaces') });
    await expect(within(count).getByRole('radio', { name: '1' })).toBeChecked();
    const panel = canvas.getByRole('tabpanel');
    const selectedTab = canvas.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveAttribute('aria-controls', panel.id);
    await expect(panel).toHaveAttribute('aria-labelledby', selectedTab.id);
    selectedTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    const nextTab = canvas.getByRole('tab', { selected: true });
    await expect(nextTab).not.toBe(selectedTab);
    await expect(nextTab).toHaveAttribute('aria-controls', panel.id);
    await expect(panel).toHaveAttribute('aria-labelledby', nextTab.id);
  },
};
