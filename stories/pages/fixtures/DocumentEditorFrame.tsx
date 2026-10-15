import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { useTranslations } from 'next-intl';
import { goBackPreview } from '../../shared/preview-navigation';
import type { ReactNode } from 'react';
import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
export function DocumentEditorFrame({
  client,
  children,
  completed = false,
}: {
  client: QueryClient;
  children: ReactNode;
  completed?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <QueryClientProvider client={client}>
      <MapPlaceActionProvider
        createMapPlaceForBlock={async (data) => ({ id: `local-place-${Date.now()}`, lat: data.lat, lng: data.lng })}
      >
        <LayoutContainer size="wide" inset="md">
          {completed ? (
            <Alert tone="positive" role="status">
              {t('messages.itemDeleted', { item: t('labels.title') })}{' '}
              <Button onClick={goBackPreview}>{t('actions.back')}</Button>
            </Alert>
          ) : (
            children
          )}
        </LayoutContainer>
      </MapPlaceActionProvider>
    </QueryClientProvider>
  );
}
export const editorPageParameters = {
  layout: 'fullscreen',
  nextjs: { appDirectory: true },
  docs: {
    description: {
      component:
        'Complete production editor view, using the canonical codec and real editor controller with a disconnected in-memory room. Title, summary, slug, options, locale and body changes stay local. Local save, delete and mapped navigation controls are connected. Panels requiring unavailable upload, relation, sharing or translation services are omitted by the Storybook availability provider.',
    },
  },
};

export const editorStateArgTypes = {
  state: { control: 'select' as const, options: ['ready', 'disconnected', 'readonly'] },
};
