import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { operationsLabels } from './fixtures/operations-a11y';
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
function MapThemesPagePreview({
  state = 'ready',
}: {
  state?: 'ready' | 'empty' | 'error' | 'pending' | 'default-pending';
}) {
  const [themes, setThemes] = useState(state === 'empty' ? [] : initialThemes);
  const [defaultId, setDefaultId] = useState('gallery');
  const [defaultUpdatingId, setDefaultUpdatingId] = useState<string | null>(null);
  return (
    <LayoutContainer size="wide" inset="md">
      <MapThemeListPageView
        themes={themes}
        defaultMapThemeId={defaultId}
        defaultUpdatingId={defaultUpdatingId}
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
        onSetDefault={async (source) => {
          setDefaultUpdatingId(source.id);
          if (state === 'default-pending') {
            return new Promise<void>(() => {});
          }
          setDefaultId(source.id);
          setDefaultUpdatingId(null);
        }}
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
          'Production MapThemeListPageView including copy form, delete confirmation and default-theme restrictions. Local mutations only. DefaultUpdating holds the local default command pending after selection. Create-theme action and editor navigation are outside this preview; no admin authorization or server persistence.',
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
export const DefaultUpdating: Story = {
  args: { state: 'default-pending' },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const t = await operationsLabels(globals);
    const actions = canvas.getByRole('button', { name: t.dataTable('aria.rowActions', { label: 'Printed map' }) });
    await userEvent.click(actions);
    await userEvent.click(await page.findByRole('menuitem', { name: t.common('actions.setAsDefault') }));
    await expect(actions).toHaveAttribute('aria-busy', 'true');
    await expect(actions).toBeDisabled();
    await expect(canvas.getByText(t.common('statuses.default'))).toBeVisible();
  },
};
export const ChangeDefault: Story = {
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    const t = await operationsLabels(globals);
    await userEvent.click(
      canvas.getByRole('button', { name: t.dataTable('aria.rowActions', { label: 'Printed map' }) }),
    );
    await userEvent.click(await page.findByRole('menuitem', { name: t.common('actions.setAsDefault') }));
    const card = canvas.getByRole('link', { name: 'Printed map' }).closest<HTMLElement>('[data-map-theme-card]')!;
    await expect(within(card).getByText(t.common('statuses.default'))).toBeVisible();
  },
};
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
