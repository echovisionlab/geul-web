'use client';

import { type ReactNode } from 'react';
import {
  EXTERNAL_VIDEO_ASPECT_RATIO_VALUES,
  type ExternalVideoAspectRatio,
} from '@echovisionlab/geul-common/media/block-schemas';
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconAspectRatio, IconLink } from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';

export type ExternalVideoAlignment = 'left' | 'center' | 'right';

export interface ExternalVideoToolbarSelection {
  aspectRatio: ExternalVideoAspectRatio;
  textAlignment: ExternalVideoAlignment;
}

export interface ExternalVideoFormattingToolbarProps {
  labels: {
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
    <div className="tiptap-editor__context-menu" data-testid="tiptap-external-video-menu">
      {alignments.map(({ value, Icon, labelKey }) => {
        const label = labels[labelKey];
        return (
          <Tooltip key={value} label={label} withArrow>
            <IconButton
              label={label}
              tone={selection.textAlignment === value ? 'accent' : 'neutral'}
              emphasis={selection.textAlignment === value ? 'medium' : 'low'}
              size="sm"
              aria-pressed={selection.textAlignment === value}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onUpdateLayout?.({ textAlignment: value })}
            >
              <Icon size={16} />
            </IconButton>
          </Tooltip>
        );
      })}
      <DropdownMenu portal={false} placement="bottom-start">
        <DropdownMenu.Target>
          <Tooltip label={labels.aspectRatio} withArrow>
            <IconButton
              label={labels.aspectRatio}
              tone="neutral"
              emphasis="low"
              size="sm"
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
            >
              <IconAspectRatio size={16} />
            </IconButton>
          </Tooltip>
        </DropdownMenu.Target>
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
      <Tooltip label={labels.editLink} withArrow>
        <IconButton
          label={labels.editLink}
          tone="neutral"
          emphasis="low"
          size="sm"
          disabled={!enabled || !onEditLink}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onEditLink?.()}
        >
          <IconLink size={16} />
        </IconButton>
      </Tooltip>
    </div>
  );
}
