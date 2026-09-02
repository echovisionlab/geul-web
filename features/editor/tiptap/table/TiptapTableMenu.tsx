'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Group, Paper } from '@mantine/core';
import type { Editor } from '@tiptap/core';
import { CellSelection, selectedRect } from '@tiptap/pm/tables';
import { BubbleMenu } from '@tiptap/react/menus';
import { useTranslations } from 'next-intl';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowsJoin,
  IconArrowsSplit,
  IconColumns,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconTable,
  IconTableColumn,
  IconTableMinus,
  IconTableOptions,
  IconTableRow,
  IconTrash,
} from '@tabler/icons-react';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { IconButton } from '@/components/core/IconButton';
import {
  EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS,
  EditorToolbarDropdownTarget,
  EditorToolbarTooltip,
  type EditorToolbarShortcutHint,
} from '@/features/editor/toolbars/EditorToolbarTooltip';
import {
  useTiptapBubbleMenu,
  useSelectionToolbarEditorTabBridge,
  useSelectionToolbarNavigation,
} from '../menus/useSelectionToolbarNavigation';
import type { TableTextAlignment } from './table-commands';
import classes from './TiptapTable.module.css';

const TABLE_BUBBLE_MENU_OPTIONS = { placement: 'top', offset: 8, flip: true, shift: true } as const;

function shouldShowTableMenu({ editor }: { editor: Editor }): boolean {
  return editor.isEditable && editor.state.selection instanceof CellSelection;
}

function isTableAlignment(value: unknown): value is TableTextAlignment {
  return value === 'left' || value === 'center' || value === 'right';
}

function alignmentOf(value: unknown): TableTextAlignment {
  return isTableAlignment(value) ? value : 'left';
}

function uniformSelectedCellAlignment(editor: Editor): TableTextAlignment | undefined {
  const alignments = new Set<TableTextAlignment>();
  const selection = editor.state.selection;
  if (selection instanceof CellSelection) {
    selection.forEachCell((node) => alignments.add(alignmentOf(node.attrs.textAlignment)));
  } else {
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      const role = node.type.spec.tableRole;
      if (role === 'cell' || role === 'header_cell') {
        alignments.add(alignmentOf(node.attrs.textAlignment));
        break;
      }
    }
  }
  return alignments.size === 1 ? alignments.values().next().value : undefined;
}

function selectedTableAlignment(editor: Editor): TableTextAlignment {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.spec.tableRole === 'table') {
      return alignmentOf(node.attrs.textAlignment);
    }
  }
  return 'left';
}

function setTableAlignmentAndRestoreFocus(editor: Editor, alignment: TableTextAlignment): void {
  const selection = editor.state.selection;
  const cellSelection =
    selection instanceof CellSelection ? { anchor: selection.$anchorCell.pos, head: selection.$headCell.pos } : null;
  editor.commands.setTableAlignment(alignment);
  editor.commands.focus();
  if (cellSelection) {
    queueMicrotask(() => {
      if (editor.isDestroyed) {
        return;
      }
      const restored = CellSelection.create(editor.state.doc, cellSelection.anchor, cellSelection.head);
      if (!restored.eq(editor.state.selection)) {
        editor.view.dispatch(editor.state.tr.setSelection(restored).setMeta('addToHistory', false));
      }
    });
  }
}

function selectedCellsAreHeaders(editor: Editor, axis: 'row' | 'column'): boolean {
  const rect = selectedRect(editor.state);
  const cells = rect.map.cellsInRect(
    axis === 'row'
      ? { left: 0, top: rect.top, right: rect.map.width, bottom: rect.bottom }
      : { left: rect.left, top: 0, right: rect.right, bottom: rect.map.height },
  );
  return (
    cells.length > 0 && cells.every((position) => rect.table.nodeAt(position)?.type.spec.tableRole === 'header_cell')
  );
}

type AvailableTableAction = {
  unavailable?: false;
  unavailableReason?: undefined;
  onClick: () => void;
};

type UnavailableTableAction = {
  unavailable: true;
  unavailableReason: string;
  onClick?: undefined;
};

type TableActionProps = {
  active?: boolean;
  children: ReactNode;
  label: string;
  pressed?: boolean;
  testId: string;
  shortcut?: EditorToolbarShortcutHint;
} & (AvailableTableAction | UnavailableTableAction);

