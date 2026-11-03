'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VisuallyHidden } from '@/components/core/Typography';
import { usePageSectionDragAccessibility } from './usePageSectionDragAccessibility';
import { focusPageSection } from './section-focus';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listPublishedForms } from '@/lib/queries/form-browser';
import { PageSectionPreinsertDialog, type ConfiguredSectionType } from './PageSectionPreinsertDialog';
import { SectionItem } from './SectionItem';
import { SECTION_MENU } from './section-menu';
import { usePageSectionTypeLabels } from './usePageSectionTypeLabels';
import type { SectionType } from './types';

export function SectionList() {
  const t = useTranslations('pageEditor');
  const { sections, addSection, deleteSection, moveSections, editable, allowStructuralEdits } = usePageEditor();
  const canEditStructure = editable && allowStructuralEdits;
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | 'add' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const dragAccessibility = usePageSectionDragAccessibility(sections);
  useEffect(() => {
    if (!pendingFocus.current) {
      return;
    }
    const target = pendingFocus.current;
    const frame = requestAnimationFrame(() => {
      focusPageSection(listRef.current, target);
      pendingFocus.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [sections]);
  const [pendingType, setPendingType] = useState<ConfiguredSectionType | null>(null);
  const formsQuery = useQuery({
    queryKey: ['forms', 'listPublished', 50, 'page-preinsert'],
    queryFn: () => listPublishedForms(50),
    enabled: pendingType === 'form',
  });
  const { data: publishedForms, isLoading: formsLoading } = formsQuery;
  const formOptions = useMemo(
    () => (publishedForms ?? []).map((form) => ({ value: form.id, label: form.title })),
    [publishedForms],
  );
  const sectionTypeLabels = usePageSectionTypeLabels();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!canEditStructure) {
        return;
      }
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const oldIndex = sections.findIndex((section) => section.id === active.id);
      const newIndex = sections.findIndex((section) => section.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        moveSections(oldIndex, newIndex);
      }
    },
    [canEditStructure, moveSections, sections],
  );

  const handleAddSection = useCallback(
    (type: SectionType) => {
      if (!canEditStructure) {
        return;
      }
      if (type === 'external-video' || type === 'embed' || type === 'form') {
        setPendingType(type);
        return;
      }
      const added = addSection(type);
      if (added) {
        pendingFocus.current = added.id;
        setAnnouncement(
          t('a11y.sectionAdded', {
            section: sectionTypeLabels[type],
            index: sections.length + 1,
            count: sections.length + 1,
          }),
        );
      }
    },
    [addSection, canEditStructure, sectionTypeLabels, sections.length, t],
  );

  const closePreinsert = useCallback(() => setPendingType(null), []);
  const confirmPreinsert = useCallback(
    (type: ConfiguredSectionType, props: Record<string, unknown>) => {
      const added = addSection(type, undefined, props);
      if (added) {
        pendingFocus.current = added.id;
        setAnnouncement(
          t('a11y.sectionAdded', {
            section: sectionTypeLabels[type],
            index: sections.length + 1,
            count: sections.length + 1,
          }),
        );
      }
      closePreinsert();
    },
    [addSection, closePreinsert, sectionTypeLabels, sections.length, t],
  );

  return (
    <DsLayoutStack gap="md" ref={listRef} data-page-body-mounted>
      <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </VisuallyHidden>
      <DndContext
        accessibility={dragAccessibility}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, index) => (
            <SectionItem
              key={section.id}
              section={section}
              positionDescription={t('a11y.sectionPosition', {
                section: sectionTypeLabels[section.type],
                index: index + 1,
                count: sections.length,
              })}
              onDelete={() => {
                pendingFocus.current = sections[index + 1]?.id ?? sections[index - 1]?.id ?? 'add';
                deleteSection(section.id);
                setAnnouncement(t('a11y.sectionDeleted', { section: sectionTypeLabels[section.type] }));
              }}
              editable={editable}
            />
          ))}
        </SortableContext>
      </DndContext>

      {canEditStructure ? (
        <DropdownMenu>
          <DropdownMenu.Target>
            <Button
              tone="neutral"
              emphasis="medium"
              leftSection={<IconPlus size={16} />}
              fullWidth
              data-page-section-add
            >
              {t('columnsEditor.menuLabel')}
            </Button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            {SECTION_MENU.map((type) => (
              <DropdownMenu.Item key={type} onClick={() => handleAddSection(type)} data-page-section-add-item={type}>
                {sectionTypeLabels[type]}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ) : null}

      {pendingType ? (
        <PageSectionPreinsertDialog
          key={pendingType}
          type={pendingType}
          title={sectionTypeLabels[pendingType]}
          formOptions={formOptions}
          formsLoading={formsLoading}
          formsFailure={formsQuery.isError ? <QueryErrorAlert queries={[formsQuery]} /> : undefined}
          onCancel={closePreinsert}
          onInsert={confirmPreinsert}
        />
      ) : null}
    </DsLayoutStack>
  );
}
