'use client';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useCallback, useMemo, useState } from 'react';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFormShareLinkAction, deleteFormShareLinkAction, listFormShareLinksAction } from '@/lib/actions/form';
import { createPageShareLinkAction, deletePageShareLinkAction, listPageShareLinksAction } from '@/lib/actions/page';
import { createPostShareLinkAction, deletePostShareLinkAction, listPostShareLinksAction } from '@/lib/actions/post';
import { createWorkShareLinkAction, deleteWorkShareLinkAction, listWorkShareLinksAction } from '@/lib/actions/work';
import { createShareLinkAction, deleteShareLinkAction, listShareLinksAction } from '@/lib/actions/share-link';
import { ensureShareLinkMutationSucceeded } from '@/lib/hooks/share-link-mutation-result';
import type { ShareEntityType, ShareLink } from '@/lib/types/share-link/model';
import { toDate } from '@/lib/utils/proto';

export interface UseShareLinksOptions<T extends ShareEntityType> {
  entityType: T;
  entityId: string;
  initialData?: ShareLink<T>[];
  services?: ShareLinkServices;
}

export interface CreateShareLinkOptions {
  label?: string;
  expiresAt?: Date;
  password?: string;
}

/** Read and commands use the same production controller in hosted and local scenarios. */
export interface ShareLinkServices {
  list: (entityType: ShareEntityType, entityId: string) => Promise<ShareLinkItem[]>;
  create: (entityType: ShareEntityType, entityId: string, options?: CreateShareLinkOptions) => Promise<void>;
  remove: (entityType: ShareEntityType, entityId: string, id: string) => Promise<void>;
}

interface UseShareLinksReturn<T extends ShareEntityType> {
  shareLinks: ShareLink<T>[];
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: string | null;
  create: (options?: CreateShareLinkOptions) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => void;
}

// Transform ShareLinkItem to ShareLink<T> format
function toShareLink<T extends ShareEntityType>(entityType: T, entityId: string, data: ShareLinkItem): ShareLink<T> {
  return {
    id: data.id,
    entityType,
    entityId,
    label: data.label ?? null,
    hasPassword: data.hasPassword,
    expiresAt: toDate(data.expiresAt) ?? new Date(0),
    createdAt: toDate(data.createdAt) ?? null,
    token: data.token,
    url: data.url,
  };
}

