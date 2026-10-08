import messages from '@/lib/i18n/error-messages.json';
import { DEFAULT_LOCALE, type SupportedLocale } from '@/lib/i18n/locale';
import { ErrorPageView } from '@/components/core/ErrorPage/ErrorPageView';

export function RootErrorPageView({
  locale = DEFAULT_LOCALE,
  onRetry,
}: {
  locale?: SupportedLocale;
  onRetry: () => void;
}) {
  const t = messages[locale];
  return (
    <ErrorPageView
      title={t.title}
      description={t.description}
      homeLabel={t.actions.goHome}
      retryLabel={t.tryAgain}
      onRetry={onRetry}
      fullScreen
    />
  );
}
