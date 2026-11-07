import {
  Extension,
  Mark,
  mergeAttributes,
  Node as TiptapNode,
  textblockTypeInputRule,
  type Attribute,
  type Extensions,
} from '@tiptap/core';
import { Dropcursor, Gapcursor } from '@tiptap/extensions';
import { Fragment, type DOMOutputSpec, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { primitiveTokens, tokenVar } from '@echovisionlab/design-system/tokens';
import { resolveCodeBlockLanguage } from '@/lib/editor/code-block-options';
import { fileBlockPropSchema } from '@/lib/media/block-schemas';
import { mapBlockWirePropSchema } from '@/lib/types/map-block/schema';
import {
  changeCurrentBlockAlignment,
  handleCurrentTextBlockBackspace,
  insertParagraphAfterSelectedBlock,
  insertHardBreakInCurrentTextBlock,
  moveCurrentBlock,
  splitCurrentTextBlock,
} from './block-commands';
import { inlineEditorColorStyle } from './editor-color-presentation';
import { EmptyParagraphRangeSelection } from './integration/empty-paragraph-range-selection';
import { SiteVariable } from './site-variables/SiteVariable';
import { GeulTiptapEmoji } from './emoji/emoji-extension';
import { BlockMixedSelectionExtension } from './integration/block-mixed-selection';
import { selectionTouchesInlineMath } from './math/math-selection';

type PropSpec = Readonly<{
  default?: unknown;
  type?: 'boolean' | 'number' | 'string';
}>;

type PropSchema = Readonly<Record<string, PropSpec>>;

const defaultTextBlockProps = {
  backgroundColor: { default: 'default' },
  textColor: { default: 'default' },
  textAlignment: { default: 'left' },
} as const;

function toDataAttribute(name: string): string {
  return `data-${name.replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
}

function parseAttributeValue(value: string | null, spec: PropSpec): unknown {
  if (value === null) {
    return null;
  }
  const expectedType = spec.type ?? typeof spec.default;
  if (expectedType === 'boolean') {
    return value === 'true' ? true : value === 'false' ? false : null;
  }
  if (expectedType === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value;
}

function propSchemaToAttributes(propSchema: PropSchema): Record<string, Attribute> {
  return Object.fromEntries(
    Object.entries(propSchema).map(([name, spec]) => [
      name,
      {
        default: spec.default,
        keepOnSplit: true,
        parseHTML: (element: HTMLElement) => parseAttributeValue(element.getAttribute(toDataAttribute(name)), spec),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes[name] === spec.default ? {} : { [toDataAttribute(name)]: attributes[name] },
      } satisfies Attribute,
    ]),
  );
}

function createBlockContentNode({
  name,
  content = '',
  propSchema = {},
  tag = 'div',
}: {
  name: string;
  content?: string;
  propSchema?: PropSchema;
  tag?: string;
}) {
  return TiptapNode.create({
    name,
    group: 'blockContent',
    content,
    atom: content.length === 0,
    defining: true,
    isolating: name !== 'paragraph' && name !== 'heading',
    selectable: true,
    addAttributes() {
      return propSchemaToAttributes(propSchema);
    },
    parseHTML() {
      return [{ tag: `[data-content-type="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      const attributes = mergeAttributes(HTMLAttributes, { 'data-content-type': name });
      return (content ? [tag, attributes, 0] : [tag, attributes]) as DOMOutputSpec;
    },
  });
}

export const WireDocument = TiptapNode.create({
  name: 'doc',
  topNode: true,
  content: 'blockGroup',
});

export const WireBlockGroup = TiptapNode.create({
  name: 'blockGroup',
  group: 'childContainer',
  content: 'blockGroupChild+',
  allowGapCursor: true,
  parseHTML() {
    return [{ tag: '[data-node-type="blockGroup"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'editor-block-group',
        'data-node-type': 'blockGroup',
      }),
      0,
    ];
  },
});

export const WireBlockContainer = TiptapNode.create({
  name: 'blockContainer',
  group: 'blockGroupChild bnBlock',
  content: 'blockContent blockGroup?',
  defining: true,
  priority: 50,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: ({ id }) => ({ 'data-id': id }),
      },
    };
  },
  parseHTML() {
    return [{ tag: '[data-node-type="blockContainer"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'editor-block-container',
        'data-node-type': 'blockContainer',
      }),
      0,
    ];
  },
});

/**
 * How a standalone paragraph link is presented, plus the preview a card or
 * video keeps. Post and Page editors add these to Paragraph as global
 * attributes alongside the external-video layout.
 */
