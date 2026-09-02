'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconDots, IconEdit, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import type { FilterFieldConfig } from '@/features/data-table/DataTableMultiFilter';
import type { SortFieldConfig } from '@/features/data-table/DataTableMultiSort';
import { DataTableSelectableSection } from '@/features/data-table/DataTableSelectableSection';
import { IconButton } from '@/components/core/IconButton';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { ConfirmModal } from '@/components/core/Modal';
import { DateTime } from '@/features/date-time/DateTime';
import { TextButton } from '@/components/core/TextButton';
import { CreatePlaceModal, type CreatePlaceFormState } from '@/features/place/CreatePlaceModal';
import { deleteMapPlaceAction, listMapPlacesAdminAction } from '@/lib/actions/map-place';
import { createMapPlaceAction } from '@/lib/actions/map-place-create';
import type { ColumnDef } from '@/lib/types/common/data-table';
import type { PaginatedQuery } from '@/lib/types/common/query';
import { displayMapPlaceMemberNickname, type MapPlaceListItem } from '@/lib/types/map-place/model';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

export default function AdminMapPlacesPage() {
  const tCommon = useTranslations('common');
  const tAdmin = useTranslations('adminList');
  const tPlace = useTranslations('placeEditor');
  const tDataTable = useTranslations('dataTable');
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [query, setQuery] = useState<PaginatedQuery>({
    page: 1,
    pageSize: 20,
  });

  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['mapPlaces', 'admin', query],
    queryFn: () =>
      listMapPlacesAdminAction({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        search: query.search,
      }),
  });

  // Create modal
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);

  // Delete modal
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deletingPlace, setDeletingPlace] = useState<MapPlaceListItem | null>(null);

  const filterFields: FilterFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name'), type: 'string' },
    { field: 'address', label: tCommon('labels.address'), type: 'string' },
    { field: 'created_at', label: tCommon('labels.created'), type: 'date' },
  ];

  const sortFields: SortFieldConfig[] = [
    { field: 'name', label: tCommon('labels.name') },
    { field: 'created_at', label: tCommon('labels.created') },
  ];

  const createPlace = useMutation({
    mutationFn: createMapPlaceAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tAdmin('mapPlaces.created'),
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['mapPlaces'] });
      if (result.data) {
        const href = `/admin/map/places/${result.data.id}`;
        startNavigation(() => {
          router.push(href);
        });
      }
    },
  });

  const deletePlace = useMutation({
    mutationFn: (id: string) => deleteMapPlaceAction(id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tPlace('notifications.deleted'),
        color: 'red',
      });
      queryClient.invalidateQueries({ queryKey: ['mapPlaces'] });
      closeDeleteModal();
    },
  });

  const handleCreatePlace = useCallback(
    (data: CreatePlaceFormState) => {
      createPlace.mutate({
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
        google_place_id: data.googlePlaceId,
        address_components: data.addressComponents ?? undefined,
      });
    },
    [createPlace],
  );

  const handleDelete = useCallback(
    (place: MapPlaceListItem) => {
      setDeletingPlace(place);
      openDeleteModal();
    },
    [openDeleteModal],
  );

  useEffect(() => {
    if (!deleteModalOpened) {
      setDeletingPlace(null);
    }
  }, [deleteModalOpened]);

  const columns: ColumnDef<MapPlaceListItem>[] = [
    {
      key: 'name',
      header: tCommon('labels.name'),
      cell: (row) => (
        <div>
          <Text size="sm" fw={500}>
            {row.name}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.address}
          </Text>
        </div>
      ),
    },
    {
      key: 'location',
      header: tCommon('labels.location'),
      width: 200,
      cell: (row) => {
        const ac = row.address_components;
        if (!ac) {
          return (
            <Text size="sm" c="dimmed">
              {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
            </Text>
          );
        }
        const parts = Array.from(new Set([ac.city, ac.country].flatMap((part) => (part ? [part] : []))));
        return (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {parts.length > 0 ? parts.join(', ') : `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`}
          </Text>
        );
      },
    },
    {
      key: 'created_by_member_id',
      header: tCommon('labels.createdBy'),
      width: 180,
      cell: (row) => {
        const member = row.created_by_member;
        const nickname = displayMapPlaceMemberNickname(member);

        if (!member) {
          return (
            <Text size="xs" c="dimmed">
              {nickname}
            </Text>
          );
        }

        return (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
              {nickname.charAt(0).toUpperCase()}
            </Avatar>
            <Stack gap={0}>
              <TextButton href={`/admin/users/${member.id}`} size="sm" weight="medium" appearance="accent">
                {nickname}
              </TextButton>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {member.id}
              </Text>
            </Stack>
          </Group>
        );
      },
    },
    {
      key: 'updated_by_member_id',
      header: tCommon('labels.updatedBy'),
      width: 180,
      cell: (row) => {
        const member = row.updated_by_member;
        const nickname = displayMapPlaceMemberNickname(member);

        if (!member) {
          return (
            <Text size="xs" c="dimmed">
              {nickname}
            </Text>
          );
        }

        return (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={buildManagedImageUrl(member.avatarUrl, MANAGED_IMAGE_PRESET.AVATAR_SM)} size="sm" radius="xl">
              {nickname.charAt(0).toUpperCase()}
            </Avatar>
            <Stack gap={0}>
              <TextButton href={`/admin/users/${member.id}`} size="sm" weight="medium" appearance="accent">
                {nickname}
              </TextButton>
              <Text size="xs" c="dimmed" lineClamp={1}>
                {member.id}
              </Text>
            </Stack>
          </Group>
        );
      },
    },
    {
      key: 'created_at',
      header: tCommon('labels.created'),
      width: 100,
      cell: (row) => (
        <Text size="xs" c="dimmed">
          <DateTime value={row.created_at} />
        </Text>
      ),
    },
    {
      key: 'actions',
      kind: 'action',
      header: '',
      width: 50,
      cell: (row) => (
        <DropdownMenu size="compact" placement="bottom-end">
          <DropdownMenu.Target>
            <IconButton
              emphasis="low"
              size="sm"
              aria-label={tDataTable('aria.rowActions', { label: row.name })}
              onClick={(e) => e.stopPropagation()}
            >
              <IconDots size={16} />
            </IconButton>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item component={Link} href={`/admin/map/places/${row.id}`} icon={<IconEdit size={16} />}>
              {tCommon('actions.edit')}
            </DropdownMenu.Item>
            <DropdownMenu.Divider />
            <DropdownMenu.Item
              icon={<IconTrash size={16} />}
              tone="danger"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
            >
              {tCommon('actions.delete')}
            </DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title={tCommon('entities.mapPlaces')}
        items={[
          {
            key: 'create-map-place',
            type: 'action',
            label: tCommon('actions.newItem', { item: tCommon('entities.mapPlace') }),
            icon: <IconPlus size={16} />,
            onClick: openCreateModal,
          },
        ]}
      />

      <DataTableSelectableSection
        columns={columns}
        result={data}
        loading={isLoading}
        query={query}
        getRowKey={(row) => row.id}
        rowAction={{
          getHref: (row) => `/admin/map/places/${row.id}`,
          onActivate: (row) => router.push(`/admin/map/places/${row.id}`),
          getAccessibleLabel: (row) => row.name || row.address || row.id,
        }}
        onQueryChange={setQuery}
        emptyMessage={tAdmin('mapPlaces.empty')}
        searchPlaceholder={tCommon('actions.searchItems', {
          items: tCommon('entities.mapPlaces').toLowerCase(),
        })}
        filterFields={filterFields}
        sortFields={sortFields}
        bulkDelete={{
          entityLabel: tCommon('entities.mapPlaces'),
          deleteAction: deleteMapPlaceAction,
          getRowLabel: (row) => row.name || row.address || row.id,
          successMessage: tPlace('notifications.deleted'),
          onSuccess: async () => {
            queryClient.invalidateQueries({ queryKey: ['mapPlaces'] });
          },
        }}
      />

      {/* Create Modal */}
      <CreatePlaceModal
        opened={createModalOpened}
        onClose={closeCreateModal}
        onSubmit={handleCreatePlace}
        isPending={createPlace.isPending || isNavigating}
      />

      {/* Delete Modal */}
      <ConfirmModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        onConfirm={() => deletingPlace && deletePlace.mutate(deletingPlace.id)}
        title={tPlace('deleteModal.title')}
        message={
          <Stack gap="xs">
            <Text>
              {tCommon.rich('messages.confirmDeleteNamedRich', {
                name: deletingPlace?.name || deletingPlace?.address || tCommon('entities.mapPlace'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            <Text size="sm" c="orange">
              {tAdmin('mapPlaces.deleteWarning')}
            </Text>
          </Stack>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deletePlace.isPending}
      />
    </>
  );
}
