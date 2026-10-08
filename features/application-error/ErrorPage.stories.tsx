import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { ErrorPageView } from '@/components/core/ErrorPage/ErrorPageView';
import { RootErrorPageView } from './RootErrorPageView';

function ErrorPreview({ kind = 'general' }: { kind?: 'notFound' | 'general' | 'admin' | 'global' }) {
  const t = useTranslations(kind === 'notFound' ? 'notFoundPage' : 'generalError');
  const actions = useTranslations('common.actions');
  return (
    <ErrorPageView
      code={kind === 'notFound' ? '404' : undefined}
      title={t('title')}
      description={t('description')}
      homeLabel={t(kind === 'notFound' ? 'goHome' : 'actions.goHome')}
      homeHref={kind === 'admin' ? '/admin' : '/'}
      retryLabel={kind === 'notFound' ? undefined : actions('tryAgain')}
      onRetry={kind === 'notFound' ? undefined : () => {}}
      fullScreen
    />
  );
}

const meta: Meta<typeof ErrorPreview> = {
  title: 'Core/Feedback/ErrorPage',
  component: ErrorPreview,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof ErrorPreview>;
export const NotFound: Story = { args: { kind: 'notFound' } };
export const GeneralError: Story = { args: { kind: 'general' } };
export const AdminError: Story = { args: { kind: 'admin' } };
export const GlobalError: Story = {
  render: (_args, context) => (
    <RootErrorPageView locale={normalizeLocale(context.globals.locale) ?? DEFAULT_LOCALE} onRetry={() => {}} />
  ),
};
