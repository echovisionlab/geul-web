'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconExternalLink, IconGripVertical, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Loader, Paper, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SearchCombobox } from '@/features/search/SearchCombobox';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { useWorkMeta } from '@/lib/contexts/WorkMetaContext';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { getClient, searchClients } from '@/lib/queries/client-browser';

interface ClientDetails {
  id: string;
  name: string;
  logoUrl: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  website: string | null;
}

interface WorkClientsSectionProps {
  workId: string;
  canEdit: boolean;
  initialClientDetails?: ClientDetails[];
}

interface SortableClientProps {
  clientId: string;
  client: ClientDetails | null;
  canEdit: boolean;
  onRemove: (clientId: string) => void;
  isLoading: boolean;
  reorderAriaLabel: string;
  openWebsiteAriaLabel: string;
  removeAriaLabel: string;
}

function SortableClient({
  clientId,
  client,
  canEdit,
  onRemove,
  isLoading,
  reorderAriaLabel,
  openWebsiteAriaLabel,
  removeAriaLabel,
}: SortableClientProps) {
  const tCommonStates = useTranslations('common.states');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clientId,
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (isLoading || !client) {
    return (
      <Group
        ref={setNodeRef}
        gap="xs"
        justify="space-between"
        py={4}
        px="xs"
        style={{ borderRadius: 'var(--mantine-radius-sm)', ...style }}
      >
        <Group gap="xs">
          {canEdit && (
            <IconButton emphasis="low" size="xs" style={{ cursor: 'grab' }} aria-label={reorderAriaLabel}>
              <IconGripVertical size={14} />
            </IconButton>
          )}
          <Loader size="xs" />
          <Text size="xs" c="dimmed">
            {tCommonStates('loading')}
          </Text>
        </Group>
      </Group>
    );
  }

  return (
    <Group
      ref={setNodeRef}
      gap="xs"
      justify="space-between"
      py={4}
      px="xs"
      style={{ borderRadius: 'var(--mantine-radius-sm)', ...style }}
    >
      <Group gap="xs">
        {canEdit && (
          <IconButton
            emphasis="low"
            size="xs"
            style={{ cursor: 'grab' }}
            {...attributes}
            {...listeners}
            aria-label={reorderAriaLabel}
          >
            <IconGripVertical size={14} />
          </IconButton>
        )}
        {client.logoUrl || client.logoLightUrl || client.logoDarkUrl ? (
          <ThemedAssetImage
            fallbackUrl={client.logoUrl}
            lightUrl={client.logoLightUrl}
            darkUrl={client.logoDarkUrl}
            alt={client.name}
            width={64}
            height={16}
            style={{ height: 16, maxWidth: 64 }}
          />
        ) : null}
        <Text size="xs">{client.name}</Text>
        {client.website && (
          <IconButton
            component="a"
            href={client.website}
            target="_blank"
            rel="noopener noreferrer"
            tone="neutral"
            emphasis="low"
            size="xs"
            aria-label={openWebsiteAriaLabel}
          >
            <IconExternalLink size={12} />
          </IconButton>
        )}
      </Group>
      {canEdit && (
        <IconButton
          tone="danger"
          emphasis="low"
          size="xs"
          onClick={() => onRemove(client.id)}
          aria-label={removeAriaLabel}
        >
          <IconX size={12} />
        </IconButton>
      )}
    </Group>
  );
}

