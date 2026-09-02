'use client';

import { use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PageLoader } from '@/features/site/PageLoader';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { PlaceEditor } from '@/features/place/PlaceEditor';
import { deleteMapPlaceAction, getMapPlaceAction, updateMapPlaceAction } from '@/lib/actions/map-place';
import {
  displayMapPlaceMemberNickname,
  type AddressComponents,
  type MapPlaceMemberSummary,
  type PlaceEditorFormState,
} from '@/lib/types/map-place/model';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { guardNotFound } from '@/lib/utils/not-found-guard';

interface PageProps {
  params: Promise<{ id: string }>;
}

function MemberSummaryView({ label, member }: { label: string; member: MapPlaceMemberSummary | null | undefined }) {
  const nickname = displayMapPlaceMemberNickname(member);
  const memberHref = member?.id ? `/admin/users/${member.id}` : null;

  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      {member ? (
        <Group gap="xs" wrap="nowrap">
          <Avatar src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
            {nickname.charAt(0).toUpperCase()}
          </Avatar>
          <Stack gap={0}>
            {memberHref ? (
              <TextButton href={memberHref} size="sm" weight="medium" appearance="accent">
                {nickname}
              </TextButton>
            ) : (
              <Text size="sm" fw={500}>
                {nickname}
              </Text>
            )}
            <Text size="xs" c="dimmed" ff="monospace">
              {member.id}
            </Text>
          </Stack>
        </Group>
      ) : (
        <Text size="sm">{nickname}</Text>
      )}
    </div>
  );
}

export default function EditPlacePage({ params }: PageProps) {
  const tCommon = useTranslations('common');
  const tPlace = useTranslations('placeEditor');
  const { id } = use(params);
  const router = useRouter();

  const queryClient = useQueryClient();

  const { data: place, isLoading } = useQuery({
    queryKey: ['mapPlaces', 'detail', id],
    queryFn: () => getMapPlaceAction(id),
  });

  const updatePlace = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      googlePlaceId: string | null;
      addressComponents: AddressComponents | null;
    }) =>
      updateMapPlaceAction(data.id, {
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.googlePlaceId,
        address_components: data.addressComponents,
      }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPlace('notifications.saved'), color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['mapPlaces'] });
    },
  });

  const deletePlace = useMutation({
    mutationFn: (data: { id: string }) => deleteMapPlaceAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPlace('notifications.deleted'), color: 'red' });
      router.push('/admin/map/places');
    },
  });

  const handleSubmit = useCallback(
    (data: PlaceEditorFormState) => {
      updatePlace.mutate({
        id,
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        googlePlaceId: data.googlePlaceId,
        addressComponents: data.addressComponents,
      });
    },
    [id, updatePlace],
  );

  const handleDelete = useCallback(() => {
    deletePlace.mutate({ id });
  }, [id, deletePlace]);

  const handleBack = useCallback(() => {
    router.push('/admin/map/places');
  }, [router]);

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
    <Stack gap={8}>
      <div>
        <Text size="xs" c="dimmed">
          {tCommon('labels.created')}
        </Text>
        <Text size="sm">
          <DateTime value={place.createdAt} display="dateTime" />
        </Text>
      </div>
      <div>
        <Text size="xs" c="dimmed">
          {tCommon('labels.updated')}
        </Text>
        <Text size="sm">
          <DateTime value={place.updatedAt} display="dateTime" />
        </Text>
      </div>
      <MemberSummaryView label={tCommon('labels.createdBy')} member={place.createdByMember} />
      <MemberSummaryView label={tCommon('labels.updatedBy')} member={place.updatedByMember} />
    </Stack>
  );

  return (
    <PlaceEditor
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
