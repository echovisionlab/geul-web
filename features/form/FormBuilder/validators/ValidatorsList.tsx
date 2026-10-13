'use client';

import { useRef } from 'react';
import { Text as DsText } from '@/components/core/Typography';
import { LayoutInset as DsLayoutInset, LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { verticalKeyboardCoordinates } from '@/components/core/Sortable';

import type { FieldType } from '@/lib/types/form/model';
import type { FieldValidator } from '@/lib/types/form/schema';
import { getLocalizedPredicateLabel } from '../i18n';
import { getValidatorLabel } from './helpers';
import { ValidatorEditor } from './ValidatorEditor';

interface ValidatorsListProps {
  validators: FieldValidator[];
  fieldType: FieldType;
  onChange: (validators: FieldValidator[]) => void;
  mode?: 'full' | 'translation' | 'readOnly';
}

export function ValidatorsList({ validators, fieldType, onChange, mode = 'full' }: ValidatorsListProps) {
  const t = useTranslations('formAdmin.builder');
  const tCommonLabels = useTranslations('common.labels');
  const tA11y = useTranslations('pageEditor.a11y');
  const canEditStructure = mode === 'full';
  const listRef = useRef<HTMLElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: verticalKeyboardCoordinates }),
  );

  const validatorIds = validators.map((v) => v.id);

  const announce = (
    event: 'dragStart' | 'dragOver' | 'dragEnd' | 'dragCancel',
    activeId: string | number,
    targetId?: string | number,
  ) => {
    const validator = validators.find((item) => item.id === String(activeId));
    if (!validator) {
      return undefined;
    }
    const section = getValidatorLabel(validator, (predicate) =>
      getLocalizedPredicateLabel(t, predicate, tCommonLabels),
    );
    const index = validatorIds.indexOf(String(targetId ?? activeId));
    return tA11y(event, { section, index: Math.max(index, 0) + 1, count: validators.length });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = validatorIds.indexOf(active.id as string);
    const newIndex = validatorIds.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(validators, oldIndex, newIndex));
    }
  };

  if (validators.length === 0) {
    return (
      <DsLayoutInset block="xs">
        <DsText size="xs" tone="secondary" align="center">
          {t('field.noValidators')}
        </DsText>
      </DsLayoutInset>
    );
  }

  const validatorEditors = validators.map((validator, index) => (
    <ValidatorEditor
      key={validator.id}
      id={validator.id}
      validator={validator}
      fieldType={fieldType}
      mode={mode}
      onChange={(updated) => {
        const nextValidators = [...validators];
        nextValidators[index] = updated;
        onChange(nextValidators);
      }}
      onRemove={() => {
        const fallback = listRef.current
          ?.closest('[data-disclosure]')
          ?.querySelector<HTMLButtonElement>('button[data-accordion-control]');
        onChange(validators.filter((_, validatorIndex) => validatorIndex !== index));
        requestAnimationFrame(() => {
          const controls = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-accordion-control]');
          (controls?.[Math.min(index, controls.length - 1)] ?? fallback)?.focus();
        });
      }}
    />
  ));

  if (!canEditStructure) {
    return (
      <DsLayoutStack ref={listRef} gap="xxs">
        {validatorEditors}
      </DsLayoutStack>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: tA11y('dragInstructions') },
        restoreFocus: true,
        announcements: {
          onDragStart: ({ active }) => announce('dragStart', active.id),
          onDragOver: ({ active, over }) => announce('dragOver', active.id, over?.id),
          onDragEnd: ({ active, over }) => announce('dragEnd', active.id, over?.id),
          onDragCancel: ({ active }) => announce('dragCancel', active.id),
        },
      }}
    >
      <SortableContext items={validatorIds} strategy={verticalListSortingStrategy}>
        <DsLayoutStack ref={listRef} gap="xxs">
          {validatorEditors}
        </DsLayoutStack>
      </SortableContext>
    </DndContext>
  );
}
