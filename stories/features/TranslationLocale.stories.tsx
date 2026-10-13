import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutContainer } from '@/components/core/Layout';
import { TranslationLocaleControl } from '@/features/translation/TranslationLocaleControl';
function LocalePreview({
  variant = 'menu',
  disabled = false,
  unavailable = false,
}: {
  variant?: 'menu' | 'select' | 'native-select';
  disabled?: boolean;
  unavailable?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('common.labels');
  const [value, setValue] = useState<string | null>(unavailable ? 'de' : 'en');
  const names = new Intl.DisplayNames([locale], { type: 'language' });
  const shared = {
    options: ['en', 'ko', 'ja'].map((code) => ({ value: code, label: names.of(code) ?? code })),
    sourceLocale: 'en',
    value,
    onChange: setValue,
    disabled,
    fallbackLabel: unavailable ? names.of('de') : undefined,
  };
  return (
    <LayoutContainer size="compact" inset="md">
      {variant === 'menu' ? (
        <TranslationLocaleControl {...shared} variant="menu" buttonAriaLabel={t('language')} />
      ) : (
        <TranslationLocaleControl {...shared} variant={variant} label={t('language')} />
      )}
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/Translation/Locale Control',
  component: LocalePreview,
  args: { variant: 'menu', disabled: false, unavailable: false },
  parameters: {
    docs: {
      description: {
        component:
          'Production source/translation locale control with local controlled selection, select/native/menu variants and unavailable fallback. No translation query or editor collaboration.',
      },
    },
  },
} satisfies Meta<typeof LocalePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Menu: Story = {};
export const Select: Story = { args: { variant: 'select' } };
export const Native: Story = { args: { variant: 'native-select' } };
export const Unavailable: Story = { args: { unavailable: true } };
export const Disabled: Story = { args: { disabled: true } };
