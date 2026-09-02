import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';

type LinkableInlineProps = Record<string, unknown> & {
  href?: string;
};

type LinkableInlineNode<TInline extends LinkableInlineNode<TInline>> = {
  type?: string;
  href?: string;
  props?: LinkableInlineProps;
  content?: readonly TInline[];
};

type LinkableBlockNode<
  TInline extends LinkableInlineNode<TInline>,
  TBlock extends LinkableBlockNode<TInline, TBlock>,
> = {
  content?: readonly TInline[] | object;
  children?: readonly TBlock[];
};

export function normalizeEmailPlaceholderHref(href: string): string {
  return normalizeRichTextHref(href);
}

function normalizeInlineContentNode<TInline extends LinkableInlineNode<TInline>>(
  node: TInline,
): {
  node: TInline;
  changed: boolean;
} {
  let changed = false;
  let nextNode = node;

  if (node.type === 'link') {
    let nextHref = node.href;
    if (typeof nextHref === 'string') {
      const normalizedHref = normalizeEmailPlaceholderHref(nextHref);
      if (normalizedHref !== nextHref) {
        nextHref = normalizedHref;
        changed = true;
      }
    }

    let nextProps = node.props;
    if (nextProps && typeof nextProps.href === 'string') {
      const normalizedPropHref = normalizeEmailPlaceholderHref(nextProps.href);
      if (normalizedPropHref !== nextProps.href) {
        nextProps = { ...nextProps, href: normalizedPropHref };
        changed = true;
      }
    }

    if (changed) {
      nextNode = {
        ...nextNode,
        href: nextHref,
        props: nextProps,
      } as TInline;
    }
  }

  if (Array.isArray(node.content) && node.content.length > 0) {
    const normalizedChildren = normalizeInlineContent(node.content);
    if (normalizedChildren.changed) {
      nextNode = {
        ...nextNode,
        content: normalizedChildren.content,
      } as TInline;
      changed = true;
    }
  }

  return { node: nextNode, changed };
}

function normalizeInlineContent<TInline extends LinkableInlineNode<TInline>>(
  content: readonly TInline[],
): {
  content: TInline[];
  changed: boolean;
} {
  let changed = false;
  const normalized = content.map((node) => {
    const result = normalizeInlineContentNode(node);
    if (result.changed) {
      changed = true;
    }
    return result.node;
  });

  return { content: changed ? normalized : Array.from(content), changed };
}

function normalizeBlockNode<
  TInline extends LinkableInlineNode<TInline>,
  TBlock extends LinkableBlockNode<TInline, TBlock>,
>(
  block: TBlock,
): {
  block: TBlock;
  changed: boolean;
} {
  let changed = false;
  let nextBlock = block;

  if (Array.isArray(block.content) && block.content.length > 0) {
    const normalizedContent = normalizeInlineContent(block.content);
    if (normalizedContent.changed) {
      nextBlock = {
        ...nextBlock,
        content: normalizedContent.content,
      } as TBlock;
      changed = true;
    }
  }

  if (Array.isArray(block.children) && block.children.length > 0) {
    const normalizedChildren = normalizeEmailPlaceholderLinkBlocks(block.children);
    if (normalizedChildren.changed) {
      nextBlock = {
        ...nextBlock,
        children: normalizedChildren.blocks,
      } as TBlock;
      changed = true;
    }
  }

  return { block: nextBlock, changed };
}

export function normalizeEmailPlaceholderLinkBlocks<
  TInline extends LinkableInlineNode<TInline>,
  TBlock extends LinkableBlockNode<TInline, TBlock>,
>(
  blocks: readonly TBlock[],
): {
  blocks: TBlock[];
  changed: boolean;
} {
  let changed = false;
  const normalized = blocks.map((block) => {
    const result = normalizeBlockNode(block);
    if (result.changed) {
      changed = true;
    }
    return result.block;
  });

  return { blocks: changed ? normalized : Array.from(blocks), changed };
}
