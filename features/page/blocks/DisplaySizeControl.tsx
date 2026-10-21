'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { NumberInput, SegmentedControl } from '@/components/core/Input';
import {
  DISPLAY_SIZE_MAX,
  DISPLAY_SIZE_MIN,
  DISPLAY_SIZE_PRESETS,
  displaySizePreset,
  normalizeDisplaySize,
} from '@/components/core/ResizeHandle/display-size';
import { useDisplaySizeLabels } from '@/features/editor/tiptap/menus/map-external/useDisplaySizeLabels';

interface DisplaySizeControlProps {
  /** Visible label of the exact size field, e.g. "Size (%)". */
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (displaySize: string) => void;
}

/** XS–XL presets with the exact share beside them, both writing one display size. */
export function DisplaySizeControl({ label, value, disabled = false, onChange }: DisplaySizeControlProps) {
  const labels = useDisplaySizeLabels();
  const size = normalizeDisplaySize(value);
  return (
    <DsLayoutStack gap="xs">
      <SegmentedControl
        aria-label={labels.displaySize}
        disabled={disabled}
        data={DISPLAY_SIZE_PRESETS.map((preset) => ({
          value: String(preset.value),
          label: preset.id.toUpperCase(),
          accessibleLabel: `${labels.displaySizePresets[preset.id]} · ${preset.value}%`,
        }))}
        value={displaySizePreset(size) ? String(size) : ''}
        onChange={(next) => onChange(String(normalizeDisplaySize(next)))}
      />
      <NumberInput
        label={label}
        disabled={disabled}
        value={size}
        onChange={(next) => onChange(String(normalizeDisplaySize(next)))}
        min={DISPLAY_SIZE_MIN}
        max={DISPLAY_SIZE_MAX}
      />
    </DsLayoutStack>
  );
}
