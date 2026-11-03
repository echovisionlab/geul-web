'use client';

import { SectionCard as DsSectionCard, SectionCard, SectionHeader } from '@/components/core/Section';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { useCallback, useMemo, useState } from 'react';
import { closestCenter, DndContext, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import { IconExternalLink, IconGripVertical, IconPlus, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { PageLoader } from '@/features/site/PageLoader';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { SearchCombobox } from '@/features/search/SearchCombobox';

import { ThemedAssetImage } from '@/features/media/ThemedAssetImage';
import { useWorkMeta } from '@/lib/contexts/WorkMetaContext';
import { useSearchCombobox } from '@/lib/hooks/useSearchCombobox';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { searchClients } from '@/lib/queries/client-browser';
import { useWorkClientDetails, type WorkClientDetails } from './useWorkClientDetails';

interface WorkClientsSectionProps {
  workId: string;
  canEdit: boolean;
  initialClientDetails?: WorkClientDetails[];
}

interface SortableClientProps {
  clientId: string;
  client: WorkClientDetails | null;
  canEdit: boolean;
  onRemove: (clientId: string) => void;
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  reorderAriaLabel: string;
  openWebsiteAriaLabel: string;
  removeAriaLabel: string;
}

export function SortableClient({
  clientId,
  client,
  canEdit,
  onRemove,
  isLoading,
  isError = false,
  onRetry,
  reorderAriaLabel,
  openWebsiteAriaLabel,
  removeAriaLabel,
}: SortableClientProps) {
  const tCommonMessages = useTranslations('common.messages');
  const tCommonActions = useTranslations('common.loadMore');
  const tEmpty = useTranslations('common.states');
  const sortable = useSortableItem({
    id: clientId,
    disabled: !canEdit,
  });

  if (isLoading) {
    return (
      <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
        <DsSectionCard
          padding="none"
          border="none"
          appearance="plain"
          state={sortable.isDragging ? 'dragging' : 'default'}
        >
          <DsLayoutInline gap="xxs" justify="between">
            <DsLayoutInline gap="xxs">
              {canEdit && (
                <IconButton
                  ref={sortable.handle.ref}
                  emphasis="low"
                  interaction="drag-handle"
                  draggable={false}
                  aria-label={reorderAriaLabel}
                  disabled
                >
                  <IconGripVertical aria-hidden />
                </IconButton>
              )}
              <PageLoader placement="flow" minHeight={0} size="sm" />
            </DsLayoutInline>
          </DsLayoutInline>
        </DsSectionCard>
      </SortableSurface>
    );
  }

  if (!client) {
    return (
      <DsLayoutInline gap="xs">
        <DsText size="xs" tone="secondary">
          {isError ? tCommonMessages('failedToLoad') : tEmpty('notAvailable')}
        </DsText>
        {isError && onRetry ? (
          <Button size="xs" onClick={onRetry}>
            {tCommonActions('retry')}
          </Button>
        ) : null}
        {canEdit ? (
          <IconButton aria-label={removeAriaLabel} onClick={() => onRemove(clientId)}>
            <IconX />
          </IconButton>
        ) : null}
      </DsLayoutInline>
    );
  }

  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <DsSectionCard
        padding="none"
        border="none"
        appearance="plain"
        state={sortable.isDragging ? 'dragging' : 'default'}
      >
        <DsLayoutInline gap="xxs" justify="between">
          <DsLayoutInline gap="xxs">
            {canEdit && (
              <IconButton
                emphasis="low"
                interaction="drag-handle"
                draggable={false}
                {...sortable.handle}
                aria-label={reorderAriaLabel}
              >
                <IconGripVertical aria-hidden />
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
            <DsText size="xs">{client.name}</DsText>
            {client.website && (
              <IconButton
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                tone="neutral"
                emphasis="low"
                size="compact"
                aria-label={openWebsiteAriaLabel}
              >
                <IconExternalLink size={12} />
              </IconButton>
            )}
          </DsLayoutInline>
          {canEdit && (
            <IconButton
              tone="danger"
              emphasis="low"
              size="compact"
              onClick={() => onRemove(client.id)}
              aria-label={removeAriaLabel}
            >
              <IconX size={12} />
            </IconButton>
          )}
        </DsLayoutInline>
      </DsSectionCard>
    </SortableSurface>
  );
}

export function WorkClientsSection({ workId: _workId, canEdit, initialClientDetails = [] }: WorkClientsSectionProps) {
  const t = useTranslations('workEditor.clients');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const [showAddForm, setShowAddForm] = useState(false);
  const { search, setSearch, debouncedSearch, combobox, isEnabled, reset } = useSearchCombobox();
  const sensors = useSortableSensors();

  // Get clients from Y.js context
  const { clients, setClients, isSynced } = useWorkMeta();

  const { clients: clientsWithDetails, rememberClient } = useWorkClientDetails(clients, initialClientDetails);

  // Search clients
  const searchResultsQuery = useQuery({
    queryKey: ['client', 'search', debouncedSearch],
    queryFn: () => searchClients(debouncedSearch),
    enabled: isEnabled && canEdit,
  });
  const { data: searchResults = [], isFetching: searchFetching } = searchResultsQuery;

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
        rememberClient({
          id: clientFromSearch.id,
          name: clientFromSearch.name,
          logoUrl: clientFromSearch.logoUrl ?? null,
          logoLightUrl: clientFromSearch.logoLightUrl ?? clientFromSearch.logoUrl ?? null,
          logoDarkUrl: clientFromSearch.logoDarkUrl ?? null,
          website: clientFromSearch.website ?? null,
        });
      }

      // Update Y.js - add to end
      setClients([...clients, clientId]);
      reset();
    },
    [clients, setClients, searchResults, reset, rememberClient],
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

  if (!isSynced) {
    return (
      <SectionCard>
        <PageLoader placement="flow" />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <QueryErrorAlert queries={[searchResultsQuery]} />
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
        <DsSectionCard padding="sm" appearance="muted">
          <SearchCombobox
            combobox={combobox}
            search={search}
            onSearchChange={setSearch}
            placeholder={tCommonPlaceholders('searchClients')}
            leadingGlyph="search"
            items={filteredSearchResults}
            isLoading={searchFetching}
            debouncedSearch={debouncedSearch}
            onSelect={handleAddClient}
            getItemId={(client: { id: string }) => client.id}
            getItemText={(client) => client.name}
            emptyMessage={t('search.empty')}
            renderItem={(client: {
              id: string;
              name: string;
              logoUrl?: string | null;
              logoLightUrl?: string | null;
              logoDarkUrl?: string | null;
              logo_url?: string | null;
            }) => (
              <DsLayoutInline gap="xxs">
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
                <DsText size="xs">{client.name}</DsText>
              </DsLayoutInline>
            )}
          />
        </DsSectionCard>
      )}

      {clientsWithDetails.length === 0 ? (
        <DsLayoutInset block="sm">
          <DsText size="xs" tone="secondary" align="center">
            {t('empty')}
          </DsText>
        </DsLayoutInset>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={clients} strategy={verticalListSortingStrategy}>
            <DsLayoutStack gap="none">
              {clientsWithDetails.map(({ clientId, details, isLoading, isError, retry }) => (
                <SortableClient
                  key={clientId}
                  clientId={clientId}
                  client={details}
                  canEdit={canEdit}
                  onRemove={handleRemoveClient}
                  isLoading={isLoading}
                  isError={isError}
                  onRetry={() => {
                    void retry();
                  }}
                  reorderAriaLabel={t('actions.reorderClient')}
                  openWebsiteAriaLabel={t('actions.openWebsite')}
                  removeAriaLabel={t('actions.removeClient')}
                />
              ))}
            </DsLayoutStack>
          </SortableContext>
        </DndContext>
      )}
    </SectionCard>
  );
}