export const linkPresentationProps = {
  linkPresentation: { default: 'auto' },
  linkSiteName: { default: '' },
  linkDescription: { default: '' },
  linkThumbnailFileId: { default: '' },
  linkIconFileId: { default: '' },
  linkCaption: { default: '' },
} as const;

export const WireParagraph = createBlockContentNode({
  name: 'paragraph',
  content: 'inline*',
  propSchema: defaultTextBlockProps,
  tag: 'p',
});

function standaloneLinkAttributes() {
  return {
    ...propSchemaToAttributes({
      ...defaultTextBlockProps,
      displaySize: { default: 100, type: 'number' },
      aspectRatio: { default: 'auto' },
      ...linkPresentationProps,
      url: { default: '' },
      label: { default: '' },
    }),
    sourceContent: {
      default: [],
      rendered: false,
    },
  };
}

/**
 * Editor-only projection of a durable standalone paragraph link. The Block
 * Room codec maps this atom back to the original Paragraph payload, so this
 * node never creates a second persistence contract.
 */
export const WireExternalVideo = TiptapNode.create({
  name: 'externalVideo',
  group: 'blockContent',
  atom: true,
  defining: true,
  isolating: true,
  selectable: true,
  addAttributes() {
    return standaloneLinkAttributes();
  },
  parseHTML() {
    return [{ tag: '[data-content-type="externalVideo"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-content-type': 'externalVideo',
        'data-external-video-node': '',
      }),
    ];
  },
});

/** Editor-only card projection of a standalone paragraph link; persisted as that Paragraph. */
export const WireLinkCard = TiptapNode.create({
  name: 'linkCard',
  group: 'blockContent',
  atom: true,
  defining: true,
  isolating: true,
  selectable: true,
  addAttributes() {
    return standaloneLinkAttributes();
  },
  parseHTML() {
    return [{ tag: '[data-content-type="linkCard"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-content-type': 'linkCard', 'data-link-card-node': '' })];
  },
});

export const WireHeading = createBlockContentNode({
  name: 'heading',
  content: 'inline*',
  propSchema: {
    ...defaultTextBlockProps,
    level: { default: 1, type: 'number' },
  },
  tag: 'div',
}).extend({
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^(#{1,3}) $/,
        type: this.type,
        getAttributes: (match) => ({ level: match[1]?.length ?? 1 }),
      }),
    ];
  },
});

export const WireBulletListItem = createBlockContentNode({
  name: 'bulletListItem',
  content: 'inline*',
  propSchema: defaultTextBlockProps,
});

export const WireNumberedListItem = createBlockContentNode({
  name: 'numberedListItem',
  content: 'inline*',
  propSchema: { ...defaultTextBlockProps, start: { default: undefined, type: 'number' } },
}).extend({
  // An explicit start restarts the visible number here, as the published list's `counter-set` does.
  renderHTML({ node, HTMLAttributes }) {
    const start = node.attrs.start;
    const attributes = mergeAttributes(
      HTMLAttributes,
      { 'data-content-type': 'numberedListItem' },
      typeof start === 'number' && Number.isFinite(start) ? { style: `counter-set: numbered-list ${start}` } : {},
    );
    return ['div', attributes, 0] as DOMOutputSpec;
  },
});

export const WireCheckListItem = createBlockContentNode({
  name: 'checkListItem',
  content: 'inline*',
  propSchema: { ...defaultTextBlockProps, checked: { default: false, type: 'boolean' } },
});

export const WireQuote = createBlockContentNode({
  name: 'quote',
  content: 'inline*',
  propSchema: {
    backgroundColor: { default: 'default' },
    textColor: { default: 'default' },
  },
  tag: 'blockquote',
});

export const WireCallout = createBlockContentNode({
  name: 'callout',
  content: 'inline*',
  propSchema: {
    icon: { default: '💡' },
    backgroundColor: { default: 'gray' },
    textColor: { default: 'default' },
  },
});

export const WireCodeBlock = createBlockContentNode({
  name: 'codeBlock',
  content: 'text*',
  propSchema: {
    title: { default: '' },
    language: { default: 'javascript' },
    displaySize: { default: '100' },
    textAlignment: { default: 'left' },
  },
  tag: 'pre',
}).extend({
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([\w+#.-]*) $/,
        type: this.type,
        getAttributes: (match) => ({ language: resolveCodeBlockLanguage(match[1]).durableLanguage }),
      }),
    ];
  },
});

