'use client';

import { useCallback, useMemo } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { IconButton } from '@/components/core/IconButton';
import { TextInput } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { useSortableSensors } from '@/lib/hooks/useSortableSensors';
import { MarqueeCommonFields } from '../marquee/MarqueeEditorFields';
import { MarqueeView } from '../marquee/MarqueeView';
import { parseTextMarqueeItems } from '../marquee/schema';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import {
  moveTextMarqueeEditorItem,
  parseTextMarqueeEditorItems,
  serializeTextMarqueeEditorItems,
  type TextMarqueeEditorItem,
} from './editor-items';
import { parseTextMarqueeProps, type TextMarqueeProps } from './schema';

interface SortableTextMarqueeItemRowProps {
  id: string;
  index: number;
  item: TextMarqueeEditorItem;
  textLabel: string;
  hrefLabel: string;
  dragLabel: string;
  removeLabel: string;
  onChange: (index: number, item: TextMarqueeEditorItem) => void;
  onRemove: (index: number) => void;
}

function SortableTextMarqueeItemRow({
  id,
  index,
  item,
  textLabel,
  hrefLabel,
  dragLabel,
  removeLabel,
  onChange,
  onRemove,
}: SortableTextMarqueeItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <Box
      ref={setNodeRef}
      py="xs"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderBottom: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <IconButton
          emphasis="low"
          size="xs"
          style={{ cursor: 'grab', flexShrink: 0 }}
          {...attributes}
          {...listeners}
          aria-label={dragLabel}
        >
          <IconGripVertical size={14} />
        </IconButton>
        <Text size="xs" c="dimmed" w={24} ta="right" style={{ flexShrink: 0 }}>
          {index}
        </Text>
        <TextInput
          label={textLabel}
          value={item.text}
          onChange={(event) =>
            onChange(index, {
              ...item,
              text: event.currentTarget.value,
            })
          }
          size="xs"
          style={{ flex: 1, minWidth: 0 }}
        />
        <TextInput
          label={hrefLabel}
          value={item.href}
          onChange={(event) =>
            onChange(index, {
              ...item,
              href: event.currentTarget.value,
            })
          }
          size="xs"
          style={{ flex: 1, minWidth: 0 }}
        />
        <IconButton
          tone="danger"
          emphasis="low"
          size="xs"
          onClick={() => onRemove(index)}
          aria-label={removeLabel}
          style={{ flexShrink: 0 }}
        >
          <IconTrash size={14} />
        </IconButton>
      </Group>
    </Box>
  );
}

interface TextMarqueeSettingsFormProps {
  props: Partial<TextMarqueeProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

type TextMarqueeEditorMessageKey =
  | 'blockEditor.sections.content'
  | 'blockEditor.descriptions.marqueeTextItems'
  | 'blockEditor.actions.addMarqueeItem'
  | 'blockEditor.labels.marqueeItemText'
  | 'blockEditor.labels.marqueeItemHref'
  | 'blockEditor.actions.moveMarqueeItem'
  | 'blockEditor.actions.removeMarqueeItem'
  | 'blockEditor.empty.marqueeItems';

function TextMarqueeSettingsForm({ props, updateProps }: TextMarqueeSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tb = (key: TextMarqueeEditorMessageKey, _fallback: string) => tPageEditor(key);
  const sensors = useSortableSensors();
  const items = useMemo(() => parseTextMarqueeEditorItems(props.itemsJson), [props.itemsJson]);
  const sortableIds = useMemo(() => items.map((_, index) => String(index)), [items]);

  const updateProp = useCallback(
    (key: string, value: string) => {
      updateProps({ ...props, [key]: value });
    },
    [props, updateProps],
  );

  const updateItems = useCallback(
    (nextItems: TextMarqueeEditorItem[]) => {
      updateProp('itemsJson', serializeTextMarqueeEditorItems(nextItems));
    },
    [updateProp],
  );

  const handleItemChange = useCallback(
    (index: number, item: TextMarqueeEditorItem) => {
      updateItems(items.map((current, currentIndex) => (currentIndex === index ? item : current)));
    },
    [items, updateItems],
  );

  const handleItemRemove = useCallback(
    (index: number) => {
      updateItems(items.filter((_, currentIndex) => currentIndex !== index));
    },
    [items, updateItems],
  );

  const handleItemAdd = useCallback(() => {
    updateItems([...items, { text: '', href: '' }]);
  }, [items, updateItems]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }

      const fromIndex = Number(active.id);
      const toIndex = Number(over.id);
      if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) {
        return;
      }

