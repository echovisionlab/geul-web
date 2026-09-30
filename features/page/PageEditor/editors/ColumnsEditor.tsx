'use client';

import { useCallback, useMemo, type ComponentType } from 'react';
import { IconColumns, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, Paper, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { createBlockId } from '@/lib/editor/block-id';
import type { SectionRendererProps } from '../SectionRendererContext';
import { createDefaultSection, type ColumnData, type ColumnsSection, type SectionType } from '../types';
import { usePageSectionTypeLabels } from '../usePageSectionTypeLabels';
import { COLUMN_SECTION_MENU } from '../section-menu';

interface ColumnsEditorProps {
  section: ColumnsSection;
  SectionRenderer: ComponentType<SectionRendererProps>;
}

export function ColumnsEditor({ section, SectionRenderer }: ColumnsEditorProps) {
  const t = useTranslations('pageEditor');
  const { updateSection, editable, allowStructuralEdits } = usePageEditor();
  const canEditStructure = editable && allowStructuralEdits;
  const sectionTypeLabels = usePageSectionTypeLabels();
  const columnCountOptions = useMemo(
    () => [
      { value: '2', label: t('columnsEditor.columnCounts.two') },
      { value: '3', label: t('columnsEditor.columnCounts.three') },
      { value: '4', label: t('columnsEditor.columnCounts.four') },
    ],
    [t],
  );
  const ratioOptions = useMemo<Record<string, { value: string; label: string }[]>>(
    () => ({
      '2': [
        { value: '1:1', label: t('columnsEditor.ratios.two.equal') },
        { value: '2:1', label: '2:1' },
        { value: '1:2', label: '1:2' },
        { value: '3:1', label: '3:1' },
        { value: '1:3', label: '1:3' },
      ],
      '3': [
        { value: '1:1:1', label: t('columnsEditor.ratios.three.equal') },
        { value: '2:1:1', label: '2:1:1' },
        { value: '1:2:1', label: '1:2:1' },
        { value: '1:1:2', label: '1:1:2' },
      ],
      '4': [{ value: '1:1:1:1', label: t('columnsEditor.ratios.four.equal') }],
    }),
    [t],
  );

  const props = section.props || {};
  const columnCount = (props.columns as string) || '2';
  const gap = (props.gap as string) || '24';
  const columnRatios = (props.columnRatios as string) || '1:1';
  const mobileStack = (props.mobileStack as string) || 'true';
  const columnsData: ColumnData[] = section.columns || [];

  const updateProp = useCallback(
    (key: string, value: string) => {
      if (!canEditStructure) {
        return;
      }
      const newProps = { ...props, [key]: value };

      // When column count changes, update columns array and ratios
      if (key === 'columns') {
        const newCount = parseInt(value, 10);
        const currentCount = columnsData.length;

        let newColumns = [...columnsData];

        if (newCount > currentCount) {
          // Add new empty columns
          for (let i = currentCount; i < newCount; i++) {
            newColumns.push({
              id: createBlockId(),
              sections: [],
            });
          }
        } else if (newCount < currentCount) {
          // Remove extra columns
          newColumns = newColumns.slice(0, newCount);
        }

        // Reset ratios
        const defaultRatio = ratioOptions[value]?.[0]?.value || '1:1';
        newProps.columnRatios = defaultRatio;

        updateSection(section.id, { props: newProps, columns: newColumns });
      } else {
        updateSection(section.id, { props: newProps });
      }
    },
    [canEditStructure, updateSection, section.id, props, columnsData, ratioOptions],
  );

  const addSectionToColumn = useCallback(
    (columnIndex: number, type: SectionType) => {
      if (!canEditStructure) {
        return;
      }
      const newColumns = columnsData.map((col, i) =>
        i === columnIndex ? { ...col, sections: [...col.sections, createDefaultSection(type)] } : col,
      );
      updateSection(section.id, { columns: newColumns });
    },
    [canEditStructure, updateSection, section.id, columnsData],
  );

  const removeSectionFromColumn = useCallback(
    (columnIndex: number, sectionIndex: number) => {
      if (!canEditStructure) {
        return;
      }
      const newColumns = columnsData.map((col, i) =>
        i === columnIndex ? { ...col, sections: col.sections.filter((_, si) => si !== sectionIndex) } : col,
      );
      updateSection(section.id, { columns: newColumns });
    },
    [canEditStructure, updateSection, section.id, columnsData],
  );

  const ratios = columnRatios.split(':').map(Number);
  const gridTemplateColumns = ratios.map((r) => `${r}fr`).join(' ');

  return (
    <Stack gap="sm" data-page-block-editor="columns">
      {/* Header */}
      <Group gap="xs">
        <IconColumns size={18} />
        <Text size="sm" fw={500}>
          {t('sectionTypes.columns')}
        </Text>
        <LabelBadge size="sm">{t('columnsEditor.badges.columnCount', { count: columnCount })}</LabelBadge>
        <LabelBadge size="sm" tone="neutral">
          {columnRatios}
        </LabelBadge>
      </Group>

      {/* Settings */}
      <Group gap="sm">
        <SegmentedControl
          disabled={!canEditStructure}
          data={columnCountOptions}
          value={columnCount}
          onChange={(value) => updateProp('columns', value)}
          size="xs"
        />

        <Select
          disabled={!canEditStructure}
          data={ratioOptions[columnCount] || ratioOptions['2']}
          value={columnRatios}
          onChange={(value) => updateProp('columnRatios', value || '1:1')}
          size="xs"
          w={120}
        />

        <NumberInput
          disabled={!canEditStructure}
          value={parseInt(gap, 10)}
          onChange={(value) => updateProp('gap', String(value || 24))}
          min={0}
          max={100}
          size="xs"
          w={80}
          suffix="px"
        />

        <Switch
          disabled={!canEditStructure}
          label={t('columnsEditor.stackOnMobile')}
          checked={mobileStack === 'true'}
          onChange={(e) => updateProp('mobileStack', e.currentTarget.checked ? 'true' : 'false')}
          size="xs"
        />
      </Group>

      {/* Column Editors */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: `${gap}px`,
        }}
      >
        {columnsData.map((column, columnIndex) => (
          <Paper key={column.id} p="xs" withBorder>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed" fw={500}>
                {t('columnsEditor.column', { index: columnIndex + 1 })}
              </Text>
              <DropdownMenu size="compact">
                <DropdownMenu.Target>
                  <IconButton
                    disabled={!canEditStructure}
                    emphasis="medium"
                    size="xs"
                    aria-label={t('columnsEditor.actions.addSectionToColumn', {
                      index: columnIndex + 1,
                    })}
                  >
                    <IconPlus size={14} />
                  </IconButton>
                </DropdownMenu.Target>
                <DropdownMenu.Dropdown>
                  <DropdownMenu.Label>{t('columnsEditor.menuLabel')}</DropdownMenu.Label>
                  {COLUMN_SECTION_MENU.map((type) => (
                    <DropdownMenu.Item
                      key={type}
                      disabled={!canEditStructure}
                      onClick={() => addSectionToColumn(columnIndex, type)}
                    >
                      {sectionTypeLabels[type]}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Dropdown>
              </DropdownMenu>
            </Group>

            <Stack gap="xs">
              {column.sections.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  {t('columnsEditor.emptyColumn')}
                </Text>
              ) : (
                column.sections.map((childSection, sectionIndex) => (
                  <Paper key={childSection.id} p="xs" withBorder bg="var(--mantine-color-default)">
                    <Group justify="space-between" mb="xs">
                      <LabelBadge size="xs">{sectionTypeLabels[childSection.type]}</LabelBadge>
                      <IconButton
                        disabled={!canEditStructure}
                        tone="danger"
                        emphasis="low"
                        size="xs"
                        aria-label={t('columnsEditor.actions.removeSectionFromColumn', {
                          section: sectionTypeLabels[childSection.type],
                          index: columnIndex + 1,
                        })}
                        onClick={() => removeSectionFromColumn(columnIndex, sectionIndex)}
                      >
                        <IconTrash size={12} />
                      </IconButton>
                    </Group>
                    <SectionRenderer section={childSection} />
                  </Paper>
                ))
              )}
            </Stack>
          </Paper>
        ))}
      </div>
    </Stack>
  );
}
