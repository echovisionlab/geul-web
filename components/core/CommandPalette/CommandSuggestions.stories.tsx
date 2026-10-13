import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { CommandSuggestions } from './CommandSuggestions';
import { TextInput } from '../Input/TextInput';
import { IconFile, IconSettings } from '@tabler/icons-react';
function Preview({ density = 'comfortable' }: { density?: 'comfortable' | 'compact' }) {
  const t = useStorybookText();
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('files');
  const [selected, setSelected] = useState('');
  const items = [
    { id: 'files', label: t('Files'), description: t('Select files'), icon: <IconFile /> },
    { id: 'settings', label: t('Settings'), description: t('Account settings'), icon: <IconSettings /> },
  ].filter((item) => item.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const choose = (id: string) => setSelected(items.find((item) => item.id === id)?.label ?? '');
  return (
    <div style={{ position: 'relative', minHeight: 320, maxWidth: 480 }}>
      <TextInput
        ref={setInput}
        label={t('Search')}
        value={query}
        onChange={(event) => {
          setQuery(event.currentTarget.value);
          setActive('files');
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const index = items.findIndex((item) => item.id === active);
            setActive(items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.id ?? '');
          }
          if (event.key === 'Enter' && active) {
            event.preventDefault();
            choose(active);
          }
        }}
      />
      {input && items.length > 0 && (
        <CommandSuggestions
          id="commands-preview"
          label={t('Search results')}
          density={density}
          inputElement={input}
          position={{ left: 0, top: 72 }}
          items={items}
          activeId={active}
          onSelect={choose}
        />
      )}
      <output aria-live="polite">{selected}</output>
    </div>
  );
}
const meta = {
  parameters: { canvasInset: 'none' },
  title: 'Core/Navigation/CommandSuggestions',
  component: Preview,
} satisfies Meta<typeof Preview>;
export default meta;
export const Detailed: StoryObj<typeof meta> = {};
export const Compact: StoryObj<typeof meta> = { args: { density: 'compact' } };
