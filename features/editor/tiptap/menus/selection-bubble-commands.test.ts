// @vitest-environment jsdom

import { Editor, type JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { CellSelection } from '@tiptap/pm/tables';
import { describe, expect, it, vi } from 'vitest';
import { createTiptapWireExtensions } from '../wire-schema';
import { createTiptapTableExtensions } from '../table';
import { SELECTION_BUBBLE_MENU_CONTROL_ORDER } from './SelectionBubbleMenu';
import {
  canShowSelectionBubbleMenu,
  createSelectionBubbleMenuCommands,
  normalizeSelectionLinkHref,
  resolveSelectionBubbleMenuState,
} from './selection-bubble-commands';

const paragraph = (text: string) => ({
  type: 'paragraph',
  attrs: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
  content: [{ type: 'text', text }],
});

const block = (id: string, text: string) => ({
  type: 'blockContainer',
  attrs: { id },
  content: [paragraph(text)],
});

const content: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'blockGroup',
      content: [block('first', 'first block'), block('second', 'selected text'), block('third', 'third block')],
    },
  ],
};

function mountEditor() {
  const element = document.createElement('div');
  document.body.append(element);
  const editor = new Editor({ element, extensions: createTiptapWireExtensions(), content });
  return {
    editor,
    destroy() {
      editor.destroy();
      element.remove();
    },
  };
}

function positions(editor: Editor, nodeName: string): number[] {
  const result: number[] = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name === nodeName) {
      result.push(position);
    }
  });
  return result;
}

function selectSecondBlockText(editor: Editor) {
  const [, secondParagraph] = positions(editor, 'paragraph');
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.create(editor.state.doc, secondParagraph + 1, secondParagraph + 9)),
  );
}

