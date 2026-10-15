'use client';

import { type ReactNode } from 'react';
import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconAspectRatio, IconLink } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { ToolbarSurface } from '@/components/core/Section';
import { EditorToolbarAction } from './EditorToolbarAction';
import { EditorToolbarDropdownTarget } from './EditorToolbarTooltip';

export type ExternalVideoAlignment = 'left' | 'center' | 'right';

export interface ExternalVideoToolbarSelection {
  aspectRatio: ExternalVideoAspectRatio;
  textAlignment: ExternalVideoAlignment;
}

export interface ExternalVideoFormattingToolbarProps {
  labels: {
    /** Accessible name of the contextual video toolbar. */
    toolbar: string;
    editLink: string;
    aspectRatio: string;
    automaticAspectRatio: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
  };
  /** Undefined delegates rendering to the normal formatting controls. */
  selection?: ExternalVideoToolbarSelection;
  children: ReactNode;
  enabled?: boolean;
  /** Command ports. The editor integration owns node selection, layout mutation, and focus. */
  onUpdateLayout?: (layout: { aspectRatio?: ExternalVideoAspectRatio; textAlignment?: ExternalVideoAlignment }) => void;
  onEditLink?: () => void;
}

const alignments = [
  { value: 'left', Icon: IconAlignLeft, labelKey: 'alignLeft' },
  { value: 'center', Icon: IconAlignCenter, labelKey: 'alignCenter' },
  { value: 'right', Icon: IconAlignRight, labelKey: 'alignRight' },
] as const;

/**
 * Contextual external-video controls with no editor-engine state access.
 * A host resolves the selected video and wires these command ports to its editor.
 */
export function ExternalVideoFormattingToolbar({
  labels,
  selection,
  children,
  enabled = true,
  onUpdateLayout,
  onEditLink,
}: ExternalVideoFormattingToolbarProps) {
  if (!selection) {
    return <>{children}</>;
  }

  const disabled = !enabled || !onUpdateLayout;

  return (
    <ToolbarSurface label={labels.toolbar} density="compact" wrap="nowrap" data-testid="tiptap-external-video-menu">
      <DsLayoutInline gap="xxs" wrap="nowrap">
        {alignments.map(({ value, Icon, labelKey }) => (
          <EditorToolbarAction
            key={value}
            label={labels[labelKey]}
            pressed={selection.textAlignment === value}
            disabled={disabled}
            onClick={() => onUpdateLayout?.({ textAlignment: value })}
          >
            <Icon size={16} />
          </EditorToolbarAction>
        ))}
        <DropdownMenu portal={false} placement="bottom-start">
          <EditorToolbarDropdownTarget label={labels.aspectRatio} focusHint={false}>
            {(targetRef) => (
              <IconButton
                ref={targetRef}
                label={labels.aspectRatio}
                size="sm"
                disabled={disabled}
                data-selection-toolbar-action=""
                onMouseDown={(event) => event.preventDefault()}
              >
                <IconAspectRatio size={16} />
              </IconButton>
            )}
          </EditorToolbarDropdownTarget>
          <DropdownMenu.Dropdown>
            {EXTERNAL_VIDEO_ASPECT_RATIO_VALUES.map((aspectRatio) => (
              <DropdownMenu.Item
                key={aspectRatio}
                selected={selection.aspectRatio === aspectRatio}
                disabled={disabled}
                onClick={() => onUpdateLayout?.({ aspectRatio })}
              >
                {aspectRatio === 'auto' ? labels.automaticAspectRatio : aspectRatio}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Dropdown>
        </DropdownMenu>
        <EditorToolbarAction label={labels.editLink} disabled={!enabled} onClick={onEditLink}>
          <IconLink size={16} />
        </EditorToolbarAction>
      </DsLayoutInline>
    </ToolbarSurface>
  );
}
