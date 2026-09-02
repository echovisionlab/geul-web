'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconGripVertical,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Popover } from '@/components/core/Popover';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { getBlockDefinition } from '../blocks/registry';
import { getPageSectionStyle } from '../section-style';
import { PageBlockSettingsSurface } from './PageBlockSettingsSurface';
import { SectionContent } from './SectionContent';
import { SectionSettingsForm } from './SectionSettingsForm';
import { getPageSectionToggleId } from './test-ids';
import { DEFAULT_SECTION_SETTINGS, type SectionMeta, type SectionSettings } from './types';
import { usePageSectionTypeLabels } from './usePageSectionTypeLabels';

interface SectionItemProps {
  section: SectionMeta;
  onDelete: () => void;
  editable?: boolean;
}

export function SectionItem({ section, onDelete, editable = true }: SectionItemProps) {
  const t = useTranslations('pageEditor');
  const { mergeSection, updateLocalizedSectionProps, updateSection } = usePageEditor();
  const [settingsOpened, setSettingsOpened] = useState(false);
  const sectionTypeLabels = usePageSectionTypeLabels();
  const maxWidthOptions = useMemo(
    () => [
      { value: 'full', label: t('sectionItem.maxWidth.full') },
      { value: 'container', label: t('sectionItem.maxWidth.container') },
      { value: 'narrow', label: t('sectionItem.maxWidth.narrow') },
    ],
    [t],
  );
  const maxWidthLabels = useMemo(
    () => Object.fromEntries(maxWidthOptions.map((option) => [option.value, option.label])) as Record<string, string>,
    [maxWidthOptions],
  );
  const blockDefinition = getBlockDefinition(section.type);
  const CanvasPreview = blockDefinition?.CanvasPreview;
  const SettingsEditor = blockDefinition?.SettingsEditor;
  const SettingsSurface = blockDefinition?.SettingsSurface;
  const usesSplitSettings = Boolean(CanvasPreview && SettingsEditor);
  const [collapsed, setCollapsed] = useState(() => !usesSplitSettings);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateSettings = useCallback(
    (settingsUpdate: Partial<SectionSettings>) => {
      updateSection(section.id, {
        settings: settingsUpdate,
      });
    },
    [updateSection, section.id],
  );
  const updateSharedProps = useCallback(
    (props: Record<string, unknown>) => {
      updateSection(section.id, { props });
    },
    [section.id, updateSection],
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
  const mergedSection = mergeSection(section);
  const blockProps = mergedSection.props ?? {};
  const sectionSettingsPanel = <SectionSettingsForm settings={settings} onChange={updateSettings} />;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      shadow="xs"
      p="sm"
      withBorder
      data-page-section-id={section.id}
      data-page-section-type={section.type}
    >
      {/* Header - z-index ensures it's above any Leva panels */}
      <Group gap="xs" mb={collapsed ? 0 : 'sm'} style={{ position: 'relative', zIndex: 100 }}>
        <IconButton
          tone="neutral"
          emphasis="low"
          style={{ cursor: 'grab' }}
          aria-label={t('sectionItem.actions.drag', { section: sectionLabel })}
          {...attributes}
          {...listeners}
          disabled={!editable}
        >
          <IconGripVertical size={16} />
        </IconButton>

        <LabelBadge size="sm">{sectionLabel}</LabelBadge>

        {settings.maxWidth && settings.maxWidth !== 'full' && (
          <Text size="xs" c="dimmed">
            {maxWidthLabels[settings.maxWidth] ?? settings.maxWidth}
          </Text>
        )}

        <div style={{ flex: 1 }} />

        {editable && usesSplitSettings ? (
          <IconButton
            emphasis="low"
            size="sm"
            data-page-section-settings
            aria-label={t('sectionItem.actions.openSettings', { section: sectionLabel })}
            onClick={() => setSettingsOpened(true)}
          >
            {SettingsSurface ? <IconEdit size={16} /> : <IconSettings size={16} />}
          </IconButton>
        ) : editable ? (
          <Popover open={settingsOpened} onOpenChange={setSettingsOpened} placement="bottom-end" size="compact">
            <Popover.Target>
              <IconButton
                emphasis="low"
                size="sm"
                data-page-section-settings
                aria-label={t('sectionItem.actions.openSettings', { section: sectionLabel })}
                onClick={() => setSettingsOpened((o) => !o)}
              >
                <IconSettings size={16} />
              </IconButton>
            </Popover.Target>

            <Popover.Dropdown data-page-section-settings-panel={section.type}>
              <Stack gap="sm">
                <Text size="sm" fw={500}>
                  {t('sectionItem.settings.title')}
                </Text>
                {sectionSettingsPanel}
              </Stack>
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
          emphasis="low"
          size="sm"
          id={getPageSectionToggleId(section.id)}
          data-page-section-toggle
          aria-label={
            collapsed
              ? t('sectionItem.actions.expand', { section: sectionLabel })
              : t('sectionItem.actions.collapse', { section: sectionLabel })
          }
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
        </IconButton>

        <IconButton
          tone="danger"
          emphasis="low"
          size="sm"
          aria-label={t('sectionItem.actions.delete', { section: sectionLabel })}
          onClick={onDelete}
          disabled={!editable}
        >
          <IconTrash size={16} />
        </IconButton>
      </Group>

      {/* Content */}
      <Collapse expanded={!collapsed}>
        {!collapsed && usesSplitSettings && CanvasPreview ? (
          <Box data-page-section-canvas-preview data-section-type={section.type} style={getPageSectionStyle(settings)}>
            <CanvasPreview sectionId={section.id} props={blockProps} settings={settings} />
          </Box>
        ) : null}
        {!collapsed && !usesSplitSettings ? (
          <Box data-page-section-editor-preview data-section-type={section.type} style={getPageSectionStyle(settings)}>
            <SectionContent section={section} isExpanded={editable} />
          </Box>
        ) : null}
      </Collapse>
    </Paper>
  );
}
