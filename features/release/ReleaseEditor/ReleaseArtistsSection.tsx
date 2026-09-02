'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { listArtistsAction } from '@/lib/actions/artist';
import { setReleaseArtistsAction } from '@/lib/actions/release';
import type { ReleaseArtistItem } from '@/lib/types/release/model';
import { ReleaseArtistsSectionView } from './ReleaseArtistsSectionView';

interface ReleaseArtistsSectionProps {
  releaseId: string;
  idPrefix?: string;
  artists: ReleaseArtistItem[];
  onArtistsChange: (artists: ReleaseArtistItem[]) => void;
}

export function ReleaseArtistsSection({ releaseId, idPrefix, artists, onArtistsChange }: ReleaseArtistsSectionProps) {
  const tCommon = useTranslations('common');
  const { data: options = [] } = useQuery({
    queryKey: ['artist', 'list'],
    queryFn: () => listArtistsAction(),
  });
  const setArtists = useMutation({
    mutationFn: (nextArtists: ReleaseArtistItem[]) =>
      setReleaseArtistsAction(
        releaseId,
        nextArtists.map((artist, index) => ({ artistId: artist.artist_id, sortOrder: index })),
      ),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.artists') }),
        color: 'green',
      });
    },
  });

  const handleChange = (nextArtists: ReleaseArtistItem[]) => {
    onArtistsChange(nextArtists);
    setArtists.mutate(nextArtists);
  };

  return <ReleaseArtistsSectionView idPrefix={idPrefix} artists={artists} options={options} onChange={handleChange} />;
}