export function WorkClientsSection({ workId: _workId, canEdit, initialClientDetails = [] }: WorkClientsSectionProps) {
  const t = useTranslations('workEditor.clients');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [showAddForm, setShowAddForm] = useState(false);
  // Cache client details by ID
  const [clientDetailsCache, setClientDetailsCache] = useState<Map<string, ClientDetails>>(
    () => new Map(initialClientDetails.map((c) => [c.id, c])),
  );
  const [loadingClientIds, setLoadingClientIds] = useState<Set<string>>(new Set());

  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  // Get clients from Y.js context
  const { clients, setClients, isSynced } = useWorkMeta();

  // Fetch missing client details
  const fetchClientDetails = useCallback(
    async (clientId: string) => {
      if (clientDetailsCache.has(clientId) || loadingClientIds.has(clientId)) {
        return;
      }

      setLoadingClientIds((prev) => new Set(prev).add(clientId));
      try {
        const details = await getClient(clientId);
        if (details) {
          setClientDetailsCache((prev) => {
            const next = new Map(prev);
            next.set(clientId, {
              id: details.id,
              name: details.name,
              logoUrl: details.logoUrl,
              logoLightUrl: details.logoLightUrl,
              logoDarkUrl: details.logoDarkUrl,
              website: details.website,
            });
            return next;
          });
        }
      } catch {
        // Keep selected client ids visible even if detail hydration fails.
      } finally {
        setLoadingClientIds((prev) => {
          const next = new Set(prev);
          next.delete(clientId);
          return next;
        });
      }
    },
    [clientDetailsCache, loadingClientIds],
  );

  // Fetch details for any clients not in cache
  useEffect(() => {
    for (const clientId of clients) {
      if (!clientDetailsCache.has(clientId) && !loadingClientIds.has(clientId)) {
        fetchClientDetails(clientId);
      }
    }
  }, [clients, clientDetailsCache, loadingClientIds, fetchClientDetails]);

  // Search clients
  const { data: searchResults = [], isFetching: searchFetching } = useQuery({
    queryKey: ['client', 'search', debouncedSearch],
    queryFn: () => searchClients(debouncedSearch),
    enabled: isEnabled && canEdit,
  });

  // Filter out already added clients
  const existingClientIds = useMemo(() => new Set(clients), [clients]);
  const filteredSearchResults = useMemo(
    () => searchResults.filter((c: { id: string }) => !existingClientIds.has(c.id)),
    [searchResults, existingClientIds],
  );

  // Add client via Y.js
  const handleAddClient = useCallback(
    (clientId: string) => {
      // Find client details from search results
      const clientFromSearch = searchResults.find((c: { id: string }) => c.id === clientId);
      if (clientFromSearch) {
        // Cache the details
        setClientDetailsCache((prev) => {
          const next = new Map(prev);
          next.set(clientId, {
            id: clientFromSearch.id,
            name: clientFromSearch.name,
            logoUrl: clientFromSearch.logoUrl ?? null,
            logoLightUrl: clientFromSearch.logoLightUrl ?? clientFromSearch.logoUrl ?? null,
            logoDarkUrl: clientFromSearch.logoDarkUrl ?? null,
            website: clientFromSearch.website ?? null,
          });
          return next;
        });
      }

      // Update Y.js - add to end
      setClients([...clients, clientId]);
      reset();
    },
    [clients, setClients, searchResults, reset],
  );

  // Remove client via Y.js
  const handleRemoveClient = useCallback(
    (clientId: string) => {
      setClients(clients.filter((id) => id !== clientId));
    },
    [clients, setClients],
  );

  // Reorder via Y.js
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = clients.indexOf(active.id as string);
      const newIndex = clients.indexOf(over.id as string);
      const newOrder = arrayMove(clients, oldIndex, newIndex);
      setClients(newOrder);
    },
    [clients, setClients],
  );

  // Build display list with details
  const clientsWithDetails = useMemo(() => {
    return clients.map((clientId) => ({
      clientId,
      details: clientDetailsCache.get(clientId) ?? null,
      isLoading: loadingClientIds.has(clientId),
    }));
  }, [clients, clientDetailsCache, loadingClientIds]);

  if (!isSynced) {
    return (
      <SectionCard>
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <SectionHeader
        title={tCommonEntities('clients')}
        actions={
          canEdit ? (
            <Button
              size="xs"
              emphasis="medium"
              leftSection={<IconPlus size={14} />}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? tCommonActions('hide') : tCommonActions('add')}
            </Button>
          ) : null
        }
      />

      {canEdit && showAddForm && (
        <Paper p="sm" mb="sm" bg="var(--mantine-color-default)" radius="sm">
          <SearchCombobox
            combobox={combobox}
            search={search}
            onSearchChange={setSearch}
            placeholder={tCommonPlaceholders('searchClients')}
            leftSection={<IconSearch size={14} />}
            items={filteredSearchResults}
            isLoading={searchFetching}
            debouncedSearch={debouncedSearch}
            onSelect={handleAddClient}
            getItemId={(client: { id: string }) => client.id}
            emptyMessage={t('search.empty')}
            renderItem={(client: {
              id: string;
              name: string;
              logoUrl?: string | null;
              logoLightUrl?: string | null;
              logoDarkUrl?: string | null;
              logo_url?: string | null;
            }) => (
              <Group gap="xs">
                {client.logoUrl || client.logoLightUrl || client.logoDarkUrl || client.logo_url ? (
                  <ThemedAssetImage
                    fallbackUrl={client.logoUrl || client.logo_url || null}
                    lightUrl={client.logoLightUrl}
                    darkUrl={client.logoDarkUrl}
                    alt={client.name}
                    width={64}
                    height={16}
                    style={{ height: 16, maxWidth: 64 }}
                  />
                ) : null}
                <Text size="xs">{client.name}</Text>
              </Group>
            )}
          />
        </Paper>
      )}

      {clientsWithDetails.length === 0 ? (
        <Text size="xs" c="dimmed" ta="center" py="sm">
          {t('empty')}
        </Text>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={clients} strategy={verticalListSortingStrategy}>
            <Stack gap={0}>
              {clientsWithDetails.map(({ clientId, details, isLoading }) => (
                <SortableClient
                  key={clientId}
                  clientId={clientId}
                  client={details}
                  canEdit={canEdit}
                  onRemove={handleRemoveClient}
                  isLoading={isLoading}
                  reorderAriaLabel={t('actions.reorderClient')}
                  openWebsiteAriaLabel={t('actions.openWebsite')}
                  removeAriaLabel={t('actions.removeClient')}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}
    </SectionCard>
  );
}
