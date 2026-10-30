import { useState } from 'react';
import { navigatePreview } from '../shared/preview-navigation';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutContainer } from '@/components/core/Layout';
import MapPlacesPage, { type AdminMapPlacesPageBindings } from '@/features/admin/map-place/MapPlacesPage';
import MapPlaceDetailPage, { type EditPlacePageBindings } from '@/features/admin/map-place/MapPlaceDetailPage';
import { pageRows } from './fixtures/paginated';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
type State = 'ready' | 'empty' | 'failed' | 'pending' | 'action-failed';
const date = new Date('2026-10-01T00:00:00Z');
function fixture(state: State): { list: AdminMapPlacesPageBindings; detail: EditPlacePageBindings } {
  const member = { id: 'local-member', nickname: 'June Han', avatarUrl: null, deleted: false };
  let places: Extract<
    Awaited<ReturnType<AdminMapPlacesPageBindings['listMapPlacesAdminAction']>>,
    { ok: true }
  >['value']['data'] =
    state === 'empty'
      ? []
      : [
          {
            id: 'local-place',
            name: 'Listening room',
            address: 'Seoul, South Korea',
            lat: 37.5665,
            lng: 126.978,
            google_place_id: null,
            address_components: null,
            image_file_id: null,
            created_by_member_id: member.id,
            updated_by_member_id: member.id,
            created_by_member: member,
            updated_by_member: member,
            created_at: date,
            updated_at: date,
          },
        ];
  const deleteMapPlaceAction: EditPlacePageBindings['deleteMapPlaceAction'] = async (id) => {
    if (state === 'action-failed') {
      return actionFailure('Local deletion failed', 'ACTION_FAILED');
    }
    places = places.filter((p) => p.id !== id);
    return actionSuccess({ success: true as const });
  };
  return {
    list: {
      listMapPlacesAdminAction: async (query) => {
        if (state === 'pending') {
          return new Promise(() => {});
        }
        if (state === 'failed') {
          return { ok: false, status: 500, error: 'Local place lookup failed' };
        }
        return { ok: true, value: pageRows(places, query, (p) => `${p.name} ${p.address}`) };
      },
      createMapPlaceAction: async (data) => {
        if (state === 'action-failed') {
          return actionFailure('Local creation failed', 'ACTION_FAILED');
        }
        const id = `local-place-${crypto.randomUUID()}`;
        places = [
          ...places,
          {
            id,
            name: data.name,
            address: data.address,
            lat: data.lat,
            lng: data.lng,
            google_place_id: data.google_place_id ?? null,
            address_components: data.address_components
              ? {
                  street: data.address_components.street,
                  city: data.address_components.city,
                  region: data.address_components.region,
                  country: data.address_components.country,
                  postalCode: data.address_components.postalCode,
                }
              : null,
            image_file_id: data.image_file_id ?? null,
            created_by_member_id: member.id,
            updated_by_member_id: member.id,
            created_by_member: member,
            updated_by_member: member,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ];
        return actionSuccess({ data: { id } });
      },
      deleteMapPlaceAction,
    },
    detail: {
      getMapPlaceAction: async (id) => {
        if (state === 'pending') {
          return new Promise(() => {});
        }
        if (state === 'failed') {
          throw new Error('Local place lookup failed');
        }
        const p = places.find((p) => p.id === id);
        return p
          ? {
              id: p.id,
              name: p.name,
              address: p.address,
              lat: p.lat,
              lng: p.lng,
              googlePlaceId: null,
              addressComponents: null,
              imageFileId: null,
              imageUrl: null,
              createdByMemberId: member.id,
              updatedByMemberId: member.id,
              createdByMember: member,
              updatedByMember: member,
              createdAt: date,
              updatedAt: date,
            }
          : null;
      },
      updateMapPlaceAction: async (id, patch) => {
        if (state === 'action-failed') {
          return actionFailure('Local update failed', 'ACTION_FAILED');
        }
        places = places.map((p) =>
          p.id === id
            ? {
                ...p,
                name: patch.name ?? p.name,
                address: patch.address ?? p.address,
                lat: patch.lat ?? p.lat,
                lng: patch.lng ?? p.lng,
              }
            : p,
        );
        return actionSuccess({ success: true as const });
      },
      deleteMapPlaceAction,
    },
  };
}
export function MapPlacesPreview({
  surface = 'list',
  state = 'ready',
}: {
  surface?: 'list' | 'detail';
  state?: State;
}) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [services] = useState(() => fixture(state));
  return (
    <QueryClientProvider client={client}>
      {surface === 'list' ? (
        <LayoutContainer size="wide" inset="md">
          <MapPlacesPage localOnly bindings={services.list} navigate={navigatePreview} />
        </LayoutContainer>
      ) : (
        <MapPlaceDetailPage localOnly id="local-place" bindings={services.detail} navigate={navigatePreview} />
      )}
    </QueryClientProvider>
  );
}
const meta = {
  title: 'Pages/Admin/Map Places',
  excludeStories: ['MapPlacesPreview'],
  component: MapPlacesPreview,
  args: { surface: 'list', state: 'ready' },
  render: (args) => <MapPlacesPreview key={`${args.surface}:${args.state}`} {...args} />,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    docs: {
      description: {
        component:
          'Actual production list and place detail route controllers. Local typed CRUD readers, list query/selection/actions and complete PlaceEditor metadata/form are rendered. Map/autocomplete service controls are omitted; manual name/address/coordinates, local creation, updates and deletion remain available on every viewport.',
      },
    },
  },
} satisfies Meta<typeof MapPlacesPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const List: Story = {};
export const Empty: Story = { args: { state: 'empty' } };
export const Failed: Story = { args: { state: 'failed' } };
export const Pending: Story = { args: { state: 'pending' } };
export const ActionFailed: Story = { args: { state: 'action-failed' } };
export const Detail: Story = { args: { surface: 'detail' } };
export const DetailFailed: Story = { args: { surface: 'detail', state: 'failed' } };
export const DetailPending: Story = { args: { surface: 'detail', state: 'pending' } };
export const Phone: Story = { globals: { viewport: { value: 'phone', isRotated: false } } };
