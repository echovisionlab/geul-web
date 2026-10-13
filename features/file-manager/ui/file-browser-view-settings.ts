import type { LayoutColumnCount } from '@/components/core/Layout/layout-contract';
import type { SelectionGridSpacing, SelectionIconSize } from '@/components/core/SelectionSurface';

export interface FileBrowserViewSettings {
  viewMode: 'grid' | 'list';
  iconSize: SelectionIconSize;
  spacing: SelectionGridSpacing;
  columns: LayoutColumnCount | 'auto';
}
export const defaultFileBrowserViewSettings: FileBrowserViewSettings = {
  viewMode: 'grid',
  iconSize: 'medium',
  spacing: 'standard',
  columns: 'auto',
};
export interface FileBrowserViewSettingsLabels {
  title: string;
  iconSize: string;
  spacing: string;
  columns: string;
  auto: string;
  small: string;
  medium: string;
  large: string;
  compact: string;
  standard: string;
  comfortable: string;
  reset: string;
}
export interface FileBrowserViewOptions {
  value: FileBrowserViewSettings;
  labels: FileBrowserViewSettingsLabels;
  onChange: (value: FileBrowserViewSettings) => void;
}
export function fileBrowserViewSettingsLabels(
  t: (key: keyof FileBrowserViewSettingsLabels) => string,
): FileBrowserViewSettingsLabels {
  return Object.fromEntries(
    [
      'title',
      'iconSize',
      'spacing',
      'columns',
      'auto',
      'small',
      'medium',
      'large',
      'compact',
      'standard',
      'comfortable',
      'reset',
    ].map((key) => [key, t(key as keyof FileBrowserViewSettingsLabels)]),
  ) as unknown as FileBrowserViewSettingsLabels;
}
export function parseFileBrowserViewSettings(raw: string | null): FileBrowserViewSettings | null {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw);
    const value = data.settings;
    if (
      data.version !== 1 ||
      !value ||
      !['grid', 'list'].includes(value.viewMode) ||
      !['small', 'medium', 'large'].includes(value.iconSize) ||
      !['compact', 'standard', 'comfortable'].includes(value.spacing) ||
      !(value.columns === 'auto' || (Number.isInteger(value.columns) && value.columns >= 1 && value.columns <= 12))
    ) {
      return null;
    }
    return { viewMode: value.viewMode, iconSize: value.iconSize, spacing: value.spacing, columns: value.columns };
  } catch {
    return null;
  }
}
