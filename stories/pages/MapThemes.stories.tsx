import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { LayoutContainer } from '@/components/core/Layout';
import { MapThemeListPageView } from '@/features/admin/MapThemeEditor/MapThemeListPageView';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import type { MapTheme } from '@/lib/types/map-theme/model';
function theme(id: string, name: string): MapTheme {
  return {
    id,
    name,
    settings: DEFAULT_THEME_SETTINGS,
    lightVariant: { ...DEFAULT_LIGHT_VARIANT, id: `${id}-light` },
    darkVariant: { ...DEFAULT_DARK_VARIANT, id: `${id}-dark` },
  };
}
const initialThemes = [
  theme('gallery', 'Gallery'),
  theme('printed', 'Printed map'),
  theme('contrast', 'High contrast'),
];
function MapThemesPagePreview({ state = 'ready' }: { state?: 'ready' | 'empty' | 'error' | 'pending' }) {
  const [themes, setThemes] = useState(state === 'empty' ? [] : initialThemes);
  const [defaultId, setDefaultId] = useState('gallery');
  return (
    <LayoutContainer size="wide" inset="md">
      <MapThemeListPageView
        themes={themes}
        defaultMapThemeId={defaultId}
        loadFailed={state === 'error'}
        copyLoading={state === 'pending'}
        deleteLoading={state === 'pending'}
        createAction={null}
        onCopy={async (source, name) => {
          if (state === 'pending') {
            return false;
          }
          setThemes((current) => [...current, { ...source, id: `${source.id}-copy-${current.length}`, name }]);
          return true;
        }}
        onDelete={async (source) => {
          if (state === 'pending') {
            return false;
          }
          setThemes((current) => current.filter((item) => item.id !== source.id));
          return true;
        }}
        onSetDefault={(source) => setDefaultId(source.id)}
      />
    </LayoutContainer>
  );
}
const meta = {
  title: 'Pages/Admin/Map Themes',
  component: MapThemesPagePreview,
  args: { state: 'ready' },
  render: (args) => <MapThemesPagePreview key={args.state} {...args} />,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Production MapThemeListPageView including copy form, delete confirmation and default-theme restrictions. Local mutations only. Create-theme action and editor navigation are outside this preview; no admin authorization or server persistence.',
      },
    },
  },
} satisfies Meta<typeof MapThemesPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Error: Story = { args: { state: 'error' } };
export const PendingConfirmation: Story = { args: { state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
