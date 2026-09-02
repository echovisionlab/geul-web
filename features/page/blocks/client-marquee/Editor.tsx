'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listClientsForSelector } from '@/lib/queries/client-browser';
import { MarqueeCommonFields, MarqueeEntityFields } from '../marquee/MarqueeEditorFields';
import { MarqueeView } from '../marquee/MarqueeView';
import { buildEntityMarqueeItem, getEntityMarqueeHref, reorderByIds } from '../marquee/resolve';
import { parseMarqueeIds } from '../marquee/schema';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { parseClientMarqueeProps, type ClientMarqueeProps } from './schema';

interface ClientMarqueeSettingsFormProps {
  props: Partial<ClientMarqueeProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

type ClientMarqueeSelectorItem = Awaited<ReturnType<typeof listClientsForSelector>>[number];

function ClientMarqueeSettingsForm({ props, updateProps }: ClientMarqueeSettingsFormProps) {
  const tCommonEntities = useTranslations('common.entities');
  const { data: clients } = useQuery({
    queryKey: ['clients', 'selector'],
    queryFn: () => listClientsForSelector(),
  });

  const updateProp = useCallback(
    (key: string, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  return (
    <Stack gap="sm" data-page-block-editor="client-marquee">
      <MarqueeEntityFields
        entityLabel={tCommonEntities('clients')}
        source={props.source || 'all'}
        ids={props.ids || ''}
        linkMode={props.linkMode || 'entity'}
        logoScale={props.logoScale || 'contain'}
        fallbackMode={props.fallbackMode || 'name'}
        selectorItems={clients ?? []}
        onUpdate={updateProp}
      />
      <MarqueeCommonFields
        direction={props.direction || 'left'}
        speed={props.speed || 'normal'}
        speedPxPerSecond={props.speedPxPerSecond}
        itemHeight={props.itemHeight || 'md'}
        itemHeightPx={props.itemHeightPx}
        gap={props.gap || 'lg'}
        pauseOnHover={props.pauseOnHover || 'true'}
        linkTarget={props.linkTarget || 'same-tab'}
        onUpdate={updateProp}
      />
    </Stack>
  );
}

function buildClientMarqueePreviewItems(props: ClientMarqueeProps, clients: ClientMarqueeSelectorItem[]) {
  const selectedIds = parseMarqueeIds(props.ids);
  const visibleClients = props.source === 'selected' ? reorderByIds(clients, selectedIds) : clients.slice(0, 24);

  return visibleClients.map((client) =>
    buildEntityMarqueeItem({
      id: client.id,
      name: client.name,
      href: getEntityMarqueeHref('client', client, props.linkMode),
      logoUrl: client.logoUrl,
      logoLightUrl: client.logoLightUrl,
      logoDarkUrl: client.logoDarkUrl,
    }),
  );
}

export function ClientMarqueeSettingsEditor({
  props,
  updateSharedProps,
}: BlockSettingsEditorProps<ClientMarqueeProps>) {
  return <ClientMarqueeSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function ClientMarqueeEditor({ sectionId, props }: BlockEditorProps<ClientMarqueeProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <ClientMarqueeSettingsForm props={props} updateProps={updateProps} />;
}

export function ClientMarqueeCanvasPreview({ props }: BlockCanvasPreviewProps<ClientMarqueeProps>) {
  const tPageEditor = useTranslations('pageEditor');
  const parsed = parseClientMarqueeProps(props);
  const { data: clients } = useQuery({
    queryKey: ['clients', 'selector'],
    queryFn: () => listClientsForSelector(),
  });
  const items = buildClientMarqueePreviewItems(parsed, clients ?? []);

  return (
    <MarqueeView
      items={items}
      options={{
        direction: parsed.direction,
        speed: parsed.speed,
        speedPxPerSecond: parsed.speedPxPerSecond ? Number(parsed.speedPxPerSecond) : undefined,
        itemHeight: parsed.itemHeight,
        itemHeightPx: parsed.itemHeightPx ? Number(parsed.itemHeightPx) : undefined,
        gap: parsed.gap,
        pauseOnHover: parsed.pauseOnHover !== 'false',
        linkTarget: parsed.linkTarget,
        logoScale: parsed.logoScale,
        fallbackMode: parsed.fallbackMode,
      }}
      emptyLabel={tPageEditor('blockEditor.empty.marqueeItems')}
    />
  );
}
