'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Button } from '@/components/core/Button';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { ClientLogoUploader } from '@/features/client/ClientLogoUploader';
import { createClientAction, updateClientAction } from '@/lib/actions/client';
import { getClient } from '@/lib/queries/client-browser';

export interface ClientDetailPageViewProps {
  clientId?: string;
  readAction?: typeof getClient;
  createAction?: typeof createClientAction;
  updateAction?: typeof updateClientAction;
  onNavigate?: (href: string) => void;
  logoBindings?: Pick<ComponentProps<typeof ClientLogoUploader>, 'uploadAction' | 'deleteAction'>;
}
export function ClientDetailPageView({
  clientId,
  readAction = getClient,
  createAction = createClientAction,
  updateAction = updateClientAction,
  onNavigate,
  logoBindings,
}: ClientDetailPageViewProps = {}) {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.clientsDetail');
  const params = useParams();
  const router = useRouter();
  const id = clientId ?? (params.id as string);
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const baselineRef = useRef<{
    id: string;
    name: string;
    website: string;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', 'detail', id],
    queryFn: () => readAction(id),
    enabled: !isNew,
  });

  const createClient = useMutation({
    mutationFn: (data: { name: string; website?: string | null }) => createAction(data.name, data.website),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('created'), tone: 'positive' });
      if (onNavigate) {
        onNavigate('/admin/clients');
      } else {
        router.push('/admin/clients');
      }
    },
  });

  const updateClient = useMutation({
    mutationFn: (data: { id: string; name?: string; website?: string | null }) =>
      updateAction(data.id, { name: data.name, website: data.website }),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      const baseline = baselineRef.current;
      if (baseline?.id === variables.id) {
        baselineRef.current = {
          ...baseline,
          ...(variables.name !== undefined ? { name: variables.name } : {}),
          ...(variables.website !== undefined ? { website: variables.website ?? '' } : {}),
        };
      }
      notifications.show({ message: tPage('updated'), tone: 'positive' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  useEffect(() => {
    if (!client || isNew || client.id !== id) {
      if (isNew) {
        baselineRef.current = null;
      }
      return;
    }

    const nextBaseline = {
      id: client.id,
      name: client.name,
      website: client.website || '',
      logoLightUrl: client.logoLightUrl ?? client.logoUrl,
      logoDarkUrl: client.logoDarkUrl,
    };
    const baseline = baselineRef.current;
    const identityChanged = baseline?.id !== nextBaseline.id;
    const dirty =
      !identityChanged &&
      baseline !== null &&
      (name !== baseline.name ||
        website !== baseline.website ||
        logoLightUrl !== baseline.logoLightUrl ||
        logoDarkUrl !== baseline.logoDarkUrl);

    if (!identityChanged && (dirty || updateClient.isPending)) {
      return;
    }

    baselineRef.current = nextBaseline;
    setName(nextBaseline.name);
    setWebsite(nextBaseline.website);
    setLogoLightUrl(nextBaseline.logoLightUrl);
    setLogoDarkUrl(nextBaseline.logoDarkUrl);
  }, [client, id, isNew, logoDarkUrl, logoLightUrl, name, updateClient.isPending, website]);

  const handleSubmit = () => {
    if (isNew) {
      createClient.mutate({
        name,
        website: website || null,
      });
    } else {
      const baseline = baselineRef.current;
      if (!baseline || baseline.id !== id) {
        return;
      }

      const changes: { id: string; name?: string; website?: string | null } = { id };
      if (name !== baseline.name) {
        changes.name = name;
      }
      if (website !== baseline.website) {
        changes.website = website || null;
      }
      if (Object.keys(changes).length === 1) {
        return;
      }

      updateClient.mutate({
        ...changes,
      });
    }
  };

  if (!isNew && isLoading) {
    return <PageLoader />;
  }

  return (
    <DsLayoutStack>
      <EditorHeader
        title={isNew ? tPage('newTitle') : tPage('editTitle')}
        isConnected
        isSynced
        hideConnectionStatus
        hideStatus
        onBack={() => {
          if (onNavigate) {
            onNavigate('/admin/clients');
          } else {
            router.push('/admin/clients');
          }
        }}
        backTooltip={tCommon('actions.back')}
      />

      <DsLayoutStack gap="md">
        {!isNew && (
          <ClientLogoUploader
            clientId={id}
            uploadAction={logoBindings?.uploadAction}
            deleteAction={logoBindings?.deleteAction}
            currentImage={logoLightUrl}
            variant="light"
            name={name}
            size={120}
            label={tCommon('labels.logoLight')}
            onImageChange={(url) => {
              setLogoLightUrl(url);
              if (baselineRef.current?.id === id) {
                baselineRef.current.logoLightUrl = url;
              }
            }}
          />
        )}

        {!isNew && (
          <ClientLogoUploader
            clientId={id}
            uploadAction={logoBindings?.uploadAction}
            deleteAction={logoBindings?.deleteAction}
            currentImage={logoDarkUrl}
            variant="dark"
            name={name}
            size={120}
            label={tCommon('labels.logoDark')}
            onImageChange={(url) => {
              setLogoDarkUrl(url);
              if (baselineRef.current?.id === id) {
                baselineRef.current.logoDarkUrl = url;
              }
            }}
          />
        )}

        <TextInput
          label={tCommon('labels.name')}
          placeholder={tPage('namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />
        <TextInput
          label={tCommon('labels.website')}
          placeholder={tCommon('placeholders.website')}
          value={website}
          onChange={(e) => setWebsite(e.currentTarget.value)}
        />

        <DsLayoutInset blockStart="md">
          <DsLayoutInline justify="end">
            <Button
              emphasis="low"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('/admin/clients');
                } else {
                  router.push('/admin/clients');
                }
              }}
            >
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createClient.isPending || updateClient.isPending}
              disabled={!name.trim()}
            >
              {isNew ? tCommon('actions.createItem', { item: tCommon('entities.client') }) : tCommon('actions.save')}
            </Button>
          </DsLayoutInline>
        </DsLayoutInset>
      </DsLayoutStack>
    </DsLayoutStack>
  );
}
