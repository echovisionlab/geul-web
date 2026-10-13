'use client';

import {
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { MultiSelect, Select, Checkbox, Slider } from '@/components/core/Input';
import {
  MARQUEE_ITEM_HEIGHT_MAX,
  MARQUEE_ITEM_HEIGHT_MIN,
  MARQUEE_ITEM_HEIGHT_STEP,
  MARQUEE_SPEED_MAX,
  MARQUEE_SPEED_MIN,
  MARQUEE_SPEED_STEP,
  resolveMarqueeItemHeightPx,
  resolveMarqueeSpeedPxPerSecond,
} from './metrics';
import type { MarqueeSelectorItem } from './types';

interface MarqueeCommonFieldsProps {
  direction: string;
  speed: string;
  speedPxPerSecond?: string;
  itemHeight: string;
  itemHeightPx?: string;
  gap: string;
  pauseOnHover: string;
  linkTarget: string;
  onUpdate: (key: string, value: string) => void;
}

type MarqueeEditorMessageKey =
  | 'blockEditor.sections.marqueeBehavior'
  | 'blockEditor.sections.content'
  | 'blockEditor.labels.direction'
  | 'blockEditor.labels.speed'
  | 'blockEditor.labels.itemHeight'
  | 'blockEditor.labels.gap'
  | 'blockEditor.labels.openInNewTab'
  | 'blockEditor.labels.pauseOnHover'
  | 'blockEditor.labels.source'
  | 'blockEditor.labels.linkMode'
  | 'blockEditor.labels.logoScale'
  | 'blockEditor.labels.fallbackMode'
  | 'blockEditor.options.direction.left'
  | 'blockEditor.options.direction.right'
  | 'blockEditor.options.size.sm'
  | 'blockEditor.options.size.md'
  | 'blockEditor.options.size.lg'
  | 'blockEditor.options.size.xl'
  | 'blockEditor.options.source.all'
  | 'blockEditor.options.source.selected'
  | 'blockEditor.options.linkMode.entity'
  | 'blockEditor.options.linkMode.none'
  | 'blockEditor.options.logoScale.contain'
  | 'blockEditor.options.logoScale.fillHeight'
  | 'blockEditor.options.fallbackMode.name'
  | 'blockEditor.options.fallbackMode.hide';

export function MarqueeCommonFields({
  direction,
  speed,
  speedPxPerSecond,
  itemHeight,
  itemHeightPx,
  gap,
  pauseOnHover,
  linkTarget,
  onUpdate,
}: MarqueeCommonFieldsProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tb = (key: MarqueeEditorMessageKey, _fallback: string) => tPageEditor(key);
  const speedValue = resolveMarqueeSpeedPxPerSecond(speedPxPerSecond, speed);
  const itemHeightValue = resolveMarqueeItemHeightPx(itemHeightPx, itemHeight);

  return (
    <>
      <DsLayoutStack gap="md">
        <DsText size="xs" tone="secondary" weight="medium">
          {tb('blockEditor.sections.marqueeBehavior', 'Marquee behavior')}
        </DsText>
        <DsLayoutGrid columns={{ base: 1, sm: 2 }} gap="sm">
          <Select
            label={tb('blockEditor.labels.direction', 'Direction')}
            data={[
              { value: 'left', label: tb('blockEditor.options.direction.left', 'Left') },
              { value: 'right', label: tb('blockEditor.options.direction.right', 'Right') },
            ]}
            value={direction}
            onChange={(value) => onUpdate('direction', value || 'left')}
          />
          <DsLayoutStack gap="xxs">
            <DsLayoutInline justify="between" gap="xs">
              <DsText size="xs" weight="medium">
                {tb('blockEditor.labels.speed', 'Speed')}
              </DsText>
              <DsText size="xs" tone="secondary">
                {speedValue}px/s
              </DsText>
            </DsLayoutInline>
            <Slider
              min={MARQUEE_SPEED_MIN}
              max={MARQUEE_SPEED_MAX}
              step={MARQUEE_SPEED_STEP}
              value={speedValue}
              onChange={(value) => onUpdate('speedPxPerSecond', String(value))}
            />
          </DsLayoutStack>
          <DsLayoutStack gap="xxs">
            <DsLayoutInline justify="between" gap="xs">
              <DsText size="xs" weight="medium">
                {tb('blockEditor.labels.itemHeight', 'Item height')}
              </DsText>
              <DsText size="xs" tone="secondary">
                {itemHeightValue}px
              </DsText>
            </DsLayoutInline>
            <Slider
              min={MARQUEE_ITEM_HEIGHT_MIN}
              max={MARQUEE_ITEM_HEIGHT_MAX}
              step={MARQUEE_ITEM_HEIGHT_STEP}
              value={itemHeightValue}
              onChange={(value) => onUpdate('itemHeightPx', String(value))}
            />
          </DsLayoutStack>
          <Select
            label={tb('blockEditor.labels.gap', 'Gap')}
            data={[
              { value: 'sm', label: tb('blockEditor.options.size.sm', 'Small') },
              { value: 'md', label: tb('blockEditor.options.size.md', 'Medium') },
              { value: 'lg', label: tb('blockEditor.options.size.lg', 'Large') },
              { value: 'xl', label: tb('blockEditor.options.size.xl', 'Extra large') },
            ]}
            value={gap}
            onChange={(value) => onUpdate('gap', value || 'lg')}
          />
        </DsLayoutGrid>
        <DsLayoutInline gap="lg" align="center">
          <Checkbox
            label={tb('blockEditor.labels.openInNewTab', 'Open links in a new tab')}
            checked={linkTarget === 'new-tab'}
            onChange={(event) => onUpdate('linkTarget', event.currentTarget.checked ? 'new-tab' : 'same-tab')}
          />
          <Checkbox
            label={tb('blockEditor.labels.pauseOnHover', 'Pause on hover')}
            checked={pauseOnHover !== 'false'}
            onChange={(event) => onUpdate('pauseOnHover', event.currentTarget.checked ? 'true' : 'false')}
          />
        </DsLayoutInline>
      </DsLayoutStack>
    </>
  );
}

interface MarqueeEntityFieldsProps {
  entityLabel: string;
  source: string;
  ids: string;
  linkMode: string;
  logoScale: string;
  fallbackMode: string;
  selectorItems: MarqueeSelectorItem[];
  extra?: ReactNode;
  onUpdate: (key: string, value: string) => void;
}

export function MarqueeEntityFields({
  entityLabel,
  source,
  ids,
  linkMode,
  logoScale,
  fallbackMode,
  selectorItems,
  extra,
  onUpdate,
}: MarqueeEntityFieldsProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tb = (key: MarqueeEditorMessageKey, _fallback: string) => tPageEditor(key);
  const selectedIds = ids ? ids.split(',').filter(Boolean) : [];

  return (
    <DsLayoutStack gap="md">
      <DsText size="xs" tone="secondary" weight="medium">
        {tb('blockEditor.sections.content', 'Content')}
      </DsText>
      <Select
        label={tb('blockEditor.labels.source', 'Source')}
        data={[
          { value: 'all', label: tb('blockEditor.options.source.all', 'All') },
          { value: 'selected', label: tb('blockEditor.options.source.selected', 'Selected') },
        ]}
        value={source}
        onChange={(value) => onUpdate('source', value || 'all')}
      />
      {source === 'selected' ? (
        <MultiSelect
          label={entityLabel}
          data={selectorItems.map((item) => ({ value: item.id, label: item.name }))}
          value={selectedIds}
          onChange={(values) => onUpdate('ids', values.join(','))}
          searchable
          clearable
        />
      ) : null}
      <DsLayoutGrid columns={{ base: 1, sm: 2 }} gap="sm">
        <Select
          label={tb('blockEditor.labels.linkMode', 'Links')}
          data={[
            { value: 'entity', label: tb('blockEditor.options.linkMode.entity', 'Entity pages') },
            { value: 'none', label: tb('blockEditor.options.linkMode.none', 'No links') },
          ]}
          value={linkMode}
          onChange={(value) => onUpdate('linkMode', value || 'entity')}
        />
        <Select
          label={tb('blockEditor.labels.logoScale', 'Logo scale')}
          data={[
            { value: 'contain', label: tb('blockEditor.options.logoScale.contain', 'Contain') },
            {
              value: 'fill-height',
              label: tb('blockEditor.options.logoScale.fillHeight', 'Fill height'),
            },
          ]}
          value={logoScale}
          onChange={(value) => onUpdate('logoScale', value || 'contain')}
        />
      </DsLayoutGrid>
      <Select
        label={tb('blockEditor.labels.fallbackMode', 'Missing logo')}
        data={[
          { value: 'name', label: tb('blockEditor.options.fallbackMode.name', 'Show name') },
          { value: 'hide', label: tb('blockEditor.options.fallbackMode.hide', 'Hide item') },
        ]}
        value={fallbackMode}
        onChange={(value) => onUpdate('fallbackMode', value || 'name')}
      />
      {extra}
    </DsLayoutStack>
  );
}
