import type { Meta, StoryObj } from '@storybook/nextjs';
import { useLocale } from 'next-intl';
import { ApplicationErrorPage } from '@/features/application-error/ApplicationErrorPage';
import { RootErrorPageView } from '@/features/application-error/RootErrorPageView';
import { normalizeLocale } from '@/lib/i18n/locale';
import { navigatePreview } from '../shared/preview-navigation';
function BoundaryPagePreview({ status = 500, root = false }: { status?: number; root?: boolean }) {
  const locale = normalizeLocale(useLocale()) ?? 'en';
  const handleRetry = () => {
    navigatePreview('/');
  };
  return root ? (
    <RootErrorPageView status={status} locale={locale} onRetry={handleRetry} />
  ) : (
    <ApplicationErrorPage status={status} onRetry={handleRetry} />
  );
}

const meta = {
  title: 'Pages/Application/Boundaries',
  component: BoundaryPagePreview,
  args: { status: 500, root: false },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Actual ApplicationErrorPage/RootErrorPageView used by general/admin/root error and not-found entries. Retry opens the mapped homepage preview. Does not throw into Next error boundaries, report telemetry, replace html/body or validate request status mapping.',
      },
    },
  },
} satisfies Meta<typeof BoundaryPagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ServerError: Story = {};
export const NotFound: Story = { args: { status: 404 } };
export const Unauthorized: Story = { args: { status: 401 } };
export const Forbidden: Story = { args: { status: 403 } };
export const RootFallback: Story = { args: { root: true } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
