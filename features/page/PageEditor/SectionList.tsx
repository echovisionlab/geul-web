'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { Stack } from '@mantine/core';
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
  const { sections, addSection, deleteSection, moveSections, editable } = usePageEditor();
  const [pendingType, setPendingType] = useState<ConfiguredSectionType | null>(null);
  const { data: publishedForms, isLoading: formsLoading } = useQuery({
    queryKey: ['forms', 'listPublished', 50, 'page-preinsert'],
    queryFn: () => listPublishedForms(50),
    enabled: pendingType === 'form',
  });
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
      if (!editable) {
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
    [editable, moveSections, sections],
  );

  const handleAddSection = useCallback(
    (type: SectionType) => {
      if (type === 'external-video' || type === 'embed' || type === 'form') {
        setPendingType(type);
        return;
      }
      addSection(type);
    },
    [addSection],
  );

  const closePreinsert = useCallback(() => setPendingType(null), []);
  const confirmPreinsert = useCallback(
    (type: ConfiguredSectionType, props: Record<string, unknown>) => {
      addSection(type, undefined, props);
      closePreinsert();
    },
    [addSection, closePreinsert],
  );

  return (
    <Stack gap="md">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SectionItem
              key={section.id}
              section={section}
              onDelete={() => deleteSection(section.id)}
              editable={editable}
            />
          ))}
        </SortableContext>
      </DndContext>

      {editable ? (
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
          onCancel={closePreinsert}
          onInsert={confirmPreinsert}
        />
      ) : null}
    </Stack>
  );
}
