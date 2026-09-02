'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import type { FieldType } from '@/lib/types/form/model';
import type { FieldValidator } from '@/lib/types/form/schema';
import { ValidatorEditor } from './ValidatorEditor';

interface ValidatorsListProps {
  validators: FieldValidator[];
  fieldType: FieldType;
  onChange: (validators: FieldValidator[]) => void;
  mode?: 'full' | 'translation' | 'readOnly';
}

export function ValidatorsList({ validators, fieldType, onChange, mode = 'full' }: ValidatorsListProps) {
  const t = useTranslations('formAdmin.builder');
  const canEditStructure = mode === 'full';
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const validatorIds = validators.map((v) => v.id);

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
      <Text size="xs" c="dimmed" ta="center" py="xs">
        {t('field.noValidators')}
      </Text>
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
        onChange(validators.filter((_, validatorIndex) => validatorIndex !== index));
      }}
    />
  ));

  if (!canEditStructure) {
    return <Stack gap="xs">{validatorEditors}</Stack>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={validatorIds} strategy={verticalListSortingStrategy}>
        <Stack gap="xs">{validatorEditors}</Stack>
      </SortableContext>
    </DndContext>
  );
}
