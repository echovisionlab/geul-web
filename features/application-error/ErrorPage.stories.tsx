import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/locale';
import { ApplicationErrorPage } from './ApplicationErrorPage';
import { RootErrorPageView } from './RootErrorPageView';

function ErrorPreview({
  kind = 'general',
  status,
}: {
  kind?: 'notFound' | 'general' | 'admin' | 'global';
  status?: number;
}) {
  const locale = normalizeLocale(useLocale()) ?? DEFAULT_LOCALE;
  const code = status ?? (kind === 'notFound' ? 404 : 500);
  if (kind === 'global') {
    return <RootErrorPageView status={code} locale={locale} onRetry={() => {}} />;
  }
  return (
    <ApplicationErrorPage
      status={code}
      locale={locale}
      homeHref={kind === 'admin' ? '/admin' : '/'}
      onRetry={() => {}}
      fullScreen
    />
  );
}

const meta: Meta<typeof ErrorPreview> = {
  title: 'Core/Feedback/ErrorPage',
  component: ErrorPreview,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    status: { control: 'select', options: [400, 401, 403, 404, 408, 409, 410, 413, 422, 429, 500, 501, 502, 503, 504] },
  },
};
export default meta;
type Story = StoryObj<typeof ErrorPreview>;
export const NotFound: Story = { args: { kind: 'notFound' } };
export const GeneralError: Story = { args: { kind: 'general' } };
export const AdminError: Story = { args: { kind: 'admin' } };
export const GlobalError: Story = { args: { kind: 'global' } };
export const BadRequest: Story = { args: { status: 400 } };
export const Unauthorized: Story = { args: { status: 401 } };
export const Forbidden: Story = { args: { status: 403 } };
export const RequestTimeout: Story = { args: { status: 408 } };
export const Conflict: Story = { args: { status: 409 } };
export const Gone: Story = { args: { status: 410 } };
export const PayloadTooLarge: Story = { args: { status: 413 } };
export const UnprocessableRequest: Story = { args: { status: 422 } };
export const TooManyRequests: Story = { args: { status: 429 } };
export const NotImplemented: Story = { args: { status: 501 } };
export const BadGateway: Story = { args: { status: 502 } };
export const ServiceUnavailable: Story = { args: { status: 503 } };
export const GatewayTimeout: Story = { args: { status: 504 } };
