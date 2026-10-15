'use client';
import { useReleaseEditorCanEdit } from './ReleaseEditorAccessContext';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
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
  onMutationStart?: () => string | void;
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
  const canEdit = useReleaseEditorCanEdit();
  const tCommon = useTranslations('common');
  const optionsQuery = useQuery({
    queryKey: ['artist', 'list'],
    queryFn: () => listArtistsAction().then(unwrapQueryResult),
  });
  const { data: options = [] } = optionsQuery;
  const setArtists = useMutation({
    mutationFn: async ({
      nextArtists,
      orderIntent,
    }: {
      nextArtists: ReleaseArtistItem[];
      orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string };
    }) => {
      const editorOrigin = onMutationStart?.() ?? undefined;
      return {
        ...(await setReleaseArtistsAction(
          releaseId,
          nextArtists.map((artist, index) => ({ artistId: artist.artist_id, sortOrder: index })),
          artists.map((artist, index) => ({ artistId: artist.artist_id, sortOrder: index })),
          orderIntent,
          editorOrigin,
        )),
        editorOrigin,
      };
    },
    onSettled: (result, error) => onMutationSettled?.(!error && !result?.error),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      publishEditorEntityChange(`release:${releaseId}`, result.editorOrigin);
      notifications.show({
        message: tCommon('messages.itemUpdated', { item: tCommon('entities.artists') }),
        tone: 'positive',
      });
    },
  });

  const handleChange = (
    nextArtists: ReleaseArtistItem[],
    orderIntent?: { itemId: string; previousItemId?: string; nextItemId?: string },
  ) => {
    if (!canEdit) {
      return;
    }
    onArtistsChange(nextArtists);
    setArtists.mutate({ nextArtists, orderIntent });
  };

  return (
    <>
      <QueryErrorAlert queries={[optionsQuery]} />
      <ReleaseArtistsSectionView idPrefix={idPrefix} artists={artists} options={options} onChange={handleChange} />
    </>
  );
}
