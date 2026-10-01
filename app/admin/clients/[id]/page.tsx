'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Button } from '@/components/core/Button';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { ClientLogoUploader } from '@/features/client/ClientLogoUploader';
import { createClientAction, updateClientAction } from '@/lib/actions/client';
import { getClient } from '@/lib/queries/client-browser';

export default function AdminClientDetailPage() {
  const tCommon = useTranslations('common');
  const tPage = useTranslations('adminList.clientsDetail');
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
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
    queryFn: () => getClient(id),
    enabled: !isNew,
  });

  const createClient = useMutation({
    mutationFn: (data: { name: string; website?: string | null }) => createClientAction(data.name, data.website),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('created'), color: 'green' });
      router.push('/admin/clients');
    },
  });

  const updateClient = useMutation({
    mutationFn: (data: { id: string; name?: string; website?: string | null }) =>
      updateClientAction(data.id, { name: data.name, website: data.website }),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
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
      notifications.show({ message: tPage('updated'), color: 'green' });
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
    <Stack>
      <EditorHeader
        title={isNew ? tPage('newTitle') : tPage('editTitle')}
        isConnected
        isSynced
        hideConnectionStatus
        hideStatus
        onBack={() => router.push('/admin/clients')}
        backTooltip={tCommon('actions.back')}
      />

      <Stack gap="md">
        {!isNew && (
          <ClientLogoUploader
            clientId={id}
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

        <Group justify="flex-end" mt="md">
          <Button emphasis="low" onClick={() => router.push('/admin/clients')}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createClient.isPending || updateClient.isPending}
            disabled={!name.trim()}
          >
            {isNew ? tCommon('actions.createItem', { item: tCommon('entities.client') }) : tCommon('actions.save')}
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
}
