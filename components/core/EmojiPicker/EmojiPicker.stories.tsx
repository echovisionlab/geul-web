import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { EmojiPickerPanel, type EmojiPickerDensity, type EmojiPickerItem } from './EmojiPicker';
import { LayoutContainer, LayoutStack } from '../Layout';
import { Text } from '../Typography';
const emojis: EmojiPickerItem[] = [
  ['smile', '😀'],
  ['laugh', '😂'],
  ['wink', '😉'],
  ['love', '🥰'],
  ['think', '🤔'],
  ['cool', '😎'],
  ['wave', '👋'],
  ['clap', '👏'],
  ['thumbsup', '👍'],
  ['muscle', '💪'],
  ['heart', '❤️'],
  ['sparkles', '✨'],
  ['fire', '🔥'],
  ['star', '⭐'],
  ['rocket', '🚀'],
  ['bulb', '💡'],
  ['warning', '⚠️'],
  ['music', '🎵'],
  ['flower', '🌸'],
  ['tree', '🌳'],
  ['moon', '🌙'],
  ['sun', '☀️'],
  ['coffee', '☕'],
  ['book', '📖'],
].map(([id, value]) => ({ id: id!, label: `:${id}:`, value: value! }));
function Preview({ density = 'standard', initialQuery = '' }: { density?: EmojiPickerDensity; initialQuery?: string }) {
  const t = useStorybookText();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState('');
  return (
    <LayoutContainer size="compact">
      <LayoutStack gap="sm">
        <EmojiPickerPanel
          density={density}
          title={t('Emoji')}
          searchPlaceholder={t('Search')}
          noResults={t('No results')}
          query={query}
          items={emojis.filter((item) => item.label.includes(query.toLowerCase()))}
          onQueryChange={setQuery}
          onSelect={(item) => setSelected(item.value)}
        />
        <Text aria-live="polite">{selected}</Text>
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  parameters: { canvasInset: 'none' },
  title: 'Core/Input/EmojiPicker',
  component: Preview,
} satisfies Meta<typeof Preview>;
export default meta;
export const Standard: StoryObj<typeof meta> = { args: { density: 'standard' } };
export const Compact: StoryObj<typeof meta> = { args: { density: 'compact' } };
export const Sparse: StoryObj<typeof meta> = { args: { density: 'compact', initialQuery: 'rocket' } };

export const EmptyResultsRecovery: StoryObj<typeof meta> = {
  tags: ['a11y-smoke'],
  args: { initialQuery: 'missing' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('status')).toBeInTheDocument();
    const search = canvas.getByRole('textbox');
    await userEvent.clear(search);
    await userEvent.type(search, 'rocket');
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
    await expect(canvas.getByRole('option', { name: ':rocket:' })).toBeInTheDocument();
    await expect(search).toHaveFocus();
  },
};
