'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';

import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { IconColumns, IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { SectionCard } from '@/components/core/Section';
import { Field } from '@/components/core/Field';
import { useMediaQuery } from '@mantine/hooks';
import { LabelBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { Select, NumberInput, SegmentedControl, Switch } from '@/components/core/Input';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SectionItemView } from '../SectionItemView';
import { focusPageSection } from '../section-focus';
import { usePageSectionDragAccessibility } from '../usePageSectionDragAccessibility';
import { moveColumnSection } from './move-column-section';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { resolveEmbedUrl } from '@/features/page/blocks/embed/policy';
import { createBlockId } from '@/lib/editor/block-id';
import type { SectionRendererProps } from '../SectionRendererContext';
import { createDefaultSection, type ColumnData, type ColumnsSection, type SectionType } from '../types';
import { usePageSectionTypeLabels } from '../usePageSectionTypeLabels';
import { PageSectionPreinsertDialog } from '../PageSectionPreinsertDialog';
import { COLUMN_SECTION_MENU } from '../section-menu';

interface ColumnsEditorProps {
  section: ColumnsSection;
  SectionRenderer: ComponentType<SectionRendererProps>;
}

interface ColumnsEditorViewProps extends ColumnsEditorProps {
  editable: boolean;
  allowStructuralEdits: boolean;
  updateSection: (sectionId: string, updates: import('../types').SectionUpdates) => void;
  updateLocalizedSectionProps: (sectionId: string, props: Record<string, unknown>) => void;
}

function ColumnDropZone({
  id,
  children,
  disabled,
  labelId,
}: {
  id: string;
  children: ReactNode;
  disabled: boolean;
  labelId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <SectionCard
      ref={setNodeRef}
      role="group"
      aria-labelledby={labelId}
      padding="xs"
      appearance="plain"
      state={isOver ? 'drop-target' : 'default'}
      withBorder={false}
    >
      {children}
    </SectionCard>
  );
}

const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const sortable = sortableKeyboardCoordinates(event, args);
  if (sortable) {
    return sortable;
  }
  const directions: Record<string, readonly [number, number]> = {
    ArrowRight: [1, 0],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowUp: [0, -1],
  };
  const direction = directions[event.code];
  const { collisionRect, droppableContainers, droppableRects } = args.context;
  if (!direction || !collisionRect) {
    return undefined;
  }
  const destinations = droppableContainers
    .getEnabled()
    .map((container) => droppableRects.get(container.id))
    .filter(
      (rect) =>
        rect && (rect.left - collisionRect.left) * direction[0] + (rect.top - collisionRect.top) * direction[1] > 0,
    )
    .sort(
      (a, b) =>
        Math.hypot(a!.left - collisionRect.left, a!.top - collisionRect.top) -
        Math.hypot(b!.left - collisionRect.left, b!.top - collisionRect.top),
    );
  const destination = destinations[0];
  return destination ? { x: destination.left, y: destination.top } : undefined;
};

export function ColumnsEditor(props: ColumnsEditorProps) {
  const { updateSection, updateLocalizedSectionProps, editable, allowStructuralEdits } = usePageEditor();
  return (
    <ColumnsEditorView
      {...props}
      updateSection={updateSection}
      updateLocalizedSectionProps={updateLocalizedSectionProps}
      editable={editable}
      allowStructuralEdits={allowStructuralEdits}
    />
  );
}

