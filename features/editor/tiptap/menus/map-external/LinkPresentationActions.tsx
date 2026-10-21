'use client';

import { IconId, IconLink, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import type { LinkPresentation } from '../../link-presentation/link-presentation';
import { SelectionMenuAction } from './SelectionMenuPrimitives';

export interface LinkPresentationLabels {
  menu: string;
  asLink: string;
  asCard: string;
  asVideo: string;
  refreshPreview: string;
  loadingPreview: string;
  previewUnavailable: string;
  playVideo: string;
  playNotice: string;
}

const PRESENTATION_ACTIONS = {
  link: { label: 'asLink', Icon: IconLink },
  card: { label: 'asCard', Icon: IconId },
  video: { label: 'asVideo', Icon: IconPlayerPlay },
} as const;

export interface LinkPresentationActionsProps {
  labels: LinkPresentationLabels;
  presentations: readonly LinkPresentation[];
  current: LinkPresentation;
  disabled?: boolean;
  onChange?: (presentation: LinkPresentation) => void;
  /** Re-reads the card or video preview; omitted for a plain link. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Link / card / video choices shared by the paste menu and the card and video selection menus. */
export function LinkPresentationActions({
  labels,
  presentations,
  current,
  disabled = false,
  onChange,
  onRefresh,
  refreshing = false,
}: LinkPresentationActionsProps) {
  return (
    <>
      {presentations.map((presentation) => {
        const { label, Icon } = PRESENTATION_ACTIONS[presentation];
        return (
          <SelectionMenuAction
            key={presentation}
            label={labels[label]}
            pressed={current === presentation}
            disabled={disabled}
            onClick={onChange ? () => onChange(presentation) : undefined}
            testId={`tiptap-link-presentation-${presentation}`}
          >
            <Icon size={16} aria-hidden />
          </SelectionMenuAction>
        );
      })}
      {onRefresh && current !== 'link' ? (
        <SelectionMenuAction
          label={refreshing ? labels.loadingPreview : labels.refreshPreview}
          disabled={disabled || refreshing}
          onClick={onRefresh}
          testId="tiptap-link-presentation-refresh"
        >
          <IconRefresh size={16} aria-hidden />
        </SelectionMenuAction>
      ) : null}
    </>
  );
}
