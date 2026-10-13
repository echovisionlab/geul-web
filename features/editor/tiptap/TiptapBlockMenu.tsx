'use client';

import { useState } from 'react';
import { IconColorSwatch, IconGripVertical, IconTrash } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { DOCUMENT_COLOR_VALUES } from '@/components/core/DocumentColorPreview';

export const TIPTAP_BLOCK_COLORS = DOCUMENT_COLOR_VALUES;

export type TiptapBlockColor = (typeof TIPTAP_BLOCK_COLORS)[number];

export interface TiptapBlockMenuLabels {
  open: string;
  delete: string;
  colors: string;
  textColor: string;
  backgroundColor: string;
  colorNames: Record<TiptapBlockColor, string>;
}

export interface TiptapBlockMenuProps {
  labels: TiptapBlockMenuLabels;
  canSetTextColor: boolean;
  canSetBackgroundColor: boolean;
  textColor: TiptapBlockColor;
  backgroundColor: TiptapBlockColor;
  canDelete: boolean;
  onDelete: () => void;
  onTextColorChange: (color: TiptapBlockColor) => void;
  onBackgroundColorChange: (color: TiptapBlockColor) => void;
  onDraggingChange?: (dragging: boolean) => void;
}

function ColorMenuItems({
  activeColor,
  kind,
  labels,
  onChange,
}: {
  activeColor: TiptapBlockColor;
  kind: 'text' | 'background';
  labels: TiptapBlockMenuLabels;
  onChange: (color: TiptapBlockColor) => void;
}) {
  return TIPTAP_BLOCK_COLORS.map((color) => (
    <DropdownMenu.Item
      key={color}
      colorPreview={{ kind, color }}
      selected={activeColor === color}
      onClick={() => onChange(color)}
    >
      {labels.colorNames[color]}
    </DropdownMenu.Item>
  ));
}

/**
 * Context menu attached to a Tiptap block drag handle. The handle remains the
 * native ProseMirror drag target while click, Enter, Space, and ArrowDown use
 * the same accessible Core menu trigger.
 */
export function TiptapBlockMenu({
  labels,
  canSetTextColor,
  canSetBackgroundColor,
  textColor,
  backgroundColor,
  canDelete,
  onDelete,
  onTextColorChange,
  onBackgroundColorChange,
  onDraggingChange,
}: TiptapBlockMenuProps) {
  const hasColors = canSetTextColor || canSetBackgroundColor;
  const [opened, setOpened] = useState(false);

  return (
    <DropdownMenu
      size="standard"
      placement="right-start"
      portal={false}
      opened={opened}
      onChange={(next) => {
        // MenuTrigger opens on pointerdown. A native drag handle must wait for
        // a completed click, or the popup takes focus before dragging can begin.
        if (!next) {
          setOpened(false);
        }
      }}
    >
      <DropdownMenu.Target>
        <IconButton
          label={labels.open}
          tone="neutral"
          emphasis="low"
          data-drag-handle
          data-testid="tiptap-block-drag-handle"
          interaction="drag-handle"
          draggable
          tabIndex={-1}
          onClick={() => setOpened(true)}
          onDragStart={() => {
            setOpened(false);
            onDraggingChange?.(true);
          }}
          onDragEnd={() => onDraggingChange?.(false)}
          onKeyDown={(event) => {
            if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
              event.preventDefault();
              setOpened(true);
            }
          }}
        >
          <IconGripVertical aria-hidden />
        </IconButton>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown data-testid="tiptap-block-menu">
        <DropdownMenu.Item
          icon={<IconTrash size={16} aria-hidden />}
          tone="danger"
          disabled={!canDelete}
          onClick={onDelete}
        >
          {labels.delete}
        </DropdownMenu.Item>
        {hasColors ? (
          <DropdownMenu.Sub size="standard" placement="right-start">
            <DropdownMenu.Sub.Target icon={<IconColorSwatch size={16} aria-hidden />}>
              {labels.colors}
            </DropdownMenu.Sub.Target>
            <DropdownMenu.Sub.Dropdown>
              {canSetTextColor ? (
                <>
                  <DropdownMenu.Label>{labels.textColor}</DropdownMenu.Label>
                  <ColorMenuItems activeColor={textColor} kind="text" labels={labels} onChange={onTextColorChange} />
                </>
              ) : null}
              {canSetTextColor && canSetBackgroundColor ? <DropdownMenu.Divider /> : null}
              {canSetBackgroundColor ? (
                <>
                  <DropdownMenu.Label>{labels.backgroundColor}</DropdownMenu.Label>
                  <ColorMenuItems
                    activeColor={backgroundColor}
                    kind="background"
                    labels={labels}
                    onChange={onBackgroundColorChange}
                  />
                </>
              ) : null}
            </DropdownMenu.Sub.Dropdown>
          </DropdownMenu.Sub>
        ) : null}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
