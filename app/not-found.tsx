import { getTranslations } from 'next-intl/server';
import { ErrorPageView } from '@/components/core/ErrorPage/ErrorPageView';

export default async function NotFound() {
  const t = await getTranslations('notFoundPage');
  return <ErrorPageView code="404" title={t('title')} description={t('description')} homeLabel={t('goHome')} />;
}