describe('Tiptap selection BubbleMenu command authority', () => {
  it('keeps the established Geul control order explicit', () => {
    expect(SELECTION_BUBBLE_MENU_CONTROL_ORDER).toEqual([
      'block-type',
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'alignment',
      'colors',
      'nest',
      'unnest',
      'link',
      'inline-math',
      'ai',
    ]);
  });

  it('shows for inline code so the code toggle remains reachable, but not for a code block or node selection', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(true);

    mounted.editor.chain().focus().toggleMark('code').run();
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(true);
    expect(resolveSelectionBubbleMenuState(mounted.editor)).toMatchObject({
      inlineCodeActive: true,
      canConvertToInlineMath: false,
      canOpenAI: false,
    });
    mounted.editor.chain().focus().toggleMark('code').run();

    const [, secondParagraph] = positions(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(NodeSelection.create(mounted.editor.state.doc, secondParagraph)),
    );
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(false);

    selectSecondBlockText(mounted.editor);
    expect(createSelectionBubbleMenuCommands(mounted.editor).setBlockType('codeBlock')).toBe(true);
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(false);

    mounted.editor.setEditable(false);
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(false);
    mounted.destroy();
  });

  it('does not show for a non-empty structural range without nonblank text', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [{ type: 'blockGroup', content: [block('blank', '   ')] }],
      },
    });
    const paragraphPosition = positions(editor, 'paragraph')[0];
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, paragraphPosition + 1, paragraphPosition + 4),
      ),
    );

    expect(canShowSelectionBubbleMenu(editor)).toBe(false);
    editor.destroy();
    element.remove();
  });

  it('does not expose formatting controls or commands for inline math source text', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'math-source' },
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'before ' },
                      { type: 'mathInline', content: [{ type: 'text', text: 'x^2' }] },
                      { type: 'text', text: ' after' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const mathPosition = positions(editor, 'mathInline')[0];
    editor.commands.setTextSelection({ from: mathPosition + 1, to: mathPosition + 4 });

    expect(canShowSelectionBubbleMenu(editor)).toBe(false);
    expect(resolveSelectionBubbleMenuState(editor)).toMatchObject({
      canFormatText: false,
      canColor: false,
      canConvertToInlineMath: false,
      canOpenAI: false,
    });
    const commands = createSelectionBubbleMenuCommands(editor);
    expect(commands.toggleTextStyle('bold')).toBe(false);
    expect(commands.setTextColor('red')).toBe(false);
    expect(commands.createLink({ href: 'https://example.invalid' })).toBe(false);
    expect(editor.state.doc.nodeAt(mathPosition)?.firstChild?.marks).toHaveLength(0);

    editor.destroy();
    element.remove();
  });

  it('uses the shared mark, color, link, alignment, math, and AI adapters', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const onAIActivate = vi.fn();
    let commands = createSelectionBubbleMenuCommands(mounted.editor, { onAIActivate });

    expect(commands.toggleTextStyle('bold')).toBe(true);
    expect(mounted.editor.isActive('bold')).toBe(true);
    expect(commands.setTextColor('red')).toBe(true);
    expect(mounted.editor.getAttributes('textColor').stringValue).toBe('red');
    expect(commands.setBackgroundColor('yellow')).toBe(true);
    expect(mounted.editor.view.dom.querySelector('[data-style-type="textColor"][stringvalue="red"]')).not.toBeNull();
    expect(
      mounted.editor.view.dom.querySelector('[data-style-type="backgroundColor"][stringvalue="yellow"]'),
    ).not.toBeNull();
    expect(commands.setAlignment('center')).toBe(true);
    expect(mounted.editor.state.doc.firstChild?.child(1).firstChild?.attrs.textAlignment).toBe('center');
    expect(commands.createLink({ href: 'example.invalid', text: 'Geul' })).toBe(true);

    commands = createSelectionBubbleMenuCommands(mounted.editor, { onAIActivate });
    expect(commands.linkHref).toBe('https://example.invalid');
    expect(commands.selectedText).toBe('Geul');
    expect(commands.openAI()).toBe(true);
    expect(onAIActivate).toHaveBeenCalledOnce();
    expect(commands.removeLink()).toBe(true);

    selectSecondBlockText(mounted.editor);
    commands = createSelectionBubbleMenuCommands(mounted.editor, { onAIActivate });
    expect(commands.convertToInlineMath()).toBe(true);
    expect(mounted.editor.state.selection).toBeInstanceOf(TextSelection);
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('mathInline');
    mounted.destroy();
  });

  it('fails closed when a captured alignment command is invoked after its text selection becomes stale', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.canAlign).toBe(true);

    const [, secondParagraph] = positions(mounted.editor, 'paragraph');
    mounted.editor.commands.setTextSelection(secondParagraph + 1);
    expect(commands.setAlignment('right')).toBe(false);
    expect(mounted.editor.state.doc.nodeAt(secondParagraph)?.attrs.textAlignment).toBe('left');
    mounted.destroy();
  });

  it('normalizes allowed links and rejects unsafe protocols before marks or navigation', () => {
    expect(normalizeSelectionLinkHref('example.invalid/work')).toBe('https://example.invalid/work');
    expect(normalizeSelectionLinkHref('/work/1')).toBe('/work/1');
    expect(normalizeSelectionLinkHref('../work/1')).toBe('../work/1');
    expect(normalizeSelectionLinkHref('mailto:hello@example.invalid')).toBe('mailto:hello@example.invalid');
    expect(normalizeSelectionLinkHref('tel:+821012345678')).toBe('tel:+821012345678');
    expect(normalizeSelectionLinkHref('https://{{verification_url}}')).toBe('{{verification_url}}');
    expect(normalizeSelectionLinkHref('{{verification_url}}')).toBe('{{verification_url}}');
    expect(normalizeSelectionLinkHref(['java', 'script:alert(1)'].join(''))).toBeNull();
    expect(normalizeSelectionLinkHref('data:text/html,unsafe')).toBeNull();

    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const onOpenLink = vi.fn();
    let commands = createSelectionBubbleMenuCommands(mounted.editor, { onOpenLink });
    expect(commands.createLink({ href: ['java', 'script:alert(1)'].join('') })).toBe(false);
    expect(mounted.editor.isActive('link')).toBe(false);
    expect(commands.createLink({ href: 'example.invalid' })).toBe(true);
    commands = createSelectionBubbleMenuCommands(mounted.editor, { onOpenLink });
    expect(commands.openLink()).toBe(true);
    expect(onOpenLink).toHaveBeenCalledWith('https://example.invalid');
    mounted.destroy();
  });

  it('preserves compatible inline marks while creating and relabeling a link', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    mounted.editor.chain().focus().toggleMark('bold').setMark('textColor', { stringValue: 'red' }).run();
    let commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.createLink({ href: 'example.invalid', text: 'Geul' })).toBe(true);
    let selectedMarks = mounted.editor.state.doc.resolve(mounted.editor.state.selection.from + 1).marks();
    expect(selectedMarks.map((mark) => mark.type.name)).toEqual(expect.arrayContaining(['bold', 'textColor', 'link']));

    commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.editLink({ href: '/work', text: 'Geul Work' }, commands.linkSelection ?? undefined)).toBe(true);
    selectedMarks = mounted.editor.state.doc.resolve(mounted.editor.state.selection.from + 1).marks();
    expect(selectedMarks.map((mark) => mark.type.name)).toEqual(expect.arrayContaining(['bold', 'textColor', 'link']));
    expect(selectedMarks.find((mark) => mark.type.name === 'link')?.attrs.href).toBe('/work');
    mounted.destroy();
  });

  it('updates only the URL when the link label is unchanged, preserving heterogeneous marks', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const from = mounted.editor.state.selection.from;
    const to = mounted.editor.state.selection.to;
    mounted.editor.view.dispatch(
      mounted.editor.state.tr
        .addMark(from, from + 3, mounted.editor.schema.marks.bold.create())
        .addMark(from + 3, to, mounted.editor.schema.marks.italic.create()),
    );
    let commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.createLink({ href: 'example.invalid' })).toBe(true);
    commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(
      commands.editLink({ href: '/updated', text: commands.selectedText }, commands.linkSelection ?? undefined),
    ).toBe(true);
    expect(
      mounted.editor.state.doc
        .resolve(from + 1)
        .marks()
        .map((mark) => mark.type.name),
    ).toContain('bold');
    expect(
      mounted.editor.state.doc
        .resolve(from + 4)
        .marks()
        .map((mark) => mark.type.name),
    ).toContain('italic');
    expect(
      mounted.editor.state.doc
        .resolve(from + 1)
        .marks()
        .find((mark) => mark.type.name === 'link')?.attrs.href,
    ).toBe('/updated');
    mounted.destroy();
  });

  it('edits a collapsed cursor link by snapshotting its full range and visible label', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    let commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.createLink({ href: 'https://example.invalid', text: 'Geul docs' })).toBe(true);
    const cursor = mounted.editor.state.selection.from + 2;
    mounted.editor.commands.setTextSelection(cursor);

    commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(true);
    expect(commands.canAlign).toBe(false);
    const linkSelection = commands.linkSelection;
    expect(linkSelection).toBeTruthy();
    expect(commands.editLink({ href: '/docs', text: 'Docs' }, linkSelection ?? undefined)).toBe(true);
    expect(mounted.editor.getAttributes('link').href).toBe('/docs');
    expect(mounted.editor.state.doc.textBetween(linkSelection?.from ?? 0, (linkSelection?.from ?? 0) + 4)).toBe('Docs');
    mounted.destroy();
  });

  it('keeps multi-block text alignment available without opening the generic menu for a structural cell selection', () => {
    const mounted = mountEditor();
    const paragraphs = positions(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, paragraphs[0] + 1, paragraphs[1] + 5),
      ),
    );
    expect(canShowSelectionBubbleMenu(mounted.editor)).toBe(true);
    const firstParagraph = mounted.editor.state.doc.nodeAt(paragraphs[0]);
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setNodeMarkup(paragraphs[0], undefined, {
        ...(firstParagraph?.attrs ?? {}),
        textAlignment: 'center',
      }),
    );
    expect(resolveSelectionBubbleMenuState(mounted.editor).alignment).toBeNull();
    expect(createSelectionBubbleMenuCommands(mounted.editor).setAlignment('right')).toBe(true);
    expect([
      mounted.editor.state.doc.firstChild?.child(0).firstChild?.attrs.textAlignment,
      mounted.editor.state.doc.firstChild?.child(1).firstChild?.attrs.textAlignment,
    ]).toEqual(['right', 'right']);
    mounted.destroy();

    const tableElement = document.createElement('div');
    document.body.append(tableElement);
    const tableEditor = new Editor({
      element: tableElement,
      extensions: [...createTiptapWireExtensions(), ...createTiptapTableExtensions()],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'table' },
                content: [
                  {
                    type: 'table',
                    content: [
                      {
                        type: 'tableRow',
                        content: [
                          {
                            type: 'tableCell',
                            content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'a' }] }],
                          },
                          {
                            type: 'tableCell',
                            content: [{ type: 'tableParagraph', content: [{ type: 'text', text: 'b' }] }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const cells = positions(tableEditor, 'tableCell');
    tableEditor.view.dispatch(
      tableEditor.state.tr.setSelection(CellSelection.create(tableEditor.state.doc, cells[0], cells[1])),
    );
    const tableCommands = createSelectionBubbleMenuCommands(tableEditor);
    expect(canShowSelectionBubbleMenu(tableEditor)).toBe(false);
    expect(tableCommands.hasTextSelection).toBe(false);
    expect(tableCommands.canAlign).toBe(false);
    expect(tableCommands.setAlignment('center')).toBe(false);
    tableEditor.destroy();
    tableElement.remove();
  });

  it('supports style, color, and alignment for text selected inside a table cell', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'table' },
                content: [
                  {
                    type: 'table',
                    content: [
                      {
                        type: 'tableRow',
                        content: [
                          {
                            type: 'tableCell',
                            content: [
                              {
                                type: 'tableParagraph',
                                content: [{ type: 'text', text: 'cell text' }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const tableParagraph = positions(editor, 'tableParagraph')[0];
    editor.commands.setTextSelection({ from: tableParagraph + 1, to: tableParagraph + 5 });
    const commands = createSelectionBubbleMenuCommands(editor);
    expect(commands).toMatchObject({ canFormatText: true, canColor: true, canAlign: true });
    expect(commands.toggleTextStyle('bold')).toBe(true);
    expect(commands.setTextColor('red')).toBe(true);
    expect(commands.setAlignment('right')).toBe(true);
    expect(editor.getAttributes('textColor').stringValue).toBe('red');
    expect(editor.state.doc.nodeAt(positions(editor, 'tableCell')[0])?.attrs.textAlignment).toBe('right');
    editor.destroy();
    element.remove();
  });

  it('disables mixed-selection commands unless every intersected target accepts them', () => {
    const element = document.createElement('div');
    document.body.append(element);
    const editor = new Editor({
      element,
      extensions: createTiptapWireExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              block('paragraph', 'plain'),
              {
                type: 'blockContainer',
                attrs: { id: 'code' },
                content: [
                  { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'code' }] },
                ],
              },
            ],
          },
        ],
      },
    });
    const paragraphPosition = positions(editor, 'paragraph')[0];
    const codePosition = positions(editor, 'codeBlock')[0];
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, paragraphPosition + 1, codePosition + 3)),
    );
    const state = resolveSelectionBubbleMenuState(editor);
    expect(state).toMatchObject({ canAlign: true, canFormatText: false, canColor: false });
    const commands = createSelectionBubbleMenuCommands(editor);
    expect(commands.toggleTextStyle('bold')).toBe(false);
    expect(commands.setTextColor('red')).toBe(false);
    expect(commands.setAlignment('center')).toBe(true);
    expect(editor.state.doc.nodeAt(paragraphPosition)?.attrs.textAlignment).toBe('center');
    expect(editor.state.doc.nodeAt(codePosition)?.attrs.textAlignment).toBe('center');
    editor.destroy();
    element.remove();
  });

  it('preserves exact selected whitespace in inline math source', () => {
    const mounted = mountEditor();
    const [, secondParagraph] = positions(mounted.editor, 'paragraph');
    mounted.editor.view.dispatch(
      mounted.editor.state.tr.setSelection(
        TextSelection.create(mounted.editor.state.doc, secondParagraph + 1, secondParagraph + 10),
      ),
    );
    mounted.editor.view.dispatch(mounted.editor.state.tr.insertText(' x ', secondParagraph + 1, secondParagraph + 10));
    mounted.editor.commands.setTextSelection({ from: secondParagraph + 1, to: secondParagraph + 4 });
    const commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.convertToInlineMath()).toBe(true);
    expect(mounted.editor.state.selection.$from.parent.type.name).toBe('mathInline');
    expect(mounted.editor.state.selection.$from.parent.textContent).toBe(' x ');
    mounted.destroy();
  });

  it('preserves durable block IDs while nesting and unnesting', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    let commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.canNest).toBe(true);
    expect(commands.nest()).toBe(true);

    const rootGroup = mounted.editor.state.doc.firstChild;
    expect(rootGroup?.childCount).toBe(2);
    expect(rootGroup?.firstChild?.lastChild?.type.name).toBe('blockGroup');
    expect(rootGroup?.firstChild?.lastChild?.firstChild?.attrs.id).toBe('second');

    commands = createSelectionBubbleMenuCommands(mounted.editor);
    expect(commands.canUnnest).toBe(true);
    expect(commands.unnest()).toBe(true);
    expect(mounted.editor.state.doc.firstChild?.childCount).toBe(3);
    expect(Array.from({ length: 3 }, (_, index) => mounted.editor.state.doc.firstChild?.child(index).attrs.id)).toEqual(
      ['first', 'second', 'third'],
    );
    mounted.destroy();
  });

  it('keeps promised AI visible as unavailable when no activation port exists', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    expect(resolveSelectionBubbleMenuState(mounted.editor).canOpenAI).toBe(false);
    mounted.destroy();
  });

  it('fails every stale mutation port closed after editing permission is revoked', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const commands = createSelectionBubbleMenuCommands(mounted.editor, { onAIActivate: vi.fn() });
    mounted.editor.setEditable(false);

    expect(commands.setBlockType('heading-2')).toBe(false);
    expect(commands.toggleTextStyle('bold')).toBe(false);
    expect(commands.setAlignment('center')).toBe(false);
    expect(commands.setTextColor('red')).toBe(false);
    expect(commands.setBackgroundColor('yellow')).toBe(false);
    expect(commands.nest()).toBe(false);
    expect(commands.unnest()).toBe(false);
    expect(commands.createLink({ href: 'example.invalid' })).toBe(false);
    expect(commands.convertToInlineMath()).toBe(false);
    expect(commands.openAI()).toBe(false);
    mounted.destroy();
  });

  it('rejects stale incompatible ports after the selection becomes inline code', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const onAIActivate = vi.fn();
    const commands = createSelectionBubbleMenuCommands(mounted.editor, { onAIActivate });
    mounted.editor.chain().focus().toggleMark('code').run();
    expect(commands.setTextColor('red')).toBe(false);
    expect(commands.setBackgroundColor('yellow')).toBe(false);
    expect(commands.createLink({ href: 'example.invalid' })).toBe(false);
    expect(commands.convertToInlineMath()).toBe(false);
    expect(commands.openAI()).toBe(false);
    expect(onAIActivate).not.toHaveBeenCalled();
    mounted.destroy();
  });

  it('rejects a stale link snapshot after the live selection changes', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const commands = createSelectionBubbleMenuCommands(mounted.editor);
    const snapshot = {
      from: mounted.editor.state.selection.from,
      to: mounted.editor.state.selection.to,
      expectedText: mounted.editor.state.doc.textBetween(
        mounted.editor.state.selection.from,
        mounted.editor.state.selection.to,
      ),
    };
    mounted.editor.commands.setTextSelection(snapshot.from + 1);
    expect(commands.createLink({ href: 'example.invalid', text: 'Geul' }, snapshot)).toBe(false);
    expect(mounted.editor.isActive('link')).toBe(false);
    mounted.destroy();
  });

  it('rejects a same-range collaboration replacement when the snapshotted text changed', () => {
    const mounted = mountEditor();
    selectSecondBlockText(mounted.editor);
    const commands = createSelectionBubbleMenuCommands(mounted.editor);
    const snapshot = {
      from: mounted.editor.state.selection.from,
      to: mounted.editor.state.selection.to,
      expectedText: mounted.editor.state.doc.textBetween(
        mounted.editor.state.selection.from,
        mounted.editor.state.selection.to,
      ),
    };
    const replacement = mounted.editor.schema.text('replaced');
    const transaction = mounted.editor.state.tr.replaceWith(snapshot.from, snapshot.to, replacement);
    transaction.setSelection(
      TextSelection.create(transaction.doc, snapshot.from, snapshot.from + replacement.nodeSize),
    );
    mounted.editor.view.dispatch(transaction);
    expect(commands.createLink({ href: 'example.invalid', text: 'Geul' }, snapshot)).toBe(false);
    mounted.destroy();
  });
});
