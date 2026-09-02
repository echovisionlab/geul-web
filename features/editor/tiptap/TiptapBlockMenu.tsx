'use client';

import { IconColorSwatch, IconGripVertical, IconTrash } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { EditorColorSwatch } from '@/features/editor/toolbars/EditorColorStyleButton';

export const TIPTAP_BLOCK_COLORS = [
  'default',
  'gray',
  'brown',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
] as const;

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
      icon={<EditorColorSwatch kind={kind} color={color} />}
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
}: TiptapBlockMenuProps) {
  const hasColors = canSetTextColor || canSetBackgroundColor;

  return (
    <DropdownMenu size="standard" placement="right-start" portal={false}>
      <Tooltip label={labels.open} withArrow>
        <span>
          <DropdownMenu.Target>
            <IconButton
              label={labels.open}
              tone="neutral"
              emphasis="low"
              size="sm"
              data-drag-handle
              data-testid="tiptap-block-drag-handle"
              draggable
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <IconGripVertical size={16} aria-hidden />
            </IconButton>
          </DropdownMenu.Target>
        </span>
      </Tooltip>
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
