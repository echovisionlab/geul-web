import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  normalizeRichTextHref,
  normalizeRichTextHtmlLinks as normalizePolicyHtmlLinks,
} from '@echovisionlab/geul-common/editor/link-normalization';
import { inlineEditorColorStyle } from '../editor-color-presentation';
import {
  documentHeadingTag,
  type DocumentHeadingParentLevel,
} from '@/features/document-layout/ui/document-heading-level';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textAlignmentAttribute(node: ProseMirrorNode): string {
  const alignment = String(node.attrs.textAlignment ?? 'left');
  return alignment === 'center' || alignment === 'right' ? ` style="text-align:${alignment}"` : '';
}

function renderInline(node: ProseMirrorNode): string {
  if (node.type.name === 'hardBreak') {
    return '<br />';
  }
  let html = node.isText ? escapeHtml(node.text ?? '') : node.content.content.map(renderInline).join('');
  for (const mark of [...node.marks].reverse()) {
    switch (mark.type.name) {
      case 'bold':
        html = `<strong>${html}</strong>`;
        break;
      case 'italic':
        html = `<em>${html}</em>`;
        break;
      case 'underline':
        html = `<u>${html}</u>`;
        break;
      case 'strike':
        html = `<s>${html}</s>`;
        break;
      case 'code':
        html = `<code>${html}</code>`;
        break;
      case 'link':
        {
          const href = normalizeRichTextHref(String(mark.attrs.href ?? ''));
          html = href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
        }
        break;
      case 'textColor':
      case 'backgroundColor': {
        const value = String(mark.attrs.stringValue ?? 'default');
        if (value !== 'default') {
          const type = mark.type.name === 'textColor' ? 'textColor' : 'backgroundColor';
          const style = inlineEditorColorStyle(type, value);
          html = `<span data-style-type="${type}" data-style-value="${escapeHtml(value)}"${style ? ` style="${style}"` : ''}>${html}</span>`;
        }
        break;
      }
    }
  }
  return html;
}

function renderTable(node: ProseMirrorNode): string {
  const rows = node.content.content
    .map((row) => {
      const cells = row.content.content
        .map((cell) => {
          const tag = cell.type.name === 'tableHeader' ? 'th' : 'td';
          const colspan = Number(cell.attrs.colspan ?? 1);
          const rowspan = Number(cell.attrs.rowspan ?? 1);
          const span = `${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}`;
          return `<${tag}${span}>${cell.content.content
            .map(
              (paragraph) =>
                `<p${textAlignmentAttribute(paragraph)}>${paragraph.content.content.map(renderInline).join('')}</p>`,
            )
            .join('')}</${tag}>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table><tbody>${rows}</tbody></table>`;
}

function renderPolicyBlock(block: ProseMirrorNode, children: string, options: TiptapHtmlOptions): string {
  const inline = block.content.content.map(renderInline).join('');
  const alignment = textAlignmentAttribute(block);
  switch (block.type.name) {
    case 'paragraph':
      return `<p${alignment}>${inline}</p>${children}`;
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(block.attrs.level ?? 1)));
      if (!options.headingParentLevel) {
        return `<h${level}${alignment}>${inline}</h${level}>${children}`;
      }
      // Below a document title the element moves down the outline; the authored level keeps the size.
      const tag = documentHeadingTag(level, options.headingParentLevel);
      return `<${tag} data-heading-level="${level}"${alignment}>${inline}</${tag}>${children}`;
    }
    case 'bulletListItem':
    case 'numberedListItem':
    case 'checkListItem':
      return `<li${block.type.name === 'checkListItem' ? ` data-checked="${Boolean(block.attrs.checked)}"` : ''}${alignment}>${inline}${children}</li>`;
    case 'quote':
      return `<blockquote${alignment}>${inline}</blockquote>${children}`;
    case 'callout': {
      const icon = escapeHtml(String(block.attrs.icon ?? '💡'));
      const backgroundColor = escapeHtml(String(block.attrs.backgroundColor ?? 'gray'));
      const textColor = escapeHtml(String(block.attrs.textColor ?? 'default'));
      return `<aside data-callout="" data-bg-color="${backgroundColor}" data-text-color="${textColor}"><span data-callout-icon="" aria-hidden="true">${icon}</span><div data-callout-content=""><div data-callout-copy="">${inline}</div>${children}</div></aside>`;
    }
    case 'codeBlock':
      return `<pre><code>${inline}</code></pre>${children}`;
    case 'divider':
      return `<hr />${children}`;
    case 'table':
      return `${renderTable(block)}${children}`;
    default:
      return children;
  }
}

function renderPolicyContainer(container: ProseMirrorNode, options: TiptapHtmlOptions): string {
  const block = container.firstChild;
  if (!block) {
    return '';
  }
  const childGroup = container.childCount > 1 ? container.child(1) : null;
  return renderPolicyBlock(
    block,
    childGroup?.type.name === 'blockGroup' ? renderPolicyGroup(childGroup, options) : '',
    options,
  );
}

function renderPolicyGroup(group: ProseMirrorNode, options: TiptapHtmlOptions): string {
  let html = '';
  for (let index = 0; index < group.childCount;) {
    const container = group.child(index);
    const type = container.firstChild?.type.name;
    if (type === 'bulletListItem' || type === 'numberedListItem' || type === 'checkListItem') {
      const items: string[] = [];
      for (; index < group.childCount && group.child(index).firstChild?.type.name === type; index += 1) {
        items.push(renderPolicyContainer(group.child(index), options));
      }
      const tag = type === 'numberedListItem' ? 'ol' : 'ul';
      const checkAttribute = type === 'checkListItem' ? ' data-checklist="true"' : '';
      html += `<${tag}${checkAttribute}>${items.join('')}</${tag}>`;
      continue;
    }
    html += renderPolicyContainer(container, options);
    index += 1;
  }
  return html;
}

export interface TiptapHtmlOptions {
  /**
   * The heading level the HTML sits under (1 below a visible document title). Headings then render one
   * element lower with `data-heading-level` carrying the authored level; omitted, the authored element.
   */
  headingParentLevel?: DocumentHeadingParentLevel;
}

/** Semantic HTML shared by policy output and email/campaign previews. */
export function tiptapDocumentToHtml(document: ProseMirrorNode, options: TiptapHtmlOptions = {}): string {
  const group = document.firstChild;
  return normalizePolicyHtmlLinks(group?.type.name === 'blockGroup' ? renderPolicyGroup(group, options) : '');
}
