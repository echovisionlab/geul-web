import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@mantine/core';
import { getTranslations } from 'next-intl/server';
import { YoutubeAudioTool } from '@/features/tools/youtube-audio/YoutubeAudioTool';
import { withNoIndex } from '@/lib/utils/route-metadata';
import { getSession } from '@/lib/utils/session.server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  if (!session?.user) {
    return withNoIndex({});
  }
  const t = await getTranslations('tools.youtubeAudio');
  return withNoIndex({ title: t('metadataTitle'), description: t('metadataDescription') });
}

export default async function YoutubeAudioPage() {
  const session = await getSession();
  if (!session?.user) {
    notFound();
  }

  return (
    <Container size="lg" w="100%" px={0} py="xl" data-youtube-audio-page>
      <YoutubeAudioTool />
    </Container>
  );
}
