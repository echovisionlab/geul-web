export interface LooseInlineNode {
  type: string;
  text?: string;
  styles?: Record<string, unknown>;
  props?: Record<string, unknown>;
  content?: LooseInlineNode[];
}

export interface LooseTableCell {
  type?: string;
  props?: Record<string, unknown>;
  content: LooseInlineNode[];
}

export interface LooseTableRow {
  cells: Array<LooseInlineNode[] | LooseTableCell>;
}

export interface LooseTableContent {
  type: 'tableContent';
  columnWidths: number[];
  headerRows: number;
  headerCols: number;
  rows: LooseTableRow[];
}

export interface LooseEditorBlock {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: LooseInlineNode[] | LooseTableContent;
  children?: LooseEditorBlock[];
}

const BLOCK_MATH_PATTERNS = [/^\$\$([^$]+)\$\$$/, /^\\\[([^\]]+)\\\]$/];
const ALL_MATH_PATTERNS = [
  /\$\$([^$]+)\$\$/g,
  /\\\[([^\]]+)\\\]/g,
  /(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g,
  /\\\(([^)]+)\\\)/g,
];

function containsMathPatterns(text: string): boolean {
  for (const pattern of ALL_MATH_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function getTextFromInlineContent(content: LooseInlineNode[]): string {
  return content.map((item) => (item.type === 'text' ? item.text || '' : '')).join('');
}

function canConvertBlockToMath(block: LooseEditorBlock): block is LooseEditorBlock & {
  content: LooseInlineNode[];
} {
  return (
    block.type === 'paragraph' &&
    Array.isArray(block.content) &&
    block.content.length > 0 &&
    block.content.every((item) => item.type === 'text') &&
    (block.children?.length ?? 0) === 0
  );
}

function maybeConvertBlockToMath(block: LooseEditorBlock): LooseEditorBlock | undefined {
  if (!canConvertBlockToMath(block)) {
    return undefined;
  }

  const text = getTextFromInlineContent(block.content).trim();
  for (const pattern of BLOCK_MATH_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const latex = match[1]?.trim();
    if (!latex) {
      return undefined;
    }

    return {
      id: block.id,
      type: 'math',
      props: { latex },
      children: [],
    };
  }

  return undefined;
}

function normalizeInlineContentWithMath(content: LooseInlineNode[]): {
  changed: boolean;
  content: LooseInlineNode[];
} {
  const result: LooseInlineNode[] = [];
  let changed = false;

  for (const item of content) {
    if (item.type !== 'text') {
      result.push(item);
      continue;
    }

    const text = item.text || '';
    if (!containsMathPatterns(text)) {
      result.push(item);
      continue;
    }

    const styles = item.styles || {};
    const matches: Array<{ index: number; length: number; latex: string }> = [];

    for (const pattern of ALL_MATH_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          latex: match[1].trim(),
        });
      }
    }

    matches.sort((a, b) => a.index - b.index);

    const filteredMatches: typeof matches = [];
    let lastEnd = 0;
    for (const match of matches) {
      if (!match.latex || match.index < lastEnd) {
        continue;
      }
      filteredMatches.push(match);
      lastEnd = match.index + match.length;
    }

    if (filteredMatches.length === 0) {
      result.push(item);
      continue;
    }

    changed = true;
    let lastIndex = 0;
    for (const match of filteredMatches) {
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          text: text.slice(lastIndex, match.index),
          styles,
        });
      }

      result.push({
        type: 'mathInline',
        props: { latex: match.latex },
      });

      lastIndex = match.index + match.length;
    }

    if (lastIndex < text.length) {
      result.push({
        type: 'text',
        text: text.slice(lastIndex),
        styles,
      });
    }
  }

  return { changed, content: result };
}

function normalizeTableCell(cell: LooseTableCell): { changed: boolean; cell: LooseTableCell } {
  const textContent = getTextFromInlineContent(cell.content);
  if (!containsMathPatterns(textContent)) {
    return { changed: false, cell };
  }

  const normalized = normalizeInlineContentWithMath(cell.content);
  if (!normalized.changed) {
    return { changed: false, cell };
  }

  return {
    changed: true,
    cell: {
      ...cell,
      content: normalized.content,
    },
  };
}

function normalizeTableBlock(block: LooseEditorBlock): {
  changed: boolean;
  block: LooseEditorBlock;
} {
  const tableContent = block.content;
  if (!tableContent || Array.isArray(tableContent) || tableContent.type !== 'tableContent') {
    return { changed: false, block };
  }

  let changed = false;
  const rows = tableContent.rows.map((row) => {
    const cells = row.cells.map((cellEntry) => {
      if (Array.isArray(cellEntry)) {
        const normalized = normalizeInlineContentWithMath(cellEntry);
        if (normalized.changed) {
          changed = true;
        }
        return normalized.changed ? normalized.content : cellEntry;
      }

      const normalized = normalizeTableCell(cellEntry);
      if (normalized.changed) {
        changed = true;
      }
      return normalized.cell;
    });

    return { cells };
  });

  if (!changed) {
    return { changed: false, block };
  }

  return {
    changed: true,
    block: {
      ...block,
      content: {
        ...tableContent,
        rows,
      },
    },
  };
}

function normalizeBlockMath(block: LooseEditorBlock): {
  changed: boolean;
  block: LooseEditorBlock;
} {
  const blockMath = maybeConvertBlockToMath(block);
  if (blockMath) {
    return { changed: true, block: blockMath };
  }

  if (block.type === 'table') {
    return normalizeTableBlock(block);
  }

  let changed = false;
  let nextContent = block.content;

  if (Array.isArray(block.content)) {
    const normalized = normalizeInlineContentWithMath(block.content);
    if (normalized.changed) {
      changed = true;
      nextContent = normalized.content;
    }
  }

  let nextChildren = block.children;
  if (block.children?.length) {
    const normalized = normalizeEditorBlocksMath(block.children);
    if (normalized.changed) {
      changed = true;
      nextChildren = normalized.blocks;
    }
  }

  if (!changed) {
    return { changed: false, block };
  }

  return {
    changed: true,
    block: {
      ...block,
      content: nextContent,
      children: nextChildren,
    },
  };
}

export function normalizeEditorBlocksMath(blocks: readonly LooseEditorBlock[]): {
  changed: boolean;
  blocks: LooseEditorBlock[];
} {
  let changed = false;

  const normalizedBlocks = blocks.map((block) => {
    const normalized = normalizeBlockMath(block);
    if (normalized.changed) {
      changed = true;
    }
    return normalized.block;
  });

  return {
    changed,
    blocks: normalizedBlocks,
  };
}