export function useShareLinks<T extends ShareEntityType>(options: UseShareLinksOptions<T>): UseShareLinksReturn<T> {
  const { entityType, entityId, initialData, services } = options;
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const queryKey = ['shareLinks', entityType, entityId];

  // Query function based on entity type
  const queryFn = useCallback(async (): Promise<ShareLinkItem[]> => {
    if (services) {
      return services.list(entityType, entityId);
    }
    switch (entityType) {
      case 'post':
        return listPostShareLinksAction(entityId);
      case 'page':
        return listPageShareLinksAction(entityId);
      case 'work':
        return listWorkShareLinksAction(entityId);
      case 'release':
        return listShareLinksAction(ShareLinkEntityType.RELEASE, entityId).then(unwrapQueryResult);
      case 'artist':
        return listShareLinksAction(ShareLinkEntityType.ARTIST, entityId).then(unwrapQueryResult);
      case 'label':
        return listShareLinksAction(ShareLinkEntityType.LABEL, entityId).then(unwrapQueryResult);
      case 'privacy':
        return listShareLinksAction(ShareLinkEntityType.PRIVACY, entityId).then(unwrapQueryResult);
      case 'terms':
        return listShareLinksAction(ShareLinkEntityType.TERMS, entityId).then(unwrapQueryResult);
      case 'form':
        return listFormShareLinksAction(entityId, ShareLinkEntityType.FORM);
      case 'form-dashboard':
        return listFormShareLinksAction(entityId, ShareLinkEntityType.FORM_DASHBOARD);
      default:
        return [];
    }
  }, [entityType, entityId, services]);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn,
    ...(services ? { enabled: true } : {}),
    staleTime: initialData ? Infinity : 0,
  });

  // Transform data to ShareLink<T>[]
  const shareLinks = useMemo((): ShareLink<T>[] => {
    // If we have fetched data, transform it
    if (data && Array.isArray(data)) {
      return data.map((item) => toShareLink(entityType, entityId, item));
    }

    // Return initialData if provided
    if (initialData) {
      return initialData;
    }

    return [];
  }, [data, entityType, entityId, initialData]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (createOptions?: CreateShareLinkOptions) => {
      if (services) {
        return services.create(entityType, entityId, createOptions);
      }
      switch (entityType) {
        case 'post':
          return ensureShareLinkMutationSucceeded(
            await createPostShareLinkAction({
              postId: entityId,
              label: createOptions?.label,
              expiresAt: createOptions?.expiresAt,
              password: createOptions?.password,
            }),
          );
        case 'page':
          return ensureShareLinkMutationSucceeded(
            await createPageShareLinkAction({
              pageId: entityId,
              label: createOptions?.label,
              expiresAt: createOptions?.expiresAt,
              password: createOptions?.password,
            }),
          );
        case 'work':
          return ensureShareLinkMutationSucceeded(
            await createWorkShareLinkAction({
              workId: entityId,
              label: createOptions?.label,
              expiresAt: createOptions?.expiresAt,
              password: createOptions?.password,
            }),
          );
        case 'release':
          return ensureShareLinkMutationSucceeded(
            await createShareLinkAction(ShareLinkEntityType.RELEASE, entityId, createOptions),
          );
        case 'artist':
          return ensureShareLinkMutationSucceeded(
            await createShareLinkAction(ShareLinkEntityType.ARTIST, entityId, createOptions),
          );
        case 'label':
          return ensureShareLinkMutationSucceeded(
            await createShareLinkAction(ShareLinkEntityType.LABEL, entityId, createOptions),
          );
        case 'privacy':
          return ensureShareLinkMutationSucceeded(
            await createShareLinkAction(ShareLinkEntityType.PRIVACY, entityId, createOptions),
          );
        case 'terms':
          return ensureShareLinkMutationSucceeded(
            await createShareLinkAction(ShareLinkEntityType.TERMS, entityId, createOptions),
          );
        case 'form':
          return ensureShareLinkMutationSucceeded(
            await createFormShareLinkAction({
              formId: entityId,
              type: ShareLinkEntityType.FORM,
              label: createOptions?.label,
              expiresAt: createOptions?.expiresAt,
              password: createOptions?.password,
            }),
          );
        case 'form-dashboard':
          return ensureShareLinkMutationSucceeded(
            await createFormShareLinkAction({
              formId: entityId,
              type: ShareLinkEntityType.FORM_DASHBOARD,
              label: createOptions?.label,
              expiresAt: createOptions?.expiresAt,
              password: createOptions?.password,
            }),
          );
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (services) {
        return services.remove(entityType, entityId, id);
      }
      switch (entityType) {
        case 'post':
          return ensureShareLinkMutationSucceeded(await deletePostShareLinkAction(id));
        case 'page':
          return ensureShareLinkMutationSucceeded(await deletePageShareLinkAction(id));
        case 'work':
          return ensureShareLinkMutationSucceeded(await deleteWorkShareLinkAction(id));
        case 'release':
        case 'artist':
        case 'label':
          return ensureShareLinkMutationSucceeded(await deleteShareLinkAction(id));
        case 'privacy':
        case 'terms':
          return ensureShareLinkMutationSucceeded(await deleteShareLinkAction(id));
        case 'form':
        case 'form-dashboard':
          return ensureShareLinkMutationSucceeded(await deleteFormShareLinkAction(id));
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const create = useCallback(
    async (createOptions?: CreateShareLinkOptions): Promise<void> => {
      await createMutation.mutateAsync(createOptions);
    },
    [createMutation],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      setDeletingId(id);
      try {
        await deleteMutation.mutateAsync(id);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteMutation],
  );

  return {
    shareLinks,
    isLoading,
    isCreating: createMutation.isPending,
    isDeleting: deletingId,
    create,
    remove,
    refetch,
  };
}
