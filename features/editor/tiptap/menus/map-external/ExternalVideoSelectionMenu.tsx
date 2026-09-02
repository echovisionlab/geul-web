'use client';

import { Group, Text } from '@mantine/core';
import { IconArrowsHorizontal, IconAspectRatio, IconLink } from '@tabler/icons-react';
import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';
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

export interface ExternalVideoSelectionMenuLabels extends ContextualBlockAlignmentLabels {
  menu: string;
  editLink: string;
  aspectRatio: string;
  automaticAspectRatio: string;
  width: string;
  resizeHint: string;
}

export interface ExternalVideoSelectionMenuProps {
  labels: ExternalVideoSelectionMenuLabels;
  aspectRatio: ExternalVideoAspectRatio;
  textAlignment: ContextualBlockAlignment;
  previewWidth: string | number;
  editorElement?: HTMLElement | null;
  navigationEnabled?: boolean;
  disabled?: boolean;
  onEditLink?: () => void;
  onChangeAspectRatio?: (aspectRatio: ExternalVideoAspectRatio) => void;
  onChangeAlignment?: (alignment: ContextualBlockAlignment) => void;
  onEscape?: () => void;
}

/** Pure contextual controls for the durable standalone-link external-video block. */
export function ExternalVideoSelectionMenu({
  labels,
  aspectRatio,
  textAlignment,
  previewWidth,
  editorElement = null,
  navigationEnabled = false,
  disabled = false,
  onEditLink,
  onChangeAspectRatio,
  onChangeAlignment,
  onEscape,
}: ExternalVideoSelectionMenuProps) {
  return (
    <SelectionMenuSurface
      label={labels.menu}
      testId="tiptap-external-video-selection-menu"
      editorElement={editorElement}
      navigationEnabled={navigationEnabled}
      onEscape={onEscape}
    >
      <SelectionMenuAction
        label={labels.editLink}
        disabled={disabled}
        onClick={onEditLink}
        testId="tiptap-external-video-edit"
      >
        <IconLink size={16} aria-hidden />
      </SelectionMenuAction>

      <DropdownMenu size="compact" placement="bottom-start" portal={false}>
        <EditorToolbarDropdownTarget label={labels.aspectRatio}>
          {(targetRef) => (
            <IconButton
              ref={targetRef}
              label={labels.aspectRatio}
              tone="neutral"
              emphasis="low"
              size="sm"
              disabled={disabled || !onChangeAspectRatio}
              data-testid="tiptap-external-video-aspect-ratio"
              data-selection-toolbar-action=""
            >
              <IconAspectRatio size={16} aria-hidden />
            </IconButton>
          )}
        </EditorToolbarDropdownTarget>
        <DropdownMenu.Dropdown onMouseDown={(event) => event.preventDefault()}>
          {EXTERNAL_VIDEO_ASPECT_RATIO_VALUES.map((value) => (
            <DropdownMenu.Item
              key={value}
              selected={aspectRatio === value}
              disabled={disabled || !onChangeAspectRatio}
              onClick={() => onChangeAspectRatio?.(value)}
            >
              {value === 'auto' ? labels.automaticAspectRatio : value}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Dropdown>
      </DropdownMenu>

      <AlignmentMenuActions
        value={textAlignment}
        labels={labels}
        onChange={onChangeAlignment}
        disabled={disabled}
        testIdPrefix="tiptap-external-video-align"
      />

      <Tooltip label={labels.resizeHint} withArrow>
        <Group
          role="status"
          aria-label={`${labels.width}: ${previewWidth}%`}
          gap={4}
          wrap="nowrap"
          h={30}
          px={6}
          data-testid="tiptap-external-video-width"
        >
          <IconArrowsHorizontal size={16} aria-hidden />
          <Text component="output" size="xs" fw={500}>
            {previewWidth}%
          </Text>
        </Group>
      </Tooltip>
    </SelectionMenuSurface>
  );
}
