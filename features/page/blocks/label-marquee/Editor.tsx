'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listLabelsForSelector } from '@/lib/queries/label-browser';
import { MarqueeCommonFields, MarqueeEntityFields } from '../marquee/MarqueeEditorFields';
import { MarqueeView } from '../marquee/MarqueeView';
import { buildEntityMarqueeItem, getEntityMarqueeHref, reorderByIds } from '../marquee/resolve';
import { parseMarqueeIds } from '../marquee/schema';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { parseLabelMarqueeProps, type LabelMarqueeProps } from './schema';

interface LabelMarqueeSettingsFormProps {
  props: Partial<LabelMarqueeProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

type LabelMarqueeSelectorItem = Awaited<ReturnType<typeof listLabelsForSelector>>[number];

function LabelMarqueeSettingsForm({ props, updateProps }: LabelMarqueeSettingsFormProps) {
  const tCommonEntities = useTranslations('common.entities');
  const { data: labels } = useQuery({
    queryKey: ['labels', 'selector'],
    queryFn: () => listLabelsForSelector(),
  });

  const updateProp = useCallback(
    (key: string, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  return (
    <Stack gap="sm" data-page-block-editor="label-marquee">
      <MarqueeEntityFields
        entityLabel={tCommonEntities('labels')}
        source={props.source || 'all'}
        ids={props.ids || ''}
        linkMode={props.linkMode || 'entity'}
        logoScale={props.logoScale || 'contain'}
        fallbackMode={props.fallbackMode || 'name'}
        selectorItems={labels ?? []}
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

function buildLabelMarqueePreviewItems(props: LabelMarqueeProps, labels: LabelMarqueeSelectorItem[]) {
  const selectedIds = parseMarqueeIds(props.ids);
  const visibleLabels = props.source === 'selected' ? reorderByIds(labels, selectedIds) : labels.slice(0, 24);

  return visibleLabels.map((label) =>
    buildEntityMarqueeItem({
      id: label.id,
      name: label.name,
      href: getEntityMarqueeHref('label', label, props.linkMode),
      logoUrl: label.imageUrl,
      logoLightUrl: label.imageLightUrl,
      logoDarkUrl: label.imageDarkUrl,
    }),
  );
}

export function LabelMarqueeSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<LabelMarqueeProps>) {
  return <LabelMarqueeSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function LabelMarqueeEditor({ sectionId, props }: BlockEditorProps<LabelMarqueeProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <LabelMarqueeSettingsForm props={props} updateProps={updateProps} />;
}

export function LabelMarqueeCanvasPreview({ props }: BlockCanvasPreviewProps<LabelMarqueeProps>) {
  const tPageEditor = useTranslations('pageEditor');
  const parsed = parseLabelMarqueeProps(props);
  const { data: labels } = useQuery({
    queryKey: ['labels', 'selector'],
    queryFn: () => listLabelsForSelector(),
  });
  const items = buildLabelMarqueePreviewItems(parsed, labels ?? []);

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
