import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';
import { ApplicationErrorPageView } from './ApplicationErrorPage';
import { getFallbackErrorPageMessages } from './error-page-fallback-messages';

export function RootErrorPageView({
  status = 500,
  locale = DEFAULT_LOCALE,
  onRetry,
}: {
  status?: number;
  locale?: SupportedLocale;
  onRetry: () => void;
}) {
  return (
    <ApplicationErrorPageView
      status={status}
      messages={getFallbackErrorPageMessages(locale)}
      onRetry={onRetry}
      fullScreen
    />
  );
}