      updateItems(moveTextMarqueeEditorItem(items, fromIndex, toIndex));
    },
    [items, updateItems],
  );

  return (
    <Stack gap="sm" data-page-block-editor="text-marquee">
      <Group justify="space-between" gap="sm" align="center">
        <Stack gap={2}>
          <Text size="xs" c="dimmed" fw={500}>
            {tb('blockEditor.sections.content', 'Content')}
          </Text>
          <Text size="xs" c="dimmed">
            {tb('blockEditor.descriptions.marqueeTextItems', 'Add text items one by one.')}
          </Text>
        </Stack>
        <Button size="xs" emphasis="medium" leftSection={<IconPlus size={14} />} onClick={handleItemAdd}>
          {tb('blockEditor.actions.addMarqueeItem', 'Add item')}
        </Button>
      </Group>
      {items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <Stack gap={0}>
              {items.map((item, index) => (
                <SortableTextMarqueeItemRow
                  key={sortableIds[index]}
                  id={sortableIds[index]}
                  index={index}
                  item={item}
                  textLabel={tb('blockEditor.labels.marqueeItemText', 'Text')}
                  hrefLabel={tb('blockEditor.labels.marqueeItemHref', 'Link URL')}
                  dragLabel={tb('blockEditor.actions.moveMarqueeItem', 'Reorder item')}
                  removeLabel={tb('blockEditor.actions.removeMarqueeItem', 'Remove item')}
                  onChange={handleItemChange}
                  onRemove={handleItemRemove}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          <Divider />
          <Text size="xs" c="dimmed">
            {tb('blockEditor.empty.marqueeItems', 'No items yet.')}
          </Text>
        </>
      )}
      <MarqueeCommonFields
        direction={props.direction || 'left'}
        speed={props.speed || 'normal'}
        speedPxPerSecond={props.speedPxPerSecond}
        itemHeight={props.itemHeight || 'md'}
        itemHeightPx={props.itemHeightPx}
        gap={props.gap || 'lg'}
        pauseOnHover={props.pauseOnHover || 'true'}
        linkTarget={props.linkTarget || 'same-tab'}
        onUpdate={updateProp}
      />
    </Stack>
  );
}

export function TextMarqueeSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<TextMarqueeProps>) {
  return <TextMarqueeSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function TextMarqueeEditor({ sectionId, props }: BlockEditorProps<TextMarqueeProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <TextMarqueeSettingsForm props={props} updateProps={updateProps} />;
}

export function TextMarqueeCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<TextMarqueeProps>) {
  const tPageEditor = useTranslations('pageEditor');
  const parsed = parseTextMarqueeProps(props);
  const items = parseTextMarqueeItems(parsed.itemsJson).map((item, index) => ({
    id: `${sectionId}-${index}`,
    text: item.text,
    href: item.href,
  }));

  return (
    <MarqueeView
      items={items}
      options={{
        direction: parsed.direction,
        speed: parsed.speed,
        speedPxPerSecond: parsed.speedPxPerSecond ? Number(parsed.speedPxPerSecond) : undefined,
        itemHeight: parsed.itemHeight,
        itemHeightPx: parsed.itemHeightPx ? Number(parsed.itemHeightPx) : undefined,
        gap: parsed.gap,
        pauseOnHover: parsed.pauseOnHover !== 'false',
        linkTarget: parsed.linkTarget,
        logoScale: 'contain',
        fallbackMode: 'name',
      }}
      emptyLabel={tPageEditor('blockEditor.empty.marqueeItems')}
    />
  );
}
