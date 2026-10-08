import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';
import { ApplicationErrorPage } from './ApplicationErrorPage';

export function RootErrorPageView({
  status = 500,
  locale = DEFAULT_LOCALE,
  onRetry,
}: {
  status?: number;
  locale?: SupportedLocale;
  onRetry: () => void;
}) {
  return <ApplicationErrorPage status={status} locale={locale} onRetry={onRetry} fullScreen />;
}
