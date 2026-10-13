'use client';

import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { VisuallyHidden, Text as DsText } from '@/components/core/Typography';
import { useCallback, useId, useMemo } from 'react';
import { usePageSectionDragAccessibility } from '@/features/page/PageEditor/usePageSectionDragAccessibility';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableSurface, useSortableItem } from '@/components/core/Sortable';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
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

export function SortableTextMarqueeItemRow({
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
  const descriptionId = useId();
  const sortable = useSortableItem({
    id,
  });

  return (
    <SortableSurface ref={sortable.setNodeRef} motion={sortable.motion}>
      <DsLayoutInset block="xxs" role="group" aria-label={`${textLabel} ${index + 1}`} aria-describedby={descriptionId}>
        <VisuallyHidden id={descriptionId}>
          {index + 1}
          {item.text ? ` · ${item.text}` : ''}
        </VisuallyHidden>
        <DsLayoutInline gap="xxs" align="end" wrap="nowrap">
          <IconButton
            emphasis="low"
            interaction="drag-handle"
            draggable={false}
            {...sortable.handle}
            aria-label={dragLabel}
            aria-describedby={[sortable.handle['aria-describedby'], descriptionId].filter(Boolean).join(' ')}
          >
            <IconGripVertical aria-hidden />
          </IconButton>
          <DsText as="span" size="xs" tone="secondary" shrink={false}>
            {index + 1}
          </DsText>
          <div style={{ minWidth: 0, flex: 1 }}>
            <TextInput
              grow
              label={textLabel}
              value={item.text}
              onChange={(event) =>
                onChange(index, {
                  ...item,
                  text: event.currentTarget.value,
                })
              }
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <TextInput
              grow
              label={hrefLabel}
              value={item.href}
              onChange={(event) =>
                onChange(index, {
                  ...item,
                  href: event.currentTarget.value,
                })
              }
            />
          </div>
          <IconButton
            tone="danger"
            emphasis="low"
            size="compact"
            onClick={() => onRemove(index)}
            aria-label={removeLabel}
            aria-describedby={descriptionId}
          >
            <IconTrash size={14} />
          </IconButton>
        </DsLayoutInline>
      </DsLayoutInset>
    </SortableSurface>
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
  const dragAccessibility = usePageSectionDragAccessibility(
    items.map((item, index) => ({ id: String(index), type: 'text-marquee', props: { text: item.text } })),
    (section) => String(section.props?.text || tb('blockEditor.labels.marqueeItemText', 'Text')),
  );
  const sortableIds = useMemo(() => items.map((_, index) => String(index)), [items]);

  const updateProp = useCallback(
    (key: string, value: string) => {
      updateProps({ [key]: value });
    },
    [updateProps],
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
    <DsLayoutStack gap="lg" data-page-block-editor="text-marquee">
      <DsLayoutInline justify="between" gap="sm" align="center">
        <DsLayoutStack gap="xxs">
          <DsText size="xs" tone="secondary" weight="medium">
            {tb('blockEditor.sections.content', 'Content')}
          </DsText>
          <DsText size="xs" tone="secondary">
            {tb('blockEditor.descriptions.marqueeTextItems', 'Add text items one by one.')}
          </DsText>
        </DsLayoutStack>
        <Button size="xs" emphasis="medium" leftSection={<IconPlus size={14} />} onClick={handleItemAdd}>
          {tb('blockEditor.actions.addMarqueeItem', 'Add item')}
        </Button>
      </DsLayoutInline>
      {items.length > 0 ? (
        <DndContext
          accessibility={dragAccessibility}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <DsLayoutStack gap="none">
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
            </DsLayoutStack>
          </SortableContext>
        </DndContext>
      ) : (
        <>
          <DsText size="xs" tone="secondary">
            {tb('blockEditor.empty.marqueeItems', 'No items yet.')}
          </DsText>
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
    </DsLayoutStack>
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
