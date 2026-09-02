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
import { Group, Modal, Stack } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { Select, TextInput } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { listPublishedForms } from '@/lib/queries/form-browser';
import { SectionItem } from './SectionItem';
import type { SectionType } from './types';

type ConfiguredSectionType = 'external-video' | 'form';

interface PageSectionPreinsertDialogProps {
  type: ConfiguredSectionType;
  title: string;
  formOptions: readonly { value: string; label: string }[];
  formsLoading: boolean;
  onCancel: () => void;
  onInsert: (type: ConfiguredSectionType, props: Record<string, unknown>) => void;
}

export function isValidExternalVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function PageSectionPreinsertDialog({
  type,
  title,
  formOptions,
  formsLoading,
  onCancel,
  onInsert,
}: PageSectionPreinsertDialogProps) {
  const t = useTranslations('pageEditor');
  const tActions = useTranslations('common.actions');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [formId, setFormId] = useState<string | null>(null);
  const canInsert = type === 'external-video' ? isValidExternalVideoUrl(externalVideoUrl) : Boolean(formId);

  const confirm = useCallback(() => {
    if (type === 'external-video' && isValidExternalVideoUrl(externalVideoUrl)) {
      onInsert(type, { url: externalVideoUrl.trim() });
    } else if (type === 'form' && formId) {
      onInsert(type, { formId });
    }
  }, [externalVideoUrl, formId, onInsert, type]);

  return (
    <Modal opened onClose={onCancel} title={title} centered>
      <Stack gap="md">
        {type === 'external-video' ? (
          <TextInput
            label="URL"
            value={externalVideoUrl}
            onChange={(event) => setExternalVideoUrl(event.currentTarget.value)}
            error={
              externalVideoUrl && !isValidExternalVideoUrl(externalVideoUrl) ? 'Enter a valid HTTP(S) URL.' : undefined
            }
            autoFocus
            data-page-section-preinsert-url
          />
        ) : (
          <Select
            label={t('blockEditor.labels.selectForm')}
            data={[...formOptions]}
            value={formId}
            onChange={setFormId}
            searchable
            disabled={formsLoading}
            data-page-section-preinsert-form
          />
        )}
        <Group justify="flex-end">
          <Button tone="neutral" emphasis="medium" onClick={onCancel} data-page-section-preinsert-cancel>
            {tActions('cancel')}
          </Button>
          <Button onClick={confirm} disabled={!canInsert} data-page-section-preinsert-confirm>
            {tActions('add')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function SectionList() {
  const t = useTranslations('pageEditor');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonEntities = useTranslations('common.entities');
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
  const sectionTypeLabels: Record<SectionType, string> = {
    'rich-text': t('sectionTypes.richText'),
    'post-list': t('sectionTypes.postList'),
    'post-table': t('sectionTypes.postTable'),
    'post-map': t('sectionTypes.postMap'),
    'work-map': t('sectionTypes.workMap'),
    'work-table': t('sectionTypes.workTable'),
    'work-list': t('sectionTypes.worksGallery'),
    'program-event-list': t('sectionTypes.programEventList'),
    'release-list': t('sectionTypes.releasesGallery'),
    'artist-list': t('sectionTypes.artistGrid'),
    'label-list': tCommonEntities('labels'),
    'text-marquee': t('sectionTypes.textMarquee'),
    'client-marquee': t('sectionTypes.clientMarquee'),
    'label-marquee': t('sectionTypes.labelMarquee'),
    'author-list': t('sectionTypes.authorList'),
    form: t('sectionTypes.form'),
    map: tCommonLabels('map'),
    'immersive-scene': t('sectionTypes.immersiveScene'),
    'external-video': t('sectionTypes.externalVideo'),
    columns: t('sectionTypes.columns'),
  };
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
      if (type === 'external-video' || type === 'form') {
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
            {(Object.keys(sectionTypeLabels) as SectionType[]).map((type) => (
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
