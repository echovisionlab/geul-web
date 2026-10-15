import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { publicAccessibilityLabels } from '@/stories/shared/public-accessibility';
import { SocialLinksEditor } from '../SocialLinksEditor';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { LayoutStack } from '@/components/core/Layout';
import { Code } from '@/components/core/Typography';
function Preview({ width = 620, disabled = false }: { width?: number; disabled?: boolean }) {
  const [links, setLinks] = useState<SocialLinks>({
    github: 'https://github.com/monome',
    instagram: 'https://instagram.com/example',
  });
  return (
    <div style={{ width, maxWidth: '100%' }}>
      <LayoutStack gap="md">
        <SocialLinksEditor value={links} onChange={setLinks} disabled={disabled} />
        <Code block wrap="anywhere">
          {JSON.stringify(links, null, 2)}
        </Code>
      </LayoutStack>
    </div>
  );
}
const meta = {
  title: 'Feature/Social Links/Editor',
  component: Preview,
  args: { width: 620 },
  parameters: { canvasInset: 'none', layout: 'padded' },
} satisfies Meta<typeof Preview>;
export default meta;
export const Desktop: StoryObj<typeof meta> = {};
export const Narrow: StoryObj<typeof meta> = { args: { width: 320 } };
export const DisabledNarrow: StoryObj<typeof meta> = { args: { width: 320, disabled: true } };
export const NarrowPlatformSelection: StoryObj<typeof meta> = {
  args: { width: 320 },
  tags: ['a11y-public'],
  play: async ({ canvasElement, globals }) => {
    const t = await publicAccessibilityLabels(globals);
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: `${t('socialLinks.platformPlaceholder')}: GitHub` });
    await expect(trigger).toHaveTextContent('');
    await expect(canvas.queryAllByRole('combobox')).toHaveLength(0);
    const url = canvas.getByRole('textbox', { name: `GitHub: ${t('socialLinks.valuePlaceholder')}` });
    await expect(url.getBoundingClientRect().width).toBeGreaterThan(trigger.getBoundingClientRect().width);
    await userEvent.click(trigger);
    const dialog = await within(document.body).findByRole('dialog', {
      name: `${t('socialLinks.platformPlaceholder')}: GitHub`,
    });
    const search = within(dialog).getByRole('combobox', { name: t('socialLinks.platformPlaceholder') });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.clear(search);
    await userEvent.type(search, 'Bandcamp');
    const option = await within(document.body).findByRole('option', { name: 'Bandcamp' });
    await userEvent.click(option);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await expect(trigger).toHaveAccessibleName(`${t('socialLinks.platformPlaceholder')}: Bandcamp`);
    await expect(canvas.getByRole('textbox', { name: `Bandcamp: ${t('socialLinks.valuePlaceholder')}` })).toHaveValue(
      'https://github.com/monome',
    );
  },
};
