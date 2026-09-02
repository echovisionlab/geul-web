import { getTranslations } from 'next-intl/server';
import { TextButton } from '@/components/core/TextButton';

export default async function NotFound() {
  const t = await getTranslations('notFoundPage');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '6rem', margin: 0, color: '#888' }}>404</h1>
      <h2 style={{ marginTop: '1rem' }}>{t('title')}</h2>
      <p style={{ color: '#666' }}>{t('description')}</p>
      <TextButton href="/" appearance="accent" size="md" style={{ marginTop: '1rem' }}>
        {t('goHome')}
      </TextButton>
    </div>
  );
}
