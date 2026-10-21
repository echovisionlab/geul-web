import { ReorderGutter } from '@/components/core/Sortable';
import { createTiptapTablePresentationExtensions } from './table/table-presentation';
import { readTableColumnWidths } from './table/percentage-column-resizing';
import { TABLE_MIN_COLUMN_WIDTH_PX } from './table/table-constants';
import tableClasses from './table/TiptapTable.module.css';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { createElement, Fragment, type ReactNode, type CSSProperties } from 'react';
import { getSchema, type JSONContent } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import { createTiptapWireExtensions } from './wire-schema';
import classes from './TiptapEditor.module.css';
import blockClasses from './TiptapBlockContainerNodeView.module.css';

let schema: ReturnType<typeof getSchema> | undefined;
function wireSchema() {
  return (schema ??= getSchema([
    ...createTiptapWireExtensions().filter(
      (extension) => !['table', 'tableRow', 'tableCell', 'tableHeader'].includes(extension.name),
    ),
    ...createTiptapTablePresentationExtensions(),
  ]));
}

function reactAttributes(attributes: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => {
      if (key === 'class') {
        return ['className', value];
      }
      if (key === 'style' && typeof value === 'string') {
        const style: Record<string, string> = {};
        for (const declaration of value.split(';')) {
          const colon = declaration.indexOf(':');
          if (colon > 0) {
            style[
              declaration
                .slice(0, colon)
                .trim()
                .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
            ] = declaration.slice(colon + 1).trim();
          }
        }
        return ['style', style as CSSProperties];
      }
      if (key === 'href') {
        return ['href', normalizeRichTextHref(String(value)) || undefined];
      }
      return [key === 'colspan' ? 'colSpan' : key === 'rowspan' ? 'rowSpan' : key, value];
    }),
  );
}

function renderSpec(spec: DOMOutputSpec | number, children: ReactNode): ReactNode {
  if (spec === 0) {
    return children;
  }
  if (typeof spec === 'string') {
    return spec;
  }
  if (!Array.isArray(spec)) {
    return null;
  }
  const [tag, ...rest] = spec;
  const attributes = rest[0] && typeof rest[0] === 'object' && !Array.isArray(rest[0]) ? rest.shift() : {};
  return createElement(
    tag,
    reactAttributes(attributes as Record<string, unknown>),
    ...rest.map((child, index) => <Fragment key={index}>{renderSpec(child as DOMOutputSpec, children)}</Fragment>),
  );
}

function renderNode(node: JSONContent, blocks: ReadonlyMap<string, LocalizedRichTextBlock>): ReactNode {
  const children = node.content?.map((child, index) => (
    <Fragment key={child.attrs?.id ?? index}>{renderNode(child, blocks)}</Fragment>
  ));
  if (node.type === 'doc') {
    return children;
  }
  if (node.type === 'blockContainer') {
    const first = node.content?.[0];
    const block = blocks.get(String(node.attrs?.id));
    const special =
      block &&
      (first?.type === 'externalVideo' ||
        ['code-block', 'file', 'math', 'map', 'mermaid', 'p5-sketch', 'three-scene', 'shader'].includes(block.kind));
    const body = special ? (
      <>
        <GeneratedRichTextBlockView block={{ ...block, children: [] }} allowStandaloneExternalVideo />
        {node.content?.slice(1).map((child, index) => (
          <Fragment key={index}>{renderNode(child, blocks)}</Fragment>
        ))}
      </>
    ) : (
      children
    );
    return (
      <div
        className={`editor-block-container ${blockClasses.container}`}
        data-node-type="blockContainer"
        data-id={node.attrs?.id}
      >
        <ReorderGutter>
          <div
            className={blockClasses.content}
            data-content-kind={first?.type}
            data-bg-color={first?.attrs?.backgroundColor}
            data-text-color={first?.attrs?.textColor}
          >
            <div data-node-view-content-react="">{body}</div>
          </div>
        </ReorderGutter>
      </div>
    );
  }
  if (node.type === 'table') {
    const table = wireSchema().nodeFromJSON(node);
    const widths = readTableColumnWidths(table);
    const width = Math.max(10, Math.min(100, Number(table.attrs.displaySize) || 100));
    const alignment = table.attrs.textAlignment;
    return (
      <div className={tableClasses.root} data-editor-editable="false">
        <div className={tableClasses.scroll}>
          <table
            className={tableClasses.table}
            data-text-color={table.attrs.textColor}
            style={{
              width: `${width}%`,
              minWidth: widths.length * TABLE_MIN_COLUMN_WIDTH_PX,
              marginInlineStart: alignment === 'left' ? 0 : 'auto',
              marginInlineEnd: alignment === 'right' ? 0 : 'auto',
            }}
          >
            <colgroup>
              {widths.map((value, index) => (
                <col key={index} style={{ width: `${value}%` }} />
              ))}
            </colgroup>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    );
  }
  if (node.type === 'text') {
    return (node.marks ?? []).reduceRight<ReactNode>((content, mark) => {
      const instance = wireSchema().marks[mark.type]?.create(mark.attrs);
      return instance?.type.spec.toDOM ? renderSpec(instance.type.spec.toDOM(instance, true), content) : content;
    }, node.text);
  }
  const type = node.type ? wireSchema().nodes[node.type] : undefined;
  if (type?.spec.toDOM) {
    const instance = type.create(node.attrs);
    return renderSpec(
      type.spec.toDOM(instance),
      children?.length ? children : node.type === 'paragraph' ? <br /> : null,
    );
  }
  return <div data-content-type={node.type}>{children}</div>;
}

export function TiptapSnapshot({
  content,
  locale,
  label,
  blocks = [],
}: {
  content: JSONContent;
  locale: string;
  label: string;
  blocks?: readonly LocalizedRichTextBlock[];
}) {
  const index = new Map<string, LocalizedRichTextBlock>();
  const visit = (items: readonly LocalizedRichTextBlock[]) =>
    items.forEach((block) => {
      index.set(block.id, block);
      visit(block.children);
    });
  visit(blocks);
  return (
    <div
      className={`${classes.editor} tiptap-editor`}
      data-editor-engine="tiptap"
      data-editor-editable="false"
      data-pagination-enabled="false"
    >
      <div className={classes.paper}>
        <div className={classes.surface}>
          <div
            className={`${classes.content} tiptap ProseMirror`}
            role="document"
            aria-label={label}
            lang={locale}
            contentEditable={false}
          >
            {renderNode(content, index)}
          </div>
        </div>
      </div>
    </div>
  );
}
