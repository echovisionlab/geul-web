import type { JSONContent } from '@tiptap/core';
import { mergeLocalizedBlockProps, pickSharedRichTextBlockProps } from '@echovisionlab/geul-common/collaboration/page';

export interface TiptapLocalizedBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: JSONContent[];
  children: TiptapLocalizedBlock[];
}

const SHARED_SOURCE_BLOCK_TYPES = new Set(['p5Sketch', 'threeScene', 'shader']);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function isJsonContent(value: unknown): value is JSONContent {
  const node = record(value);
  return Boolean(
    node &&
    typeof node.type === 'string' &&
    (node.content === undefined || (Array.isArray(node.content) && node.content.every(isJsonContent))),
  );
}

function cloneContent(content: unknown): JSONContent[] {
  return Array.isArray(content) && content.every(isJsonContent) ? structuredClone(content) : [];
}

function parseBlockGroup(groupValue: unknown, seenIds: Set<string>): TiptapLocalizedBlock[] | null {
  const group = record(groupValue);
  if (group?.type !== 'blockGroup' || !Array.isArray(group.content)) {
    return null;
  }

  const blocks: TiptapLocalizedBlock[] = [];
  for (const containerValue of group.content) {
    const container = record(containerValue);
    if (
      container?.type !== 'blockContainer' ||
      !Array.isArray(container.content) ||
      container.content.length < 1 ||
      container.content.length > 2
    ) {
      return null;
    }
    const attrs = record(container.attrs);
    const blockContent = record(container.content[0]);
    const id = typeof attrs?.id === 'string' ? attrs.id.trim() : '';
    if (!id || seenIds.has(id) || typeof blockContent?.type !== 'string') {
      return null;
    }
    seenIds.add(id);
    const childGroup = container.content[1];
    const children = childGroup ? parseBlockGroup(childGroup, seenIds) : [];
    if (children == null) {
      return null;
    }
    blocks.push({
      id,
      type: blockContent.type,
      props: structuredClone(record(blockContent.attrs) ?? {}),
      content: cloneContent(blockContent.content),
      children,
    });
  }
  return blocks;
}

export function tiptapDocumentToLocalizedBlocks(documentValue: unknown): TiptapLocalizedBlock[] | null {
  const document = record(documentValue);
  if (document?.type !== 'doc' || !Array.isArray(document.content) || document.content.length !== 1) {
    return null;
  }
  return parseBlockGroup(document.content[0], new Set());
}

function blockToTiptapContainer(block: TiptapLocalizedBlock): JSONContent {
  const blockContent: JSONContent = {
    type: block.type,
    ...(Object.keys(block.props).length > 0 ? { attrs: structuredClone(block.props) } : {}),
    ...(block.content.length > 0 ? { content: cloneContent(block.content) } : {}),
  };
  return {
    type: 'blockContainer',
    attrs: { id: block.id },
    content: [
      blockContent,
      ...(block.children.length > 0
        ? [{ type: 'blockGroup', content: block.children.map(blockToTiptapContainer) }]
        : []),
    ],
  };
}

export function localizedBlocksToTiptapDocument(blocks: readonly TiptapLocalizedBlock[]): JSONContent {
  return {
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks.map(blockToTiptapContainer) }],
  };
}

function blockLookup(
  blocks: readonly TiptapLocalizedBlock[],
  lookup = new Map<string, TiptapLocalizedBlock>(),
): ReadonlyMap<string, TiptapLocalizedBlock> {
  for (const block of blocks) {
    lookup.set(block.id, block);
    blockLookup(block.children, lookup);
  }
  return lookup;
}

function blankTableCellContent(content: readonly JSONContent[] | undefined): JSONContent[] {
  const paragraphs = content?.filter((node) => node.type === 'tableParagraph') ?? [];
  return paragraphs.length > 0
    ? paragraphs.map((paragraph) => ({ ...structuredClone(paragraph), content: [] }))
    : [{ type: 'tableParagraph' }];
}

function projectSharedTableContent(content: readonly JSONContent[]): JSONContent[] {
  return content.map((row) => ({
    ...structuredClone(row),
    content: row.content?.map((cell) => ({
      ...structuredClone(cell),
      content: blankTableCellContent(cell.content),
    })),
  }));
}