export const WireDivider = createBlockContentNode({ name: 'divider', tag: 'hr' });
export const WireFile = createBlockContentNode({ name: 'file', propSchema: fileBlockPropSchema }).extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // The generated FileAttachment oneof is needed only when a restored
      // attachment is missing; active attachments continue to use fileId.
      attachment: { default: null, rendered: false },
    };
  },
});
export const WireMath = createBlockContentNode({ name: 'math', propSchema: { latex: { default: '' } } });
export const WireMap = createBlockContentNode({ name: 'map', propSchema: mapBlockWirePropSchema });

export const WireTable = TiptapNode.create({
  name: 'table',
  group: 'blockContent',
  content: 'tableRow+',
  isolating: true,
  selectable: false,
  addAttributes() {
    return propSchemaToAttributes({
      textColor: { default: 'default' },
      displaySize: { default: 100, type: 'number' },
      textAlignment: { default: 'left' },
    });
  },
  parseHTML: () => [{ tag: 'table' }],
  renderHTML: ({ HTMLAttributes }) => ['table', HTMLAttributes, ['tbody', 0]],
});

export const WireTableParagraph = TiptapNode.create({
  name: 'tableParagraph',
  group: 'tableContent',
  content: 'inline*',
  parseHTML: () => [{ tag: 'p' }],
  renderHTML: ({ HTMLAttributes }) => ['p', HTMLAttributes, 0],
});

const tableCellAttributes = {
  textColor: { default: 'default' },
  backgroundColor: { default: 'default' },
  textAlignment: { default: 'left' },
  colspan: { default: 1, type: 'number' },
  rowspan: { default: 1, type: 'number' },
  colwidth: { default: null },
} as const;

const durableTableIdentityAttribute: Attribute = {
  default: null,
  rendered: false,
};

function createTableCellNode(name: 'tableCell' | 'tableHeader', tag: 'td' | 'th') {
  return TiptapNode.create({
    name,
    content: 'tableContent+',
    isolating: true,
    addAttributes() {
      return {
        id: durableTableIdentityAttribute,
        ...propSchemaToAttributes(tableCellAttributes),
      };
    },
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
  });
}

export const WireTableCell = createTableCellNode('tableCell', 'td');
export const WireTableHeader = createTableCellNode('tableHeader', 'th');
export const WireTableRow = TiptapNode.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)+',
  addAttributes() {
    return { id: durableTableIdentityAttribute };
  },
  parseHTML: () => [{ tag: 'tr' }],
  renderHTML: ({ HTMLAttributes }) => ['tr', HTMLAttributes, 0],
});

export const WireText = TiptapNode.create({ name: 'text', group: 'inline' });
export const WireHardBreak = TiptapNode.create({
  name: 'hardBreak',
  inline: true,
  group: 'inline',
  selectable: false,
  parseHTML: () => [{ tag: 'br' }],
  renderHTML: () => ['br'],
  renderText: () => '\n',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, previous, current) {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }
          const start = previous.doc.content.findDiffStart(current.doc.content);
          const end = previous.doc.content.findDiffEnd(current.doc.content);
          if (start === null || end === null) {
            return null;
          }
          const replacements: { from: number; to: number; nodes: ProseMirrorNode[] }[] = [];
          // Restrict normalization to the changed range. Source/code text uses
          // text*, while paragraph-like content (including table cells) uses inline*.
          current.doc.nodesBetween(start, Math.max(start, end.b), (node, position, parent) => {
            if (node.type.name === 'hardBreak' && node.marks.length) {
              replacements.push({ from: position, to: position + node.nodeSize, nodes: [node.mark([])] });
            } else if (node.isText && parent?.type.spec.content === 'inline*' && /[\r\n]/.test(node.text!)) {
              const nodes = node
                .text!.split(/\r\n|\r|\n/)
                .flatMap((text, index) => [
                  ...(index ? [current.schema.nodes.hardBreak!.create()] : []),
                  ...(text ? [current.schema.text(text, node.marks)] : []),
                ]);
              replacements.push({ from: position, to: position + node.nodeSize, nodes });
            }
          });
          if (!replacements.length) {
            return null;
          }
          const transaction = current.tr;
          for (const replacement of replacements.reverse()) {
            transaction.replaceWith(replacement.from, replacement.to, Fragment.fromArray(replacement.nodes));
          }
          return transaction;
        },
      }),
    ];
  },
});
export const WireMathInline = TiptapNode.create({
  name: 'mathInline',
  inline: true,
  group: 'inline',
  content: 'text*',
  marks: '',
  selectable: false,
  parseHTML: () => [{ tag: '[data-inline-content-type="mathInline"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-inline-content-type': 'mathInline' }),
    0,
  ],
});

