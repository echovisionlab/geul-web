import { Extension, mergeAttributes, type Attribute, type Extensions } from '@tiptap/core';
import { WireTable, WireTableCell, WireTableHeader, WireTableRow } from '../wire-schema';
import classes from './TiptapTable.module.css';

const tableColors = new Set(['default', 'gray', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
const tableAlignments = new Set(['left', 'center', 'right']);

function parseTableInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseColwidth(value: string | null): number[] | null {
  if (!value) {
    return null;
  }
  const widths = value.split(',').map((item) => Number(item.trim()));
  return widths.length > 0 && widths.every((width) => Number.isFinite(width) && width > 0) ? widths : null;
}

function tableCellAttributes(): Record<string, Attribute> {
  return {
    id: {
      default: null,
      rendered: false,
    },
    textColor: {
      default: 'default',
      parseHTML: (element) => {
        const value = element.getAttribute('data-text-color');
        return value && tableColors.has(value) ? value : 'default';
      },
      renderHTML: ({ textColor }) => (textColor === 'default' ? {} : { 'data-text-color': textColor }),
    },
    backgroundColor: {
      default: 'default',
      parseHTML: (element) => {
        const value = element.getAttribute('data-background-color');
        return value && tableColors.has(value) ? value : 'default';
      },
      renderHTML: ({ backgroundColor }) =>
        backgroundColor === 'default' ? {} : { 'data-background-color': backgroundColor },
    },
    textAlignment: {
      default: 'left',
      parseHTML: (element) => {
        const value = element.getAttribute('data-text-alignment');
        return value && tableAlignments.has(value) ? value : 'left';
      },
      renderHTML: ({ textAlignment }) => (textAlignment === 'left' ? {} : { 'data-text-alignment': textAlignment }),
    },
    colspan: {
      default: 1,
      parseHTML: (element) => parseTableInteger(element.getAttribute('colspan'), 1),
      renderHTML: ({ colspan }) => (colspan === 1 ? {} : { colspan }),
    },
    rowspan: {
      default: 1,
      parseHTML: (element) => parseTableInteger(element.getAttribute('rowspan'), 1),
      renderHTML: ({ rowspan }) => (rowspan === 1 ? {} : { rowspan }),
    },
    colwidth: {
      default: null,
      // ProseMirror's historical DOM used data-colwidth; accept the older
      // plain colwidth form too, then always emit canonical data-colwidth.
      parseHTML: (element) => parseColwidth(element.getAttribute('data-colwidth') ?? element.getAttribute('colwidth')),
      renderHTML: ({ colwidth }) =>
        Array.isArray(colwidth) && colwidth.length > 0 ? { 'data-colwidth': colwidth.join(',') } : {},
    },
  };
}

/** Shared DOM schema for SSR and the live table; no node views or editing plugins. */
export function createTiptapTablePresentationExtensions(): Extensions {
  const TableSchema = Extension.create({
    name: 'tableSchema',
    extendNodeSchema(extension) {
      const tableRoles: Record<string, string> = {
        table: 'table',
        tableRow: 'row',
        tableCell: 'cell',
        tableHeader: 'header_cell',
      };
      const tableRole = tableRoles[extension.name];
      return tableRole ? { tableRole } : {};
    },
  });
  const TableRow = WireTableRow.extend({});
  const TableCell = WireTableCell.extend({
    addAttributes() {
      return tableCellAttributes();
    },
    renderHTML({ HTMLAttributes }) {
      return ['td', mergeAttributes(HTMLAttributes, { class: classes.cell }), 0];
    },
  });
  const TableHeader = WireTableHeader.extend({
    addAttributes() {
      return tableCellAttributes();
    },
    renderHTML({ HTMLAttributes }) {
      return ['th', mergeAttributes(HTMLAttributes, { class: classes.cell }), 0];
    },
  });

  return [WireTable, TableRow, TableHeader, TableCell, TableSchema];
}
