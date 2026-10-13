import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SegmentedControl } from '@/components/core/Input';
import { LayoutStack } from '@/components/core/Layout';
import { DEFAULT_LIGHT_VARIANT, DEFAULT_DARK_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import { ThemeEditorCanvas } from './ThemeEditorCanvas';
const meta: Meta<typeof ThemeEditorCanvas> = {
  title: 'Feature/Admin/Map Theme Editor',
  component: ThemeEditorCanvas,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof ThemeEditorCanvas>;
function Interactive() {
  const t = useTranslations('mapControls');
  const [variant, setVariant] = useState(DEFAULT_LIGHT_VARIANT);
  const [settings, setSettings] = useState(DEFAULT_THEME_SETTINGS);
  return (
    <LayoutStack gap="sm">
      <SegmentedControl
        label={t('fields.colorScheme')}
        value={variant.scheme}
        data={[
          { value: 'light', label: t('scheme.light') },
          { value: 'dark', label: t('scheme.dark') },
        ]}
        onChange={(value) => setVariant(value === 'dark' ? DEFAULT_DARK_VARIANT : DEFAULT_LIGHT_VARIANT)}
      />
      <div style={{ position: 'relative', height: 640 }}>
        <ThemeEditorCanvas
          variant={variant}
          settings={settings}
          onVariantChange={setVariant}
          onSettingsChange={setSettings}
        />
      </div>
    </LayoutStack>
  );
}
export const AuthoredThemeEditing: Story = { render: () => <Interactive /> };