function mergeLocalizedTableContent(
  sharedContent: readonly JSONContent[],
  localizedContent: readonly JSONContent[] | undefined,
): JSONContent[] {
  return sharedContent.map((sharedRow, rowIndex) => {
    const localizedRow = localizedContent?.[rowIndex];
    return {
      ...structuredClone(sharedRow),
      content: sharedRow.content?.map((sharedCell, cellIndex) => {
        const localizedCell = localizedRow?.content?.[cellIndex];
        return {
          ...structuredClone(sharedCell),
          content: localizedCell?.content
            ? cloneContent(localizedCell.content)
            : blankTableCellContent(sharedCell.content),
        };
      }),
    };
  });
}

function mergeBlock(
  sharedBlock: TiptapLocalizedBlock,
  localized: ReadonlyMap<string, TiptapLocalizedBlock>,
): TiptapLocalizedBlock {
  const localizedBlock = localized.get(sharedBlock.id);
  let props = mergeLocalizedBlockProps(sharedBlock.props, localizedBlock?.props, sharedBlock.type) ?? {};
  if (sharedBlock.type === 'codeBlock') {
    const localizedTitle = localizedBlock?.props.title;
    props = { ...props };
    delete props.title;
    if (typeof localizedTitle === 'string') {
      props.title = localizedTitle.trim();
    }
  }
  let content: JSONContent[];
  if (SHARED_SOURCE_BLOCK_TYPES.has(sharedBlock.type)) {
    content = cloneContent(sharedBlock.content);
  } else if (sharedBlock.type === 'table') {
    content = mergeLocalizedTableContent(sharedBlock.content, localizedBlock?.content);
  } else {
    content = localizedBlock ? cloneContent(localizedBlock.content) : [];
  }
  return {
    id: sharedBlock.id,
    type: sharedBlock.type,
    props,
    content,
    children: sharedBlock.children.map((child) => mergeBlock(child, localized)),
  };
}

export function mergeTiptapLocalizedStructure(
  sharedBlocks: readonly TiptapLocalizedBlock[],
  localizedBlocks: readonly TiptapLocalizedBlock[],
): TiptapLocalizedBlock[] {
  const localized = blockLookup(localizedBlocks);
  return sharedBlocks.map((block) => mergeBlock(block, localized));
}

export function projectTiptapSharedStructure(
  localizedBlocks: readonly TiptapLocalizedBlock[],
  currentSharedBlocks: readonly TiptapLocalizedBlock[] = [],
): TiptapLocalizedBlock[] {
  const currentShared = blockLookup(currentSharedBlocks);
  const project = (block: TiptapLocalizedBlock): TiptapLocalizedBlock => {
    const current = currentShared.get(block.id);
    const projectedProps = pickSharedRichTextBlockProps(block.props, block.type);
    if (block.type === 'codeBlock') {
      delete projectedProps.title;
    }
    const currentSharedProps =
      current?.type === block.type ? pickSharedRichTextBlockProps(current.props, block.type) : {};
    const props =
      block.type === 'file'
        ? {
            ...projectedProps,
            ...Object.fromEntries(
              Object.entries(currentSharedProps).filter(([, value]) => value != null && value !== ''),
            ),
          }
        : projectedProps;
    const content = SHARED_SOURCE_BLOCK_TYPES.has(block.type)
      ? cloneContent(block.content)
      : block.type === 'table'
        ? projectSharedTableContent(block.content)
        : [];
    return {
      id: block.id,
      type: block.type,
      props,
      content,
      children: block.children.map(project),
    };
  };
  return localizedBlocks.map(project);
}

export function hasMeaningfulTiptapStructure(blocks: readonly TiptapLocalizedBlock[]): boolean {
  if (blocks.length !== 1) {
    return blocks.length > 1;
  }
  const [block] = blocks;
  if (block.type !== 'paragraph' || block.children.length > 0) {
    return true;
  }
  return block.content.some((node) => {
    const nodeRecord = record(node);
    return typeof nodeRecord?.text === 'string' && nodeRecord.text.trim().length > 0;
  });
}
