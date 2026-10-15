interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hProperties?: Record<string, unknown> };
}

function textContent(node: MarkdownNode): string {
  return node.value ?? node.children?.map(textContent).join('') ?? '';
}

/** Unicode heading anchors match the repository's Markdown links, including duplicate headings. */
export function headingAnchors() {
  return (tree: MarkdownNode) => {
    const used = new Set<string>();
    function visit(node: MarkdownNode) {
      if (node.type === 'html' && /^<br\s*\/?>$/i.test(node.value ?? '')) {
        node.type = 'break';
        delete node.value;
      }
      if (node.type === 'heading') {
        const base = textContent(node)
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\p{M}_\s-]/gu, '')
          .replace(/\s/g, '-');
        let id = base;
        let suffix = 0;
        while (used.has(id)) {
          id = `${base}-${++suffix}`;
        }
        used.add(id);
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id, tabIndex: -1 } };
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  };
}

export function handbookTarget(href: string, from: string) {
  const url = new URL(href, `https://storybook-docs.invalid/${from}`);
  return { path: decodeURIComponent(url.pathname).slice(1), hash: url.hash };
}

/** Storybook permits scalar URL args with letters, digits, spaces, underscores and dashes. */
export function handbookDocumentId(path: string) {
  return path.split('/').at(-1)?.replace(/\.md$/, '') ?? '';
}
