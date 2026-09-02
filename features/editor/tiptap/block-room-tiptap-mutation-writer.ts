import { richTextBlockCatalog } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import type { BlockRoomProseMirrorBridge, ProseMirrorBlockDescriptor } from './block-room-prosemirror-bridge';
import {
  array,
  decodeCatalogValue,
  jsonEqual,
  object,
  type CatalogFieldSpec,
  type JsonObject,
  type TiptapBlockSnapshot,
} from './block-room-tiptap-codec';
import { applyCollaborativeTextDiff, applyInlineContent, applyJsonDiff, replaceArray } from './block-room-tiptap-diff';
import { richTextProseMirrorAdapterForProtoCase } from './block-room-prosemirror-registry';
import { SHADER_STAGE_DEFINITIONS } from './shader/shader-program';

interface PositionedBlockDescriptor extends ProseMirrorBlockDescriptor {
  readonly parentId: string | null;
  readonly position: number;
}

export function applyTiptapBlockPayload(
  bridge: BlockRoomProseMirrorBridge,
  block: TiptapBlockSnapshot,
  previous: PositionedBlockDescriptor,
  payload: { base: JsonObject; locale: JsonObject },
): void {
  const previousBaseProps = object(previous.basePayload.props);
  const previousLocaleProps = object(previous.localePayload?.props);
  const baseProps = object(payload.base.props);
  const localeProps = object(payload.locale.props);
  const shape = richTextProseMirrorAdapterForProtoCase(block.protoCase).contentShape;
  for (const field of new Set([...Object.keys(previousBaseProps), ...Object.keys(baseProps)])) {
    if ((shape === 'source-text' && field === 'source') || (shape === 'shader' && field === 'stages')) {
      continue;
    }
    applyJsonDiff(bridge, block.id, block.kind, 'base', `props.${field}`, previousBaseProps[field], baseProps[field]);
  }
  for (const field of new Set([...Object.keys(previousLocaleProps), ...Object.keys(localeProps)])) {
    applyJsonDiff(
      bridge,
      block.id,
      block.kind,
      'locale',
      `props.${field}`,
      previousLocaleProps[field],
      localeProps[field],
    );
  }
  if (shape === 'inline') {
    applyInlineContent(
      bridge,
      block.id,
      'content',
      array(previous.localePayload?.content),
      array(payload.locale.content),
    );
  } else if (shape === 'plain-text') {
    applyCollaborativeTextDiff(
      bridge,
      { blockId: block.id, scope: 'locale', path: 'content' },
      previous.localePayload?.content,
      payload.locale.content,
    );
  } else if (shape === 'table') {
    const beforeBaseRows = array(object(previous.basePayload.content).rows);
    const afterBaseRows = array(object(payload.base.content).rows);
    const beforeLocaleRows = array(object(previous.localePayload?.content).rows);
    const afterLocaleRows = array(object(payload.locale.content).rows);
    const sameTopology =
      beforeBaseRows.length === afterBaseRows.length &&
      beforeLocaleRows.length === afterLocaleRows.length &&
      beforeBaseRows.every(
        (row, rowIndex) =>
          array(object(row).cells).length === array(object(afterBaseRows[rowIndex]).cells).length &&
          array(object(beforeLocaleRows[rowIndex]).cells).length ===
            array(object(afterLocaleRows[rowIndex]).cells).length,
      );
    if (!sameTopology) {
      replaceArray(bridge, block.id, 'base', 'content.rows', beforeBaseRows, afterBaseRows);
      replaceArray(bridge, block.id, 'locale', 'content.rows', beforeLocaleRows, afterLocaleRows);
    } else {
      beforeBaseRows.forEach((beforeRowValue, rowIndex) => {
        const beforeCells = array(object(beforeRowValue).cells);
        const afterCells = array(object(afterBaseRows[rowIndex]).cells);
        const beforeLocaleCells = array(object(beforeLocaleRows[rowIndex]).cells);
        const afterLocaleCells = array(object(afterLocaleRows[rowIndex]).cells);
        beforeCells.forEach((beforeCellValue, cellIndex) => {
          const beforeCell = object(beforeCellValue);
          const afterCell = object(afterCells[cellIndex]);
          applyJsonDiff(
            bridge,
            block.id,
            block.kind,
            'base',
            `content.rows[${rowIndex}].cells[${cellIndex}].header`,
            beforeCell.header,
            afterCell.header,
          );
          const beforeProps = object(beforeCell.props);
          const afterProps = object(afterCell.props);
          for (const field of new Set([...Object.keys(beforeProps), ...Object.keys(afterProps)])) {
            applyJsonDiff(
              bridge,
              block.id,
              block.kind,
              'base',
              `content.rows[${rowIndex}].cells[${cellIndex}].props.${field}`,
              beforeProps[field],
              afterProps[field],
            );
          }
          applyInlineContent(
            bridge,
            block.id,
            `content.rows[${rowIndex}].cells[${cellIndex}].content`,
            array(object(beforeLocaleCells[cellIndex]).content),
            array(object(afterLocaleCells[cellIndex]).content),
          );
        });
      });
    }
  } else if (shape === 'source-text') {
    applyCollaborativeTextDiff(
      bridge,
      { blockId: block.id, scope: 'base', path: 'props.source' },
      previousBaseProps.source,
      baseProps.source,
    );
  } else if (shape === 'shader') {
    const beforeStages = array(previousBaseProps.stages);
    const afterStages = array(baseProps.stages);
    const stageSpec = (richTextBlockCatalog.shader.fields as Readonly<Record<string, CatalogFieldSpec>>).stages!;
    const decodedBeforeStages = array(decodeCatalogValue(stageSpec, [...beforeStages]));
    const decodedAfterStages = array(decodeCatalogValue(stageSpec, [...afterStages]));
    if (
      beforeStages.length !== SHADER_STAGE_DEFINITIONS.length ||
      afterStages.length !== SHADER_STAGE_DEFINITIONS.length
    ) {
      throw new Error('Generated Shader stage topology changed.');
    }
    beforeStages.forEach((beforeValue, index) => {
      const before = object(beforeValue);
      const after = object(afterStages[index]);
      const decodedBefore = object(decodedBeforeStages[index]);
      const decodedAfter = object(decodedAfterStages[index]);
      if (!jsonEqual(decodedBefore.kind, decodedAfter.kind)) {
        throw new Error(`Generated Shader stage ${index} kind changed.`);
      }
      applyCollaborativeTextDiff(
        bridge,
        { blockId: block.id, scope: 'base', path: `props.stages[${index}].source` },
        before.source,
        after.source,
      );
      if (!jsonEqual(decodedBefore.channels, decodedAfter.channels)) {
        replaceArray(
          bridge,
          block.id,
          'base',
          `props.stages[${index}].channels`,
          array(before.channels),
          array(after.channels),
        );
      }
    });
  }
}
