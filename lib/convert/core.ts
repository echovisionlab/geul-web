import katex from 'katex';
import { createHighlighter, type Highlighter } from 'shiki';
import type { LooseBlock } from '@/lib/types/editor/schema';

// Shared interfaces
export interface ConvertedContent<T = unknown> {
  json: T;
  html: string;
  text: string;
  markdown: string;
}

export interface HeadingInfo {
  id: string;
  level: number;
}

// Singleton highlighter
let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'javascript',
        'typescript',
        'jsx',
        'tsx',
        'python',
        'java',
        'c',
        'cpp',
        'csharp',
        'go',
        'rust',
        'ruby',
        'php',
        'swift',
        'kotlin',
        'html',
        'css',
        'scss',
        'json',
        'yaml',
        'xml',
        'sql',
        'shellscript',
        'markdown',
        'glsl',
      ],
    });
  }
  return highlighterPromise;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n');
}

export function unescapeLatex(text: string): string {
  return text
    .replace(/\\\\/g, '\\') // \\\\ → \\
    .replace(/\\_/g, '_'); // \_ → _
}

export async function applyCodeHighlighting(html: string): Promise<string> {
  const codeBlockRegex = /<pre\s+([^>]*)>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi;

  const matches = [...html.matchAll(codeBlockRegex)];
  if (matches.length === 0) {
    return html;
  }

  const highlighter = await getHighlighter();
  let result = html;

  for (const match of matches) {
    const [fullMatch, attributes, encodedCode] = match;
    const language = /\bdata-language="([^"]+)"/i.exec(attributes)?.[1];
    if (!language) {
      continue;
    }
    const textAlignment = /\bdata-text-alignment="(left|center|right)"/i.exec(attributes)?.[1];
    const previewWidth = /\bdata-preview-width="([^"]+)"/i.exec(attributes)?.[1];
    const shaderStage = /\bdata-shader-stage="(vertex|fragment)"/i.exec(attributes)?.[1];
    const style = /\bstyle="([^"]+)"/i.exec(attributes)?.[1];
    const code = decodeHtmlEntities(encodedCode);

    try {
      const highlighted = highlighter.codeToHtml(code, {
        lang: language || 'text',
        themes: {
          light: 'github-light',
          dark: 'github-dark',
        },
        defaultColor: false,
      });

      let highlightedWithLang = highlighted.replace(
        /<pre\s+/,
        `<pre data-language="${language}"${previewWidth ? ` data-preview-width="${previewWidth}"` : ''}${textAlignment ? ` data-text-alignment="${textAlignment}"` : ''}${shaderStage ? ` data-shader-stage="${shaderStage}"` : ''} `,
      );
      if (style) {
        highlightedWithLang = highlightedWithLang.replace(/\bstyle="([^"]*)"/, `style="${style};$1"`);
      }

      result = result.replace(fullMatch, highlightedWithLang);
    } catch {
      // Language not supported, keep original
    }
  }

  return result;
}

/**
 * Post-process HTML to render empty math-inline spans.
 *
 * Some HTML materializers doesn't always call toExternalHTML for inline content
 * inside table cells, resulting in empty spans with only data-latex attribute.
 * This function finds those empty spans and renders them with KaTeX.
 */
export function applyMathRendering(html: string): string {
  // Match empty math-inline spans (with data-latex but no content)
  // Also match math-block divs that might be empty
  const mathInlineRegex = /<span[^>]*class="math-inline"[^>]*data-latex="([^"]*)"[^>]*><\/span>/gi;
  const mathBlockRegex = /<div[^>]*class="math-block"[^>]*data-latex="([^"]*)"[^>]*><\/div>/gi;

  let result = html;

  // Process inline math
  result = result.replace(mathInlineRegex, (match, latex) => {
    if (!latex) {
      return match;
    }
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
      });
      return `<span class="math-inline" data-latex="${latex}">${rendered}</span>`;
    } catch {
      return match;
    }
  });

  // Process block math
  result = result.replace(mathBlockRegex, (match, latex) => {
    if (!latex) {
      return match;
    }
    try {
      const rendered = katex.renderToString(latex, {
        displayMode: true,
        throwOnError: false,
      });
      return `<div class="math-block" data-latex="${latex}">${rendered}</div>`;
    } catch {
      return match;
    }
  });

  return result;
}

/**
 * Extracts heading information from materialized block array.
 *
 * @param blocks - materialized block array (LooseBlock[])
 * @returns Array of heading IDs and level information
 */
export function extractHeadings(blocks: LooseBlock[]): HeadingInfo[] {
  const headings: HeadingInfo[] = [];

  function traverse(items: LooseBlock[]): void {
    for (const block of items) {
      if (block.type === 'heading') {
        // Extract level from heading block's props
        const level = typeof block.props.level === 'number' ? block.props.level : 1;
        headings.push({ id: block.id, level });
      }

      // Recursively traverse children
      if (block.children && block.children.length > 0) {
        traverse(block.children);
      }
    }
  }

  traverse(blocks);
  return headings;
}

export function addHeadingIds(html: string, headings: HeadingInfo[]): string {
  let result = html;
  let headingIndex = 0;

  const headingRegex = /<(h[1-6])(\s[^>]*)?>([^<]*(?:<[^/h][^>]*>[^<]*)*)<\/h[1-6]>/gi;

  result = result.replace(headingRegex, (match, tag, attrs, content) => {
    if (headingIndex >= headings.length) {
      return match;
    }

    const heading = headings[headingIndex];
    headingIndex++;

    if (attrs && /\sid=/.test(attrs)) {
      return match;
    }

    const newAttrs = attrs ? ` id="${heading.id}"${attrs}` : ` id="${heading.id}"`;
    return `<${tag}${newAttrs}>${content}</${tag}>`;
  });

  return result;
}

/**
 * Extracts text content from materialized block array.
 *
 * Recursively traverses block content and children,
 * returning all text node contents joined by spaces.
 *
 * @param blocks - materialized block array (LooseBlock[])
 * @returns Extracted text (joined by spaces)
 */
export function extractText(blocks: LooseBlock[]): string {
  const texts: string[] = [];

  function traverseContent(content: unknown): void {
    if (!content || typeof content !== 'object') {
      return;
    }

    if (Array.isArray(content)) {
      for (const item of content) {
        traverseContent(item);
      }
      return;
    }

    const record = content as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string') {
      texts.push(record.text);
    }
  }

  function traverseBlocks(items: LooseBlock[]): void {
    for (const block of items) {
      // Extract text from block content
      if (block.content) {
        traverseContent(block.content);
      }

      // Recursively traverse children
      if (block.children && block.children.length > 0) {
        traverseBlocks(block.children);
      }
    }
  }

  traverseBlocks(blocks);
  return texts.join(' ');
}
