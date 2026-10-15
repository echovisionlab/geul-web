import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { CommandPalette, CommandPaletteResults } from './CommandPalette';
import { Button } from '../Button';
const meta: Meta<typeof CommandPalette> = {
  parameters: { canvasInset: 'none' },
  title: 'Core/Navigation/CommandPalette',
  component: CommandPalette,
};
export default meta;
type Story = StoryObj<typeof CommandPalette>;
function Preview({ empty = false }: { empty?: boolean }) {
  const t = useStorybookText(),
    [opened, setOpened] = useState(true),
    [query, setQuery] = useState('');
  const items = [
    { id: 'posts', label: t('Posts'), href: '/my/posts' },
    { id: 'files', label: t('Files'), href: '/admin/files' },
    { id: 'settings', label: t('Settings'), href: '/my/settings' },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <Button onClick={() => setOpened(true)}>{t('Search')}</Button>
      <CommandPalette
        opened={opened}
        onClose={() => setOpened(false)}
        title={t('Search')}
        closeLabel={t('Close')}
        placeholder={t('Search')}
        query={query}
        onQueryChange={setQuery}
      >
        <CommandPaletteResults
          items={empty ? [] : items}
          label={t('Search results')}
          emptyLabel={t('No results found')}
        />
      </CommandPalette>
    </>
  );
}
export const Results: Story = { render: () => <Preview /> };
export const Empty: Story = { render: () => <Preview empty /> };