function createBooleanMark(name: string, tag: string) {
  return Mark.create({
    name,
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
  });
}

export const WireBold = createBooleanMark('bold', 'strong');
export const WireItalic = createBooleanMark('italic', 'em');
export const WireUnderline = createBooleanMark('underline', 'u');
export const WireStrike = createBooleanMark('strike', 's');
export const WireCode = createBooleanMark('code', 'code');

function createColorMark(name: 'textColor' | 'backgroundColor') {
  return Mark.create({
    name,
    addAttributes() {
      return { stringValue: { default: undefined } };
    },
    parseHTML: () => [{ tag: `[data-style-type="${name}"]` }],
    renderHTML: ({ HTMLAttributes }) => {
      const style = inlineEditorColorStyle(name, HTMLAttributes.stringValue);
      return ['span', mergeAttributes(HTMLAttributes, { 'data-style-type': name }, style ? { style } : {}), 0];
    },
  });
}

export const WireTextColor = createColorMark('textColor');
export const WireBackgroundColor = createColorMark('backgroundColor');
export const WireLink = Mark.create({
  name: 'link',
  inclusive: false,
  addAttributes() {
    return { href: { default: null } };
  },
  parseHTML: () => [{ tag: 'a[href]' }],
  renderHTML: ({ HTMLAttributes }) => ['a', HTMLAttributes, 0],
});

export const TiptapKeyboardShortcuts = Extension.create({
  name: 'tiptapKeyboardShortcuts',
  addKeyboardShortcuts() {
    const toggleTextMark = (mark: 'bold' | 'italic' | 'underline' | 'strike' | 'code') =>
      selectionTouchesInlineMath(this.editor.state.selection) || this.editor.commands.toggleMark(mark);
    return {
      Enter: () => splitCurrentTextBlock(this.editor) || insertParagraphAfterSelectedBlock(this.editor),
      'Shift-Enter': () => insertHardBreakInCurrentTextBlock(this.editor),
      Backspace: () => handleCurrentTextBlockBackspace(this.editor),
      'Mod-b': () => toggleTextMark('bold'),
      'Mod-i': () => toggleTextMark('italic'),
      'Mod-u': () => toggleTextMark('underline'),
      'Mod-Shift-s': () => toggleTextMark('strike'),
      'Mod-e': () => toggleTextMark('code'),
      'Ctrl-Shift-ArrowRight': () => changeCurrentBlockAlignment(this.editor, 'forward'),
      'Ctrl-Shift-ArrowLeft': () => changeCurrentBlockAlignment(this.editor, 'backward'),
      'Alt-Shift-ArrowUp': () => moveCurrentBlock(this.editor, 'up'),
      'Alt-Shift-ArrowDown': () => moveCurrentBlock(this.editor, 'down'),
    };
  },
});

export type TiptapWireSchemaOptions = {
  blockContainerNode?: Extensions[number];
  codeBlockNode?: Extensions[number];
  externalVideoNode?: Extensions[number];
  linkCardNode?: Extensions[number];
  fileNode?: Extensions[number];
  mapNode?: Extensions[number];
};

export function createTiptapWireExtensions(options: TiptapWireSchemaOptions = {}): Extensions {
  return [
    WireDocument,
    WireBlockGroup,
    options.blockContainerNode ?? WireBlockContainer,
    WireParagraph,
    WireHeading,
    WireBulletListItem,
    WireNumberedListItem,
    WireCheckListItem,
    WireQuote,
    WireCallout,
    options.codeBlockNode ?? WireCodeBlock,
    WireDivider,
    options.externalVideoNode ?? WireExternalVideo,
    options.linkCardNode ?? WireLinkCard,
    options.fileNode ?? WireFile,
    WireMath,
    options.mapNode ?? WireMap,
    WireTable,
    WireTableParagraph,
    WireTableHeader,
    WireTableCell,
    WireTableRow,
    WireText,
    WireHardBreak,
    SiteVariable,
    WireMathInline,
    GeulTiptapEmoji,
    WireBold,
    WireItalic,
    WireUnderline,
    WireStrike,
    WireCode,
    WireTextColor,
    WireBackgroundColor,
    WireLink,
    BlockMixedSelectionExtension,
    Dropcursor.configure({
      color: tokenVar('focus'),
      width: Number.parseFloat(primitiveTokens.border.focus),
    }),
    Gapcursor,
    EmptyParagraphRangeSelection,
    TiptapKeyboardShortcuts,
  ];
}
