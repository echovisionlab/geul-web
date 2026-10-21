'use client';

import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import {
  DISPLAY_SIZE_PRESETS,
  displaySizePreset,
  type DisplaySizePresetId,
} from '@/components/core/ResizeHandle/display-size';
import { Text } from '@/components/core/Typography';
import { SelectionMenuAction } from './SelectionMenuPrimitives';

export interface ContextualBlockSizeLabels {
  displaySize: string;
  displaySizePresets: Record<DisplaySizePresetId, string>;
}

export interface DisplaySizeMenuActionsProps {
  value: number | string;
  labels: ContextualBlockSizeLabels;
  onChange?: (displaySize: number) => void;
  disabled?: boolean;
  testIdPrefix: string;
}

/** XS–XL display size presets. A size dragged between presets leaves none pressed. */
export function DisplaySizeMenuActions({
  value,
  labels,
  onChange,
  disabled = false,
  testIdPrefix,
}: DisplaySizeMenuActionsProps) {
  const current = displaySizePreset(value);
  return (
    <DsLayoutInline gap="xxs" wrap="nowrap" role="group" aria-label={labels.displaySize}>
      {DISPLAY_SIZE_PRESETS.map((preset) => (
        <SelectionMenuAction
          key={preset.id}
          label={`${labels.displaySizePresets[preset.id]} · ${preset.value}%`}
          pressed={current === preset.id}
          disabled={disabled}
          onClick={onChange ? () => onChange(preset.value) : undefined}
          testId={`${testIdPrefix}-${preset.id}`}
        >
          <Text as="span" size="xs" weight="strong" aria-hidden>
            {preset.id.toUpperCase()}
          </Text>
        </SelectionMenuAction>
      ))}
    </DsLayoutInline>
  );
}

/** English labels for menus mounted without the editor's message catalogue. */
export const DEFAULT_DISPLAY_SIZE_LABELS: ContextualBlockSizeLabels = {
  displaySize: 'Size',
  displaySizePresets: { xs: 'Extra small', s: 'Small', m: 'Medium', l: 'Large', xl: 'Extra large' },
};