function TableAction({
  active = false,
  children,
  label,
  pressed,
  testId,
  shortcut,
  unavailable = false,
  unavailableReason,
  onClick,
}: TableActionProps) {
  const tooltipLabel = unavailable ? `${label}: ${unavailableReason}` : label;
  return (
    <EditorToolbarTooltip label={tooltipLabel} shortcut={shortcut}>
      <span className={classes.actionTarget} data-unavailable={unavailable || undefined}>
        <IconButton
          label={label}
          tone={active ? 'accent' : 'neutral'}
          emphasis={active ? 'strong' : 'low'}
          size="sm"
          disabled={unavailable}
          tabIndex={unavailable ? -1 : undefined}
          aria-pressed={pressed}
          data-selection-toolbar-action=""
          data-testid={testId}
          data-unavailable-reason={unavailableReason}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {children}
        </IconButton>
      </span>
    </EditorToolbarTooltip>
  );
}

/** Compact table-only menu that is limited to table selections. */
export function TiptapTableMenu({ editor }: { editor: Editor }) {
  const labels = useTranslations('editorCommon.editor.table');
  const menu = useTiptapBubbleMenu(editor, 'tiptap-table-menu');
  const dismissTableMenu = menu.hide;
  const navigation = useSelectionToolbarNavigation({ onEscape: dismissTableMenu });
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((revision) => revision + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const menuEligible = editor.isEditable && editor.state.selection instanceof CellSelection;
  useSelectionToolbarEditorTabBridge(editor.view.dom, navigation.focusFirstAction, menuEligible, dismissTableMenu);

  if (!menuEligible) {
    return null;
  }
  const alignment = uniformSelectedCellAlignment(editor);
  const tableAlignment = selectedTableAlignment(editor);
  const headerRow = selectedCellsAreHeaders(editor, 'row');
  const headerColumn = selectedCellsAreHeaders(editor, 'column');

  return (
    <BubbleMenu
      editor={editor}
      pluginKey={menu.pluginKey}
      updateDelay={0}
      shouldShow={shouldShowTableMenu}
      options={TABLE_BUBBLE_MENU_OPTIONS}
    >
      <Paper
        ref={navigation.toolbarRef}
        className={classes.menu}
        withBorder
        shadow="sm"
        p={4}
        radius="sm"
        role="toolbar"
        aria-label={labels('toolbarLabel')}
        data-testid="tiptap-table-menu"
        onKeyDownCapture={navigation.onToolbarKeyDown}
        onFocusCapture={navigation.onToolbarFocusCapture}
      >
        <Group className={classes.menuGroups} gap={2} wrap="nowrap">
          <DropdownMenu size="standard" placement="bottom-start">
            <EditorToolbarDropdownTarget label={labels('toolbarLabel')}>
              {(targetRef) => (
                <IconButton
                  ref={targetRef}
                  label={labels('toolbarLabel')}
                  tone="neutral"
                  emphasis="low"
                  size="sm"
                  data-selection-toolbar-action=""
                  data-testid="tiptap-table-options"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <IconTableOptions size={16} />
                </IconButton>
              )}
            </EditorToolbarDropdownTarget>
            <DropdownMenu.Dropdown>
              <DropdownMenu.Item
                icon={<IconRowInsertTop size={16} />}
                data-testid="tiptap-table-add-row-before"
                onClick={() => editor.commands.addTableRowBefore()}
              >
                {labels('addRowAbove')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconRowInsertBottom size={16} />}
                data-testid="tiptap-table-add-row-after"
                onClick={() => editor.commands.addTableRowAfter()}
              >
                {labels('addRowBelow')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconTableRow size={16} />}
                data-testid="tiptap-table-delete-row"
                onClick={() => editor.commands.deleteTableRow()}
              >
                {labels('deleteRow')}
              </DropdownMenu.Item>
              <DropdownMenu.Divider />
              <DropdownMenu.Item
                icon={<IconColumnInsertLeft size={16} />}
                data-testid="tiptap-table-add-column-before"
                onClick={() => editor.commands.addTableColumnBefore()}
              >
                {labels('addColumnLeft')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconColumnInsertRight size={16} />}
                data-testid="tiptap-table-add-column-after"
                onClick={() => editor.commands.addTableColumnAfter()}
              >
                {labels('addColumnRight')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconTableColumn size={16} />}
                data-testid="tiptap-table-delete-column"
                onClick={() => editor.commands.deleteTableColumn()}
              >
                {labels('deleteColumn')}
              </DropdownMenu.Item>
              <DropdownMenu.Divider />
              <DropdownMenu.Item
                icon={<IconTable size={16} />}
                selected={headerRow}
                data-testid="tiptap-table-header-row"
                onClick={() => editor.commands.toggleTableHeaderRow()}
              >
                {labels('toggleHeaderRow')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconColumns size={16} />}
                selected={headerColumn}
                data-testid="tiptap-table-header-column"
                onClick={() => editor.commands.toggleTableHeaderColumn()}
              >
                {labels('toggleHeaderColumn')}
              </DropdownMenu.Item>
              <DropdownMenu.Divider />
              <DropdownMenu.Item
                icon={<IconTableRow size={16} />}
                data-testid="tiptap-table-select-row"
                onClick={() => editor.commands.selectTableRow()}
              >
                {labels('selectRow')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconTableColumn size={16} />}
                data-testid="tiptap-table-select-column"
                onClick={() => editor.commands.selectTableColumn()}
              >
                {labels('selectColumn')}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                icon={<IconTableMinus size={16} />}
                data-testid="tiptap-table-select"
                onClick={() => editor.commands.selectTable()}
              >
                {labels('selectTable')}
              </DropdownMenu.Item>
              <DropdownMenu.Divider />
              <DropdownMenu.Item icon={<IconArrowsJoin size={16} />} data-testid="tiptap-table-merge-cells" disabled>
                {labels('mergeCells')}: {labels('unavailable')}
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<IconArrowsSplit size={16} />} data-testid="tiptap-table-split-cell" disabled>
                {labels('splitCell')}: {labels('unavailable')}
              </DropdownMenu.Item>
            </DropdownMenu.Dropdown>
          </DropdownMenu>

          <span className={classes.separator} aria-hidden="true" />

          <Group gap={2} wrap="nowrap">
            <TableAction
              active={tableAlignment === 'left'}
              label={labels('alignTableLeft')}
              pressed={tableAlignment === 'left'}
              testId="tiptap-table-layout-left"
              onClick={() => setTableAlignmentAndRestoreFocus(editor, 'left')}
            >
              <IconAlignLeft size={16} />
            </TableAction>
            <TableAction
              active={tableAlignment === 'center'}
              label={labels('alignTableCenter')}
              pressed={tableAlignment === 'center'}
              testId="tiptap-table-layout-center"
              onClick={() => setTableAlignmentAndRestoreFocus(editor, 'center')}
            >
              <IconAlignCenter size={16} />
            </TableAction>
            <TableAction
              active={tableAlignment === 'right'}
              label={labels('alignTableRight')}
              pressed={tableAlignment === 'right'}
              testId="tiptap-table-layout-right"
              onClick={() => setTableAlignmentAndRestoreFocus(editor, 'right')}
            >
              <IconAlignRight size={16} />
            </TableAction>
          </Group>

          <span className={classes.separator} aria-hidden="true" />

          <Group gap={2} wrap="nowrap">
            <TableAction
              active={alignment === 'left'}
              label={labels('alignLeft')}
              shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
              pressed={alignment === 'left'}
              testId="tiptap-table-align-left"
              onClick={() => editor.commands.setTableCellAlignment('left')}
            >
              <IconAlignLeft size={16} />
            </TableAction>
            <TableAction
              active={alignment === 'center'}
              label={labels('alignCenter')}
              shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
              pressed={alignment === 'center'}
              testId="tiptap-table-align-center"
              onClick={() => editor.commands.setTableCellAlignment('center')}
            >
              <IconAlignCenter size={16} />
            </TableAction>
            <TableAction
              active={alignment === 'right'}
              label={labels('alignRight')}
              shortcut={EDITOR_TOOLBAR_ALIGNMENT_CYCLE_SHORTCUTS}
              pressed={alignment === 'right'}
              testId="tiptap-table-align-right"
              onClick={() => editor.commands.setTableCellAlignment('right')}
            >
              <IconAlignRight size={16} />
            </TableAction>
          </Group>

          <span className={classes.separator} aria-hidden="true" />

          <Group gap={2} wrap="nowrap">
            <TableAction
              label={labels('deleteTable')}
              testId="tiptap-table-delete"
              onClick={() => editor.commands.removeTable()}
            >
              <IconTrash size={16} />
            </TableAction>
          </Group>
        </Group>
      </Paper>
    </BubbleMenu>
  );
}
