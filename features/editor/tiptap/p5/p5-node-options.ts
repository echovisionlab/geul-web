import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import type { ExecutableSelectionMenuLabels, ExecutableSelectionMenuRegistry } from '../menus/executable';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';
import type { P5PreviewRuntimeFactory } from './p5-preview-runtime';
import { P5_CAPABILITIES, type P5Capability } from './p5-capabilities';

export type P5SketchMode = 'edit' | 'source' | 'preview';

export interface P5SketchLabels {
  title: string;
  edit: string;
  source: string;
  preview: string;
  run: string;
  stop: string;
  restart: string;
  apply: string;
  copy: string;
  resetOriginal: string;
  sourceInput: string;
  copied: string;
  running: string;
  stopped: string;
  error: string;
  resizeLeft: string;
  resizeRight: string;
  capabilities: string;
  capabilitiesDescription: string;
  suggestedByCode: string;
  unsupportedCapability: string;
  capabilityLabels: Record<P5Capability, string>;
}

export interface P5SketchOptions {
  labels?: Partial<P5SketchLabels>;
  runtimeFactory?: P5PreviewRuntimeFactory;
  autoRunReadOnly?: boolean;
  maxSourceLength?: number;
  selectionMenuRegistry?: ExecutableSelectionMenuRegistry;
  selectionMenuLabels?: Pick<
    ExecutableSelectionMenuLabels,
    'deleteBlock' | 'alignment' | 'alignLeft' | 'alignCenter' | 'alignRight'
  >;
  authoringMode?: EditorAuthoringMode | null;
}

export interface InsertP5SketchOptions {
  title?: string;
  source?: string;
  mode?: P5SketchMode;
  previewHeight?: number;
  previewWidth?: string | number;
  textAlignment?: ContextualBlockAlignment;
  capabilities?: readonly P5Capability[] | string;
  blockId?: string;
}

const LABEL_KEYS = [
  'title',
  'edit',
  'source',
  'preview',
  'run',
  'stop',
  'restart',
  'apply',
  'copy',
  'resetOriginal',
  'sourceInput',
  'copied',
  'running',
  'stopped',
  'error',
  'resizeLeft',
  'resizeRight',
  'capabilities',
  'capabilitiesDescription',
  'suggestedByCode',
  'unsupportedCapability',
] as const satisfies readonly (keyof P5SketchLabels)[];

function isNonEmptyLabel(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function requireP5SketchLabels(labels: Partial<P5SketchLabels> | undefined): P5SketchLabels {
  const missing = LABEL_KEYS.filter((key) => !isNonEmptyLabel(labels?.[key]));
  const missingCapabilities = P5_CAPABILITIES.filter(
    (capability) => !isNonEmptyLabel(labels?.capabilityLabels?.[capability]),
  );
  if (labels && missing.length === 0 && missingCapabilities.length === 0) {
    return labels as P5SketchLabels;
  }
  throw new Error(
    `p5Sketch labels are required: ${[...missing, ...missingCapabilities.map((value) => `capabilityLabels.${value}`)].join(', ')}`,
  );
}
