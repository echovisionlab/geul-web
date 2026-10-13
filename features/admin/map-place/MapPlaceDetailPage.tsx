'use client';

import { Text as DsText } from '@/components/core/Typography';
import { MetadataPair } from '@/components/core/PublicMetadata';
import { LayoutInline as DsLayoutInline, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/core/Display';
import { notifications } from '@/components/core/Notification';
import { PageLoader } from '@/features/site/PageLoader';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { PlaceEditor } from '@/features/place/PlaceEditor';
import { deleteMapPlaceAction, getMapPlaceAction, updateMapPlaceAction } from '@/lib/actions/map-place';
import {
  displayMapPlaceMemberNickname,
  type MapPlaceMemberSummary,
  type PlaceEditorFormState,
} from '@/lib/types/map-place/model';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { guardNotFound } from '@/lib/utils/not-found-guard';

function MemberSummaryView({ label, member }: { label: string; member: MapPlaceMemberSummary | null | undefined }) {
  const nickname = displayMapPlaceMemberNickname(member);
  const memberHref = member?.id ? `/admin/users/${member.id}` : null;

  return (
    <MetadataPair label={label} layout="stacked">
      {member ? (
        <DsLayoutInline gap="xs" wrap="nowrap">
          <Avatar
            src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)}
            size="sm"
            shape="circle"
            name={nickname}
          />
          <DsLayoutStack gap="none">
            {memberHref ? (
              <TextButton href={memberHref} size="sm" weight="medium" appearance="accent">
                {nickname}
              </TextButton>
            ) : (
              <DsText size="sm" weight="medium">
                {nickname}
              </DsText>
            )}
            <DsText size="sm" tone="secondary" font="mono">
              {member.id}
            </DsText>
          </DsLayoutStack>
        </DsLayoutInline>
      ) : (
        <DsText size="sm">{nickname}</DsText>
      )}
    </MetadataPair>
  );
}

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
export interface EditPlacePageBindings {
  getMapPlaceAction: typeof getMapPlaceAction;
  updateMapPlaceAction: typeof updateMapPlaceAction;
  deleteMapPlaceAction: typeof deleteMapPlaceAction;
}
const defaultBindings: EditPlacePageBindings = { getMapPlaceAction, updateMapPlaceAction, deleteMapPlaceAction };
export default function EditPlacePage({
  id,
  bindings = defaultBindings,
  navigate,
  localOnly = false,
}: {
  localOnly?: boolean;
  id: string;
  bindings?: EditPlacePageBindings;
  navigate?: (href: string) => void;
}) {
  const tCommon = useTranslations('common');
  const tPlace = useTranslations('placeEditor');
  const router = useRouter();

  const queryClient = useQueryClient();

  const placeQuery = useQuery({
    queryKey: ['mapPlaces', 'detail', id],
    queryFn: () => bindings.getMapPlaceAction(id),
  });

  const { data: place, isLoading } = placeQuery;

  const updatePlace = useMutation({
    mutationFn: (data: { id: string; updates: Partial<PlaceEditorFormState> }) =>
      bindings.updateMapPlaceAction(data.id, {
        name: data.updates.name,
        address: data.updates.address,
        lat: data.updates.lat,
        lng: data.updates.lng,
        google_place_id: data.updates.googlePlaceId,
        address_components: data.updates.addressComponents,
      }),
  });

  const deletePlace = useMutation({
    mutationFn: (data: { id: string }) => bindings.deleteMapPlaceAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPlace('notifications.deleted'), tone: 'positive' });
      (navigate ?? router.push)('/admin/map/places');
    },
  });

  const handleSubmit = useCallback(
    async (updates: Partial<PlaceEditorFormState>) => {
      try {
        const result = await updatePlace.mutateAsync({ id, updates });
        if (result.error) {
          notifications.show({ message: result.error, tone: 'danger' });
          return false;
        }
        notifications.show({ message: tPlace('notifications.saved'), tone: 'positive' });
        void queryClient.invalidateQueries({ queryKey: ['mapPlaces'] });
        return true;
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommon('notifications.saveFailed'),
          tone: 'danger',
        });
        return false;
      }
    },
    [id, queryClient, tCommon, tPlace, updatePlace],
  );

  const handleDelete = useCallback(() => {
    deletePlace.mutate({ id });
  }, [id, deletePlace]);

  const handleBack = useCallback(() => {
    (navigate ?? router.push)('/admin/map/places');
  }, [router]);

  if (placeQuery.isError) {
    return <QueryErrorAlert queries={[placeQuery]} />;
  }

  if (isLoading) {
    return <PageLoader />;
  }

  guardNotFound(place);

  const initialData: PlaceEditorFormState = {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    googlePlaceId: place.googlePlaceId,
    addressComponents: place.addressComponents,
  };

  const metadata = (
    <DsLayoutStack gap="xs">
      <MetadataPair label={tCommon('labels.created')} layout="stacked">
        <DsText size="sm">
          <DateTime value={place.createdAt} display="dateTime" />
        </DsText>
      </MetadataPair>
      <MetadataPair label={tCommon('labels.updated')} layout="stacked">
        <DsText size="sm">
          <DateTime value={place.updatedAt} display="dateTime" />
        </DsText>
      </MetadataPair>
      <MemberSummaryView label={tCommon('labels.createdBy')} member={place.createdByMember} />
      <MemberSummaryView label={tCommon('labels.updatedBy')} member={place.updatedByMember} />
    </DsLayoutStack>
  );

  return (
    <PlaceEditor
      localOnly={localOnly}
      key={id}
      initialData={initialData}
      metadata={metadata}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      onBack={handleBack}
      title={place.name || tPlace('title')}
      submitLabel={tCommon('actions.save')}
      isSubmitting={updatePlace.isPending}
      isDeleting={deletePlace.isPending}
    />
  );
}
