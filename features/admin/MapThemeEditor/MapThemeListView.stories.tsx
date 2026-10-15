import type { Meta, StoryObj } from '@storybook/nextjs';
import { useRef, useState } from 'react';
import { DEFAULT_DARK_VARIANT, DEFAULT_LIGHT_VARIANT, DEFAULT_THEME_SETTINGS } from '@/lib/types/map-theme/schema';
import type { MapTheme } from '@/lib/types/map-theme/model';
import { MapThemeListView, type MapThemeListViewProps } from './MapThemeListView';

function fixtureTheme(id: string, name: string): MapTheme {
  return {
    id,
    name,
    settings: DEFAULT_THEME_SETTINGS,
    lightVariant: { ...DEFAULT_LIGHT_VARIANT, id: `${id}-light` },
    darkVariant: { ...DEFAULT_DARK_VARIANT, id: `${id}-dark` },
  };
}

const themes = [
  fixtureTheme('default', 'Gallery'),
  fixtureTheme('print', 'Printed map'),
  fixtureTheme('contrast', 'High contrast'),
];

/** Local view callbacks; persistence and route-level confirmations remain with the page controller. */
function InteractiveList(args: MapThemeListViewProps) {
  const [visibleThemes, setVisibleThemes] = useState(args.themes);
  const [defaultThemeId, setDefaultThemeId] = useState(args.defaultMapThemeId);
  const copyIndex = useRef(0);
  return (
    <MapThemeListView
      {...args}
      themes={visibleThemes}
      defaultMapThemeId={defaultThemeId}
      onCopy={(theme) => {
        const copyNumber = ++copyIndex.current;
        const id = `${theme.id}-copy-${copyNumber}`;
        setVisibleThemes((current) => [...current, { ...theme, id, name: `${theme.name} · ${copyNumber}` }]);
        args.onCopy(theme);
      }}
      onDelete={(theme) => {
        setVisibleThemes((current) => current.filter((item) => item.id !== theme.id));
        args.onDelete(theme);
      }}
      onSetDefault={(theme) => {
        setDefaultThemeId(theme.id);
        args.onSetDefault(theme);
      }}
    />
  );
}

const meta = {
  title: 'Feature/Admin/Map Theme List',
  component: MapThemeListView,
  parameters: { layout: 'padded' },
  args: {
    themes,
    defaultMapThemeId: 'default',
    onCopy: () => {},
    onDelete: () => {},
    onSetDefault: () => {},
  },
  render: (args) => <InteractiveList {...args} />,
} satisfies Meta<typeof MapThemeListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cards: Story = {};
export const LastDefaultTheme: Story = { args: { themes: themes.slice(0, 1) } };
export const Empty: Story = { args: { themes: [] } };
export const LoadFailed: Story = { args: { themes: [], loadFailed: true } };
export const LongName: Story = {
  args: {
    themes: [
      themes[0],
      fixtureTheme('long-name', 'A map theme with a long name that must leave the actions menu reachable'),
      themes[2],
    ],
  },
};
export const Narrow: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
