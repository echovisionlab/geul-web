import type { Attribute } from '@tiptap/core';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';
import { serializeP5Capabilities } from './p5-capabilities';
import type { P5SketchMode } from './p5-node-options';

export interface P5NodeAttributes {
  title: string;
  mode: P5SketchMode;
  capabilities: string;
  previewHeight: number;
  previewWidth: string;
  textAlignment: ContextualBlockAlignment;
}

interface P5AttributeSpec<Value> {
  default: Value;
  dataAttribute: `data-${string}`;
  normalize: (value: unknown) => Value;
  serialize: (value: Value) => string | null;
}

export function normalizeP5Mode(value: unknown): P5SketchMode {
  return value === 'source' || value === 'preview' ? value : 'edit';
}

export function normalizeP5PreviewHeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(720, Math.max(180, Math.round(parsed))) : 360;
}

export function normalizeP5PreviewWidth(value: unknown): string {
  const parsed = Number.parseInt(String(value ?? '100'), 10);
  return String(Math.min(100, Math.max(10, Number.isFinite(parsed) ? parsed : 100)));
}

export function normalizeP5Alignment(value: unknown): ContextualBlockAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

const ATTRIBUTE_SPECS = {
  title: {
    default: '',
    dataAttribute: 'data-title',
    normalize: (value) => (typeof value === 'string' ? value : ''),
    serialize: (value) => value,
  },
  mode: {
    default: 'edit',
    dataAttribute: 'data-mode',
    normalize: normalizeP5Mode,
    serialize: (value) => value,
  },
  capabilities: {
    default: '',
    dataAttribute: 'data-capabilities',
    normalize: serializeP5Capabilities,
    serialize: (value) => value || null,
  },
  previewHeight: {
    default: 360,
    dataAttribute: 'data-preview-height',
    normalize: normalizeP5PreviewHeight,
    serialize: String,
  },
  previewWidth: {
    default: '100',
    dataAttribute: 'data-preview-width',
    normalize: normalizeP5PreviewWidth,
    serialize: (value) => value,
  },
  textAlignment: {
    default: 'left',
    dataAttribute: 'data-text-alignment',
    normalize: normalizeP5Alignment,
    serialize: (value) => value,
  },
} satisfies { [Name in keyof P5NodeAttributes]: P5AttributeSpec<P5NodeAttributes[Name]> };

const attributeEntries = Object.entries(ATTRIBUTE_SPECS) as Array<
  [keyof P5NodeAttributes, P5AttributeSpec<P5NodeAttributes[keyof P5NodeAttributes]>]
>;

export function normalizeP5NodeAttributes(input: Partial<Record<keyof P5NodeAttributes, unknown>>): P5NodeAttributes {
  return Object.fromEntries(
    attributeEntries.map(([name, spec]) => [name, spec.normalize(input[name])]),
  ) as unknown as P5NodeAttributes;
}

export function createP5AttributeDefinitions(): Record<keyof P5NodeAttributes, Attribute> {
  return Object.fromEntries(
    attributeEntries.map(([name, spec]) => [
      name,
      {
        default: spec.default,
        parseHTML: (element: HTMLElement) => spec.normalize(element.getAttribute(spec.dataAttribute)),
        renderHTML: (attributes: Record<string, unknown>) => {
          const serialized = spec.serialize(spec.normalize(attributes[name]));
          return serialized === null ? {} : { [spec.dataAttribute]: serialized };
        },
      } satisfies Attribute,
    ]),
  ) as Record<keyof P5NodeAttributes, Attribute>;
}

export function createP5BlockId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `p5-${Date.now().toString(36)}`;
}
