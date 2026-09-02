import type { ComponentType, ReactNode } from 'react';
import type { IconProps } from '@tabler/icons-react';
import type { ZodSchema } from 'zod';
import type { Block, ColumnData } from '@/lib/types/page-content';
import type { SectionSettings } from '@/features/page/blocks/section-schema';

/**
 * Props interface for block editor components.
 * Receives the section ID and current props for editing.
 */
export interface BlockEditorProps<T = Record<string, unknown>> {
  sectionId: string;
  props: Partial<T>;
  /** Whether the section content is expanded (not collapsed) */
  isExpanded?: boolean;
}

/**
 * Props for canvas-first previews rendered directly in PageEditor.
 * These previews must not own persistence; settings are edited separately.
 */
export interface BlockCanvasPreviewProps<T = Record<string, unknown>> {
  sectionId: string;
  props: Partial<T>;
  settings: SectionSettings;
  isSelected?: boolean;
}

/**
 * Props for split-mode block settings.
 * Shared props update the structure document; localized props update the locale document.
 */
export interface BlockSettingsEditorProps<T = Record<string, unknown>> {
  sectionId: string;
  props: Partial<T>;
  settings: SectionSettings;
  updateSharedProps: (props: Record<string, unknown>) => void;
  updateLocalizedProps: (props: Record<string, unknown>) => void;
  updateSettings: (settings: Partial<SectionSettings>) => void;
}

export interface BlockSettingsSurfaceProps<T = Record<string, unknown>> extends BlockSettingsEditorProps<T> {
  opened: boolean;
  title: string;
  sectionSettings: ReactNode;
  onClose: () => void;
}

/**
 * Props interface for block view components.
 * Receives raw props that need to be parsed.
 * Special blocks may also receive content (rich-text) or columns (columns).
 */
export interface BlockViewProps {
  sectionId?: string;
  props: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale?: string;
  content?: Block[];
  columns?: ColumnData[];
}

export type BlockViewComponent = (props: BlockViewProps) => ReactNode | Promise<ReactNode>;

/**
 * Block category for organization.
 */
export type BlockCategory = 'content' | 'data' | 'layout';

/**
 * Block definition that describes a complete block module.
 * Each block type should export a definition conforming to this interface.
 */
export interface BlockDefinition<T = unknown> {
  /** Unique type identifier matching SectionType */
  type: string;

  /** Human-readable label for the block */
  label: string;

  /** Icon component for menus and headers */
  icon: ComponentType<IconProps>;

  /** Category for grouping blocks */
  category: BlockCategory;

  /** Zod schema for props validation */
  schema: ZodSchema<T>;

  /** Parser function that applies defaults */
  parse: (props: unknown) => T;

  /** Editor component for settings UI */
  Editor: ComponentType<BlockEditorProps<T>>;

  /** Optional canvas preview for split-mode editing */
  CanvasPreview?: ComponentType<BlockCanvasPreviewProps<T>>;

  /** Optional block settings panel for split-mode editing */
  SettingsEditor?: ComponentType<BlockSettingsEditorProps<T>>;

  /** Optional dedicated settings workspace for complex blocks */
  SettingsSurface?: ComponentType<BlockSettingsSurfaceProps<T>>;

  /** View component for rendering */
  View: BlockViewComponent;

  /** Whether this block can be nested inside columns (default: true) */
  allowNested?: boolean;
}

/**
 * Type for the block registry object.
 */
export type BlockRegistry = Record<string, BlockDefinition<unknown>>;
