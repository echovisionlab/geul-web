import * as Y from 'yjs';
import { richTextBlockCatalog } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { decodeCatalogValue, type CatalogFieldSpec } from './block-room-tiptap-codec';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface TextBinding {
  text: Y.Text;
  positions: number[];
}

/** Keep text groups structurally separate: empty cells/stages cannot borrow a neighbor's position. */
function bindings(document: Y.Doc, blockId: string, block: ProseMirrorNode): TextBinding[] {
  const root = document.getMap('block-document');
  const payloadAt = (key: string): Y.Map<unknown> | null => {
    const nodes = root.get(key);
    const node = nodes instanceof Y.Map ? nodes.get(blockId) : null;
    const payload = node instanceof Y.Map ? node.get('payload') : null;
    return payload instanceof Y.Map ? payload : null;
  };
  const locale = payloadAt('localeOverlay');
  const base = payloadAt('baseNodes');
  const payload = block.firstChild;
  if (!payload) {
    return [];
  }
  const result: TextBinding[] = [];
  const bind = (raw: unknown, node: ProseMirrorNode, start: number): void => {
    const texts: Y.Text[] = [];
    const collect = (value: unknown): void => {
      if (value instanceof Y.Text) {
        texts.push(value);
      } else if (value instanceof Y.Array) {
        value.forEach(collect);
      } else if (value instanceof Y.Map) {
        for (const key of ['content', 'text', 'link', 'mathInline', 'latex', 'source']) {
          collect(value.get(key));
        }
      }
    };
    collect(raw);
    const positions: number[] = [];
    let content = '';
    node.descendants((child, pos) => {
      if (child.isText) {
        for (let index = 0; index < child.text!.length; index++) {
          positions.push(start + 1 + pos + index);
        }
        content += child.text;
      }
    });
    if (texts.map((text) => text.toString()).join('') !== content) {
      return;
    }
    let offset = 0;
    for (const text of texts) {
      const mapped = positions.slice(offset, offset + text.length);
      const boundary = positions[offset] ?? (positions.length ? positions.at(-1)! + 1 : start + 1);
      offset += text.length;
      mapped.push(mapped.length ? mapped.at(-1)! + 1 : boundary);
      result.push({ text, positions: mapped });
    }
  };
  if (payload.type.name === 'table') {
    const content = locale?.get('content');
    const rows = content instanceof Y.Map ? content.get('rows') : null;
    if (!(rows instanceof Y.Array)) {
      return [];
    }
    payload.forEach((row, rowOffset) => {
      const rawRow = rows
        .toArray()
        .find((candidate) => candidate instanceof Y.Map && candidate.get('rowId') === row.attrs.id);
      const cells = rawRow instanceof Y.Map ? rawRow.get('cells') : null;
      if (!(cells instanceof Y.Array)) {
        return;
      }
      row.forEach((cell, cellOffset) => {
        const rawCell = cells
          .toArray()
          .find((candidate) => candidate instanceof Y.Map && candidate.get('cellId') === cell.attrs.id);
        if (rawCell instanceof Y.Map && cell.childCount === 1 && cell.firstChild?.isTextblock) {
          bind(rawCell.get('content'), cell.firstChild, rowOffset + cellOffset + 3);
        }
      });
    });
  } else if (payload.type.name === 'shader') {
    const props = base?.get('props');
    const stages = props instanceof Y.Map ? props.get('stages') : null;
    if (stages instanceof Y.Array) {
      payload.forEach((stage, offset) => {
        const kind = SHADER_STAGE_DEFINITIONS.find(([, name]) => name === stage.type.name)?.[0];
        const spec = (richTextBlockCatalog.shader.fields.stages as CatalogFieldSpec).items?.fields?.kind;
        const rawStage = stages.toArray().find((candidate) => {
          const value = candidate instanceof Y.Map ? candidate.get('kind') : null;
          return (
            spec && (typeof value === 'string' || typeof value === 'number') && decodeCatalogValue(spec, value) === kind
          );
        });
        if (rawStage instanceof Y.Map) {
          bind(rawStage.get('source'), stage, offset + 1);
        }
      });
    }
  } else {
    const props = base?.get('props');
    bind(locale?.get('content') ?? (props instanceof Y.Map ? props.get('source') : null), payload, 0);
  }
  return result;
}

export function relativeBlockPoint(
  document: Y.Doc,
  id: string,
  block: ProseMirrorNode,
  offset: number,
): number[] | undefined {
  for (const binding of bindings(document, id, block)) {
    const index = binding.positions.indexOf(offset);
    if (index >= 0) {
      return Array.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(binding.text, index)));
    }
  }
  return undefined;
}

export function resolveRelativeBlockPoint(
  document: Y.Doc,
  id: string,
  block: ProseMirrorNode,
  encoded: unknown,
): number | null {
  if (
    !Array.isArray(encoded) ||
    encoded.length > 256 ||
    !encoded.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return null;
  }
  try {
    const absolute = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(Uint8Array.from(encoded)),
      document,
    );
    if (!absolute) {
      return null;
    }
    const binding = bindings(document, id, block).find(({ text }) => text === absolute.type);
    return binding?.positions[absolute.index] ?? null;
  } catch {
    return null;
  }
}
