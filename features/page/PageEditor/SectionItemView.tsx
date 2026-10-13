'use client';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
  LayoutSpacer as DsLayoutSpacer,
} from '@/components/core/Layout';
import { DisclosureRegion } from '@/components/core/Disclosure';
import { InputSizeProvider } from '@/components/core/Input';

import { VisuallyHidden, Text as DsText } from '@/components/core/Typography';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import {
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconGripVertical,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { IconButton } from '@/components/core/IconButton';
import { Popover } from '@/components/core/Popover';
import type { BlockDefinition } from '../blocks/types';
import { COLLECTION_SIZES, DEFAULT_COLLECTION_SIZE } from '@/components/core/Collection/collection-contract';
import { getPageSectionStyle } from '../section-style';
import { PageBlockSettingsSurface } from './PageBlockSettingsSurface';
import { SectionSettingsForm, usePageSectionMaxWidthOptions } from './SectionSettingsForm';
import { getPageSectionToggleId } from './test-ids';
import { DEFAULT_SECTION_SETTINGS, type SectionMeta, type SectionSettings } from './types';
import { usePageSectionTypeLabels } from './usePageSectionTypeLabels';

export interface SectionItemViewProps {
  section: SectionMeta;
  onDelete: () => void;
  editable?: boolean;
  allowStructuralEdits: boolean;
  definition?: Pick<BlockDefinition, 'CanvasPreview' | 'SettingsEditor' | 'SettingsSurface' | 'parse'>;
  content: ReactNode;
  initialExpanded?: boolean;
  positionDescription?: string;
  updateSection: (sectionId: string, updates: import('./types').SectionUpdates) => void;
  updateLocalizedSectionProps: (sectionId: string, props: Record<string, unknown>) => void;
}

export function SectionItemView({
  section,
  onDelete,
  editable = true,
  allowStructuralEdits,
  definition,
  content,
  initialExpanded,
  positionDescription,
  updateSection,
  updateLocalizedSectionProps,
}: SectionItemViewProps) {
  const t = useTranslations('pageEditor');
  const [settingsOpened, setSettingsOpened] = useState(false);
  const canEditStructure = editable && allowStructuralEdits;
  const sectionTypeLabels = usePageSectionTypeLabels();
  const maxWidthOptions = usePageSectionMaxWidthOptions();
  const maxWidthLabels = useMemo(
    () => Object.fromEntries(maxWidthOptions.map((option) => [option.value, option.label])) as Record<string, string>,
    [maxWidthOptions],
  );
  const blockDefinition = definition;
  const CanvasPreview = blockDefinition?.CanvasPreview;
  const SettingsEditor = blockDefinition?.SettingsEditor;
  const SettingsSurface = blockDefinition?.SettingsSurface;
  const usesSplitSettings = Boolean(CanvasPreview && SettingsEditor);
  const [collapsed, setCollapsed] = useState(() => !(initialExpanded ?? usesSplitSettings));

  const sortable = useSortableItem({
    id: section.id,
    disabled: !canEditStructure,
  });

  const updateSettings = useCallback(
    (settingsUpdate: Partial<SectionSettings>) => {
      if (canEditStructure) {
        updateSection(section.id, { settings: settingsUpdate });
      }
    },
    [canEditStructure, updateSection, section.id],
  );
  const updateSharedProps = useCallback(
    (props: Record<string, unknown>) => {
      if (canEditStructure) {
        updateSection(section.id, { props });
      }
    },
    [canEditStructure, section.id, updateSection],
  );
  const updateLocalizedProps = useCallback(
    (props: Record<string, unknown>) => {
      updateLocalizedSectionProps(section.id, props);
    },
    [section.id, updateLocalizedSectionProps],
  );

  // Use default settings if not provided
  const settings = section.settings ?? DEFAULT_SECTION_SETTINGS;
  const sectionLabel = sectionTypeLabels[section.type] ?? section.type;
  const blockProps = section.props ?? {};
  // Resolve the block's schema defaults so the header describes the actual view.
  const parsedProps = definition?.parse?.(blockProps);
  const presentation =
    parsedProps && typeof parsedProps === 'object' ? (parsedProps as Record<string, unknown>) : blockProps;
  const layout = (['grid', 'list', 'cards', 'minimal', 'carousel'] as const).find(
    (value) => value === presentation.layout,
  );
  const itemSize = COLLECTION_SIZES.find((size) => size === presentation.itemSize) ?? DEFAULT_COLLECTION_SIZE;
  const isCollection = [
    'post-list',
    'artist-list',
    'program-event-list',
    'release-list',
    'work-list',
    'label-list',
    'author-list',
  ].includes(section.type);
  const presentationLabel = isCollection
    ? [layout ? t(`blockEditor.options.layout.${layout}`) : null, t(`blockEditor.options.itemSize.${itemSize}`)]
        .filter(Boolean)
        .join(' · ')
    : null;
  const sectionSettingsPanel = (
    <SectionSettingsForm settings={settings} onChange={updateSettings} readOnly={!canEditStructure} />
  );

  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <DsSectionCard
        role="group"
        aria-labelledby={`${getPageSectionToggleId(section.id)}-label`}
        aria-describedby={positionDescription ? `${getPageSectionToggleId(section.id)}-position` : undefined}
        withBorder
        state={sortable.isDragging ? 'dragging' : 'default'}
        data-page-section-id={section.id}
        data-page-section-type={section.type}
        padding="xxs"
      >
        {positionDescription ? (
          <VisuallyHidden id={`${getPageSectionToggleId(section.id)}-position`}>{positionDescription}</VisuallyHidden>
        ) : null}
        <div>
          <DsLayoutInset blockEnd={collapsed ? 'none' : 'sm'}>
            <DsLayoutInline gap="xxs" wrap="nowrap">
              <IconButton
                tone="neutral"
                emphasis="low"
                interaction="drag-handle"
                draggable={false}
                data-page-section-drag-handle
                aria-label={t('sectionItem.actions.drag', { section: sectionLabel })}
                {...sortable.handle}
                aria-describedby={
                  [
                    sortable.handle['aria-describedby'],
                    positionDescription ? `${getPageSectionToggleId(section.id)}-position` : null,
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                disabled={!canEditStructure}
              >
                <IconGripVertical aria-hidden />
              </IconButton>

              <DsLayoutStack gap="none" flexible>
                <DsText id={`${getPageSectionToggleId(section.id)}-label`} size="sm" weight="medium">
                  {sectionLabel}
                </DsText>

                {presentationLabel ? (
                  <DsText size="xs" tone="secondary" data-page-section-presentation>
                    {presentationLabel}
                  </DsText>
                ) : null}
                {settings.maxWidth && settings.maxWidth !== 'full' && (
                  <DsText size="xs" tone="secondary">
                    {maxWidthLabels[settings.maxWidth] ?? settings.maxWidth}
                  </DsText>
                )}
              </DsLayoutStack>
              <DsLayoutSpacer flexible />
              <DsLayoutInline gap="xxs" wrap="nowrap" shrink={false}>
                {editable && usesSplitSettings ? (
                  <IconButton
                    emphasis="low"
                    size="compact"
                    data-page-section-settings
                    aria-label={t('sectionItem.actions.openSettings', { section: sectionLabel })}
                    title={t('sectionItem.actions.openSettings', { section: sectionLabel })}
                    onClick={() => setSettingsOpened(true)}
                  >
                    {SettingsSurface ? <IconEdit size={16} /> : <IconSettings size={16} />}
                  </IconButton>
                ) : canEditStructure ? (
                  <Popover open={settingsOpened} onOpenChange={setSettingsOpened} placement="bottom-end" size="compact">
                    <Popover.Target>
                      <IconButton
                        emphasis="low"
                        size="compact"
                        data-page-section-settings
                        aria-label={t('sectionItem.actions.openSettings', { section: sectionLabel })}
                        title={t('sectionItem.actions.openSettings', { section: sectionLabel })}
                      >
                        <IconSettings size={16} />
                      </IconButton>
                    </Popover.Target>

                    <Popover.Dropdown data-page-section-settings-panel={section.type}>
                      <DsLayoutStack gap="sm">
                        <DsText size="sm" weight="medium">
                          {t('sectionItem.settings.title')}
                        </DsText>
                        <InputSizeProvider size="xs">{sectionSettingsPanel}</InputSizeProvider>
                      </DsLayoutStack>
                    </Popover.Dropdown>
                  </Popover>
                ) : null}

                {editable && usesSplitSettings && SettingsEditor ? (
                  SettingsSurface ? (
                    <SettingsSurface
                      opened={settingsOpened}
                      onClose={() => setSettingsOpened(false)}
                      title={sectionLabel}
                      sectionId={section.id}
                      props={blockProps}
                      settings={settings}
                      allowSharedEdits={canEditStructure}
                      updateSharedProps={updateSharedProps}
                      updateLocalizedProps={updateLocalizedProps}
                      updateSettings={updateSettings}
                      sectionSettings={sectionSettingsPanel}
                    />
                  ) : (
                    <PageBlockSettingsSurface
                      opened={settingsOpened}
                      onClose={() => setSettingsOpened(false)}
                      title={sectionLabel}
                      blockSettings={
                        <SettingsEditor
                          sectionId={section.id}
                          props={blockProps}
                          settings={settings}
                          allowSharedEdits={canEditStructure}
                          updateSharedProps={updateSharedProps}
                          updateLocalizedProps={updateLocalizedProps}
                          updateSettings={updateSettings}
                        />
                      }
                      sectionSettings={sectionSettingsPanel}
                    />
                  )
                ) : null}

                <IconButton
                  tone="danger"
                  emphasis="low"
                  size="compact"
                  aria-label={t('sectionItem.actions.delete', { section: sectionLabel })}
                  onClick={() => {
                    if (canEditStructure) {
                      onDelete();
                    }
                  }}
                  disabled={!canEditStructure}
                >
                  <IconTrash size={16} />
                </IconButton>
                <IconButton
                  emphasis="low"
                  size="compact"
                  id={getPageSectionToggleId(section.id)}
                  aria-expanded={!collapsed}
                  aria-controls={`${getPageSectionToggleId(section.id)}-panel`}
                  data-page-section-toggle
                  aria-label={
                    collapsed
                      ? t('sectionItem.actions.expand', { section: sectionLabel })
                      : t('sectionItem.actions.collapse', { section: sectionLabel })
                  }
                  onClick={() => setCollapsed((c) => !c)}
                >
                  {collapsed ? <IconChevronDown aria-hidden /> : <IconChevronUp aria-hidden />}
                </IconButton>
              </DsLayoutInline>
            </DsLayoutInline>
          </DsLayoutInset>
        </div>

        {/* Content */}
        <DisclosureRegion
          id={`${getPageSectionToggleId(section.id)}-panel`}
          labelledBy={`${getPageSectionToggleId(section.id)}-${positionDescription ? 'position' : 'label'}`}
          expanded={!collapsed}
        >
          {!collapsed && usesSplitSettings && CanvasPreview ? (
            <div
              data-page-section-canvas-preview
              data-section-type={section.type}
              style={{ ...getPageSectionStyle(settings) }}
            >
              <DsLayoutInset space="none">
                <CanvasPreview sectionId={section.id} props={blockProps} settings={settings} />
              </DsLayoutInset>
            </div>
          ) : null}
          {!collapsed && !usesSplitSettings ? (
            <div
              data-page-section-editor-preview
              data-section-type={section.type}
              style={{ ...getPageSectionStyle(settings) }}
            >
              <DsLayoutInset space="none">{content}</DsLayoutInset>
            </div>
          ) : null}
        </DisclosureRegion>
      </DsSectionCard>
    </SortableSurface>
  );
}
