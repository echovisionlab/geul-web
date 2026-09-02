'use client';

import { Fragment } from 'react';
import { Group, Text } from '@mantine/core';
import {
  IconArrowsHorizontal,
  IconMapPin,
  IconPlus,
  IconTarget,
  IconTextCaption,
  IconTrash,
} from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { EditorToolbarDropdownTarget } from '@/features/editor/toolbars/EditorToolbarTooltip';
import {
  AlignmentMenuActions,
  type ContextualBlockAlignment,
  type ContextualBlockAlignmentLabels,
} from './AlignmentMenuActions';
import { SelectionMenuAction, SelectionMenuSurface } from './SelectionMenuPrimitives';

export interface MapSelectionPlace {
  id: string;
  name: string;
  centered?: boolean;
}

export interface MapSelectionMenuLabels extends ContextualBlockAlignmentLabels {
  menu: string;
  places: string;
  addPlace: string;
  centerPlace: string;
  removePlace: string;
  width: string;
  resizeHint: string;
  resizing: string;
  focusCaption: string;
  deleteBlock: string;
}

export interface MapSelectionMenuProps {
  labels: MapSelectionMenuLabels;
  places: readonly MapSelectionPlace[];
  textAlignment: ContextualBlockAlignment;
  previewWidth: string | number;
  editorElement?: HTMLElement | null;
  navigationEnabled?: boolean;
  isResizing?: boolean;
  disabled?: boolean;
  onAddPlace?: () => void;
  onRemovePlace?: (placeId: string) => void;
  onCenterPlace?: (placeId: string) => void;
  onChangeAlignment?: (alignment: ContextualBlockAlignment) => void;
  onFocusCaption?: () => void;
  onDelete?: () => void;
  onEscape?: () => void;
}

/**
 * Editor-engine-neutral controls for a selected map block. The integration owns
 * selection, mutations, focus restoration, and modal state through command ports.
 */
export function MapSelectionMenu({
  labels,
  places,
  textAlignment,
  previewWidth,
  editorElement = null,
  navigationEnabled = false,
  isResizing = false,
  disabled = false,
  onAddPlace,
  onRemovePlace,
  onCenterPlace,
  onChangeAlignment,
  onFocusCaption,
  onDelete,
  onEscape,
}: MapSelectionMenuProps) {
  const widthStatus = `${labels.width}: ${previewWidth}%${isResizing ? ` (${labels.resizing})` : ''}`;

  return (
    <SelectionMenuSurface
      label={labels.menu}
      testId="tiptap-map-menu"
      editorElement={editorElement}
      navigationEnabled={navigationEnabled}
      onEscape={onEscape}
    >
      <DropdownMenu size="compact" placement="bottom-start" portal={false}>
        <EditorToolbarDropdownTarget label={labels.places}>
          {(targetRef) => (
            <IconButton
              ref={targetRef}
              label={labels.places}
              tone="neutral"
              emphasis="low"
              size="sm"
              disabled={disabled || (!onAddPlace && !onRemovePlace && !onCenterPlace)}
              data-testid="tiptap-map-places"
              data-selection-toolbar-action=""
            >
              <IconMapPin size={16} aria-hidden />
            </IconButton>
          )}
        </EditorToolbarDropdownTarget>
        <DropdownMenu.Dropdown onMouseDown={(event) => event.preventDefault()}>
          <DropdownMenu.Item
            icon={<IconPlus size={16} aria-hidden />}
            disabled={disabled || !onAddPlace}
            onClick={onAddPlace}
          >
            {labels.addPlace}
          </DropdownMenu.Item>
          {places.map((place) => (
            <Fragment key={place.id}>
              <DropdownMenu.Divider />
              <DropdownMenu.Label>{place.name}</DropdownMenu.Label>
              <DropdownMenu.Item
                icon={<IconTarget size={16} aria-hidden />}
                selected={place.centered}
                disabled={disabled || !onCenterPlace}
                onClick={() => onCenterPlace?.(place.id)}
              >
                {labels.centerPlace}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconTrash size={16} aria-hidden />}
                tone="danger"
                disabled={disabled || !onRemovePlace}
                onClick={() => onRemovePlace?.(place.id)}
              >
                {labels.removePlace}
              </DropdownMenu.Item>
            </Fragment>
          ))}
        </DropdownMenu.Dropdown>
      </DropdownMenu>

      <AlignmentMenuActions
        value={textAlignment}
        labels={labels}
        onChange={onChangeAlignment}
        disabled={disabled}
        testIdPrefix="tiptap-map-align"
      />

      <Tooltip label={labels.resizeHint} withArrow>
        <Group
          role="status"
          aria-label={widthStatus}
          gap={4}
          wrap="nowrap"
          h={30}
          px={6}
          data-resizing={isResizing || undefined}
          data-testid="tiptap-map-width"
        >
          <IconArrowsHorizontal size={16} aria-hidden />
          <Text component="output" size="xs" fw={500}>
            {previewWidth}%
          </Text>
        </Group>
      </Tooltip>

      <SelectionMenuAction
        label={labels.focusCaption}
        disabled={disabled}
        onClick={onFocusCaption}
        testId="tiptap-map-caption"
      >
        <IconTextCaption size={16} aria-hidden />
      </SelectionMenuAction>
      <SelectionMenuAction
        label={labels.deleteBlock}
        tone="danger"
        disabled={disabled}
        onClick={onDelete}
        testId="tiptap-map-delete"
      >
        <IconTrash size={16} aria-hidden />
      </SelectionMenuAction>
    </SelectionMenuSurface>
  );
}