export function ColumnsEditorView({
  section,
  SectionRenderer,
  updateSection,
  updateLocalizedSectionProps,
  editable,
  allowStructuralEdits,
}: ColumnsEditorViewProps) {
  const t = useTranslations('pageEditor');
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ sectionId?: string; columnIndex: number } | null>(null);
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );
  const canEditStructure = editable && allowStructuralEdits;
  const [pendingEmbedColumn, setPendingEmbedColumn] = useState<string | null>(null);
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
  const dragAccessibility = usePageSectionDragAccessibility(columnsData.flatMap((column) => column.sections));
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (pending.sectionId) {
        focusPageSection(rootRef.current, pending.sectionId);
      } else {
        rootRef.current?.querySelector<HTMLElement>(`[data-column-section-add="${pending.columnIndex}"]`)?.focus();
      }
      pendingFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [columnsData]);

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
    (columnId: string, type: SectionType, initialProps?: Record<string, unknown>) => {
      if (!canEditStructure || !columnsData.some((column) => column.id === columnId)) {
        return;
      }
      if (type === 'embed' && !initialProps) {
        setPendingEmbedColumn(columnId);
        return;
      }
      if (type === 'embed' && !resolveEmbedUrl(String(initialProps?.uri ?? ''))) {
        return;
      }
      const created = createDefaultSection(type);
      const child = initialProps ? { ...created, props: { ...created.props, ...initialProps } } : created;
      const newColumns = columnsData.map((col) =>
        col.id === columnId ? { ...col, sections: [...col.sections, child] } : col,
      );
      pendingFocus.current = {
        sectionId: child.id,
        columnIndex: columnsData.findIndex((column) => column.id === columnId),
      };
      updateSection(section.id, { columns: newColumns });
    },
    [canEditStructure, updateSection, section.id, columnsData],
  );

  const removeSectionFromColumn = useCallback(
    (columnIndex: number, sectionIndex: number) => {
      if (!canEditStructure) {
        return;
      }
      const currentColumn = columnsData[columnIndex];
      pendingFocus.current = {
        sectionId: currentColumn?.sections[sectionIndex + 1]?.id ?? currentColumn?.sections[sectionIndex - 1]?.id,
        columnIndex,
      };
      const newColumns = columnsData.map((col, i) =>
        i === columnIndex ? { ...col, sections: col.sections.filter((_, si) => si !== sectionIndex) } : col,
      );
      updateSection(section.id, { columns: newColumns });
    },
    [canEditStructure, updateSection, section.id, columnsData],
  );

  const ratios = columnRatios.split(':').map(Number);
  const gridTemplateColumns = isMobile && mobileStack === 'true' ? '1fr' : ratios.map((r) => `${r}fr`).join(' ');

  return (
    <DsLayoutStack gap="sm" ref={rootRef} data-page-block-editor="columns">
      {pendingEmbedColumn !== null ? (
        <PageSectionPreinsertDialog
          type="embed"
          title={sectionTypeLabels.embed}
          formOptions={[]}
          formsLoading={false}
          onCancel={() => setPendingEmbedColumn(null)}
          onInsert={(_type, initialProps) => {
            addSectionToColumn(pendingEmbedColumn, 'embed', initialProps);
            setPendingEmbedColumn(null);
          }}
        />
      ) : null}
      {/* Header */}
      <DsLayoutInline gap="xs">
        <IconColumns size={18} />
        <DsText size="sm" weight="medium">
          {t('sectionTypes.columns')}
        </DsText>
        <LabelBadge size="sm">{t('columnsEditor.badges.columnCount', { count: columnCount })}</LabelBadge>
        <LabelBadge size="sm" tone="neutral">
          {columnRatios}
        </LabelBadge>
      </DsLayoutInline>

      {/* Settings */}
      <DsLayoutGrid columns={{ base: 1, sm: 2 }} gap="sm" align="end">
        <Field label={t('blockEditor.labels.columns')}>
          <SegmentedControl
            label={t('blockEditor.labels.columns')}
            disabled={!canEditStructure}
            data={columnCountOptions}
            value={columnCount}
            onChange={(value) => updateProp('columns', value)}
            size="xs"
          />
        </Field>
        <Select
          label={t('columnsEditor.labels.ratio')}
          disabled={!canEditStructure}
          data={ratioOptions[columnCount] || ratioOptions['2']}
          value={columnRatios}
          onChange={(value) => updateProp('columnRatios', value || '1:1')}
          size="xs"
        />
        <NumberInput
          label={t('blockEditor.labels.gap')}
          disabled={!canEditStructure}
          value={parseInt(gap, 10)}
          onChange={(value) => updateProp('gap', String(value || 24))}
          min={0}
          max={100}
          size="xs"
          suffix="px"
        />
        <Switch
          disabled={!canEditStructure}
          label={t('columnsEditor.stackOnMobile')}
          checked={mobileStack === 'true'}
          onChange={(e) => updateProp('mobileStack', e.currentTarget.checked ? 'true' : 'false')}
          size="xs"
        />
      </DsLayoutGrid>

      {/* Each column consumes the same block chrome and sortable handle as the page canvas. */}
      <DndContext
        accessibility={dragAccessibility}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!canEditStructure || !over) {
            return;
          }
          const moved = moveColumnSection(columnsData, String(active.id), String(over.id));
          if (moved) {
            pendingFocus.current = {
              sectionId: String(active.id),
              columnIndex: moved.findIndex((column) => column.sections.some((child) => child.id === active.id)),
            };
            updateSection(section.id, { columns: moved });
          }
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns,
            gap: `${gap}px`,
          }}
        >
          {columnsData.map((column, columnIndex) => (
            <ColumnDropZone
              key={column.id}
              id={column.id}
              labelId={`page-column-${column.id}-label`}
              disabled={!canEditStructure || column.sections.length > 0}
            >
              <DsLayoutInset blockEnd="xs">
                <DsLayoutInline justify="between">
                  <DsText id={`page-column-${column.id}-label`} size="xs" tone="secondary" weight="medium">
                    {t('columnsEditor.column', { index: columnIndex + 1 })}
                  </DsText>
                  <DropdownMenu size="compact">
                    <DropdownMenu.Target>
                      <IconButton
                        disabled={!canEditStructure}
                        data-column-section-add={columnIndex}
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
                          data-column-section-add-item={type}
                          disabled={!canEditStructure}
                          onClick={() => addSectionToColumn(column.id, type)}
                        >
                          {sectionTypeLabels[type]}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Dropdown>
                  </DropdownMenu>
                </DsLayoutInline>
              </DsLayoutInset>

              <SortableContext items={column.sections.map((child) => child.id)} strategy={verticalListSortingStrategy}>
                <DsLayoutStack gap="xs">
                  {column.sections.length === 0 ? (
                    <DsLayoutInset block="md">
                      <DsText size="xs" tone="secondary" align="center">
                        {t('columnsEditor.emptyColumn')}
                      </DsText>
                    </DsLayoutInset>
                  ) : (
                    column.sections.map((childSection, sectionIndex) => (
                      <SectionItemView
                        key={childSection.id}
                        section={childSection}
                        editable={editable}
                        allowStructuralEdits={allowStructuralEdits}
                        initialExpanded
                        positionDescription={t('a11y.columnsPosition', {
                          column: t('columnsEditor.column', { index: columnIndex + 1 }),
                          section: sectionTypeLabels[childSection.type],
                          index: sectionIndex + 1,
                          count: column.sections.length,
                        })}
                        onDelete={() => removeSectionFromColumn(columnIndex, sectionIndex)}
                        updateSection={updateSection}
                        updateLocalizedSectionProps={updateLocalizedSectionProps}
                        content={<SectionRenderer section={childSection} />}
                      />
                    ))
                  )}
                </DsLayoutStack>
              </SortableContext>
            </ColumnDropZone>
          ))}
        </div>
      </DndContext>
    </DsLayoutStack>
  );
}
