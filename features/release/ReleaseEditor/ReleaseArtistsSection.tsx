'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { listArtistsAction } from '@/lib/actions/artist';
import { setReleaseArtistsAction } from '@/lib/actions/release';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import type { ReleaseArtistItem } from '@/lib/types/release/model';
import { ReleaseArtistsSectionView } from './ReleaseArtistsSectionView';

interface ReleaseArtistsSectionProps {
  releaseId: string;
  idPrefix?: string;
  artists: ReleaseArtistItem[];
  onArtistsChange: (artists: ReleaseArtistItem[]) => void;
  onMutationStart?: () => void;
  onMutationSettled?: (succeeded: boolean) => void;
}

export function ReleaseArtistsSection({
  releaseId,
  idPrefix,
  artists,
  onArtistsChange,
  onMutationStart,
  onMutationSettled,
}: ReleaseArtistsSectionProps) {
  const tCommon = useTranslations('common');
  const { data: options = [] } = useQuery({
    queryKey: ['artist', 'list'],
    queryFn: () => listArtistsAction(),
  });
  const setArtists = useMutation({
    mutationFn: ({
      nextArtists,
      orderIntent,
    }: {
      nextArtists: ReleaseArtistItem[];
      orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string };
    }) =>
      setReleaseArtistsAction(
        releaseId,
        nextArtists.map((artist, index) => ({ artistId: artist.artist_id, sortOrder: index })),
        artists.map((artist, index) => ({ artistId: artist.artist_id, sortOrder: index })),
        orderIntent,
      ),
    onMutate: () => onMutationStart?.(),
    onSettled: (result, error) => onMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.artists') }),
        color: 'green',
      });
    },
  });

  const handleChange = (
    nextArtists: ReleaseArtistItem[],
    orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
  ) => {
    onArtistsChange(nextArtists);
    setArtists.mutate({ nextArtists, orderIntent });
  };

  return <ReleaseArtistsSectionView idPrefix={idPrefix} artists={artists} options={options} onChange={handleChange} />;
}
