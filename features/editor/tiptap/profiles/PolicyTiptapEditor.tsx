'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Awareness } from 'y-protocols/awareness';
import {
  normalizeRichTextHref,
  normalizeRichTextHtmlLinks as normalizePolicyHtmlLinks,
} from '@echovisionlab/geul-common/editor/link-normalization';
import type { RichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { inlineEditorColorStyle } from '../editor-color-presentation';
import { EditorAuthoringModeProvider, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import type { TiptapAuthoringCapabilities } from '@/features/editor/tiptap/TiptapAuthoringControls';

export type PolicyTiptapEditorInstance = Editor;

const POLICY_NODE_NAMES = new Set([
  'doc',
  'blockGroup',
  'blockContainer',
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'callout',
  'codeBlock',
  'divider',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'tableParagraph',
  'text',
  'hardBreak',
]);

const POLICY_MARK_NAMES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'textColor',
  'backgroundColor',
]);

/** Returns a user-safe error instead of silently dropping policy content. */
export function validatePolicyTiptapDocument(document: ProseMirrorNode): string | null {
  const unsupportedNodes = new Set<string>();
  const unsupportedMarks = new Set<string>();

  document.descendants((node) => {
    if (!POLICY_NODE_NAMES.has(node.type.name)) {
      unsupportedNodes.add(node.type.name);
    }
    for (const mark of node.marks) {
      if (!POLICY_MARK_NAMES.has(mark.type.name)) {
        unsupportedMarks.add(mark.type.name);
      }
    }
  });

  if (unsupportedNodes.size === 0 && unsupportedMarks.size === 0) {
    return null;
  }

  const details = [
    ...(unsupportedNodes.size > 0 ? [`nodes: ${[...unsupportedNodes].sort().join(', ')}`] : []),
    ...(unsupportedMarks.size > 0 ? [`styles: ${[...unsupportedMarks].sort().join(', ')}`] : []),
  ];
  return `This policy contains content that the policy editor does not support (${details.join('; ')}). Remove or migrate it before editing.`;
}

function createPolicyContentGuard(report: (message: string) => void) {
  return Extension.create({
    name: 'policyContentGuard',
    priority: 1100,
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction(transaction) {
            const error = validatePolicyTiptapDocument(transaction.doc);
            if (!error) {
              return true;
            }
            report(error);
            return false;
          },
        }),
      ];
    },
  });
}

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

function renderPolicyBlock(block: ProseMirrorNode, children: string): string {
  const inline = block.content.content.map(renderInline).join('');
  const alignment = textAlignmentAttribute(block);
  switch (block.type.name) {
    case 'paragraph':
      return `<p${alignment}>${inline}</p>${children}`;
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(block.attrs.level ?? 1)));
      return `<h${level}${alignment}>${inline}</h${level}>${children}`;
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

function renderPolicyContainer(container: ProseMirrorNode): string {
  const block = container.firstChild;
  if (!block) {
    return '';
  }
  const childGroup = container.childCount > 1 ? container.child(1) : null;
  return renderPolicyBlock(block, childGroup?.type.name === 'blockGroup' ? renderPolicyGroup(childGroup) : '');
}

function renderPolicyGroup(group: ProseMirrorNode): string {
  let html = '';
  for (let index = 0; index < group.childCount;) {
    const container = group.child(index);
    const type = container.firstChild?.type.name;
    if (type === 'bulletListItem' || type === 'numberedListItem' || type === 'checkListItem') {
      const items: string[] = [];
      for (; index < group.childCount && group.child(index).firstChild?.type.name === type; index += 1) {
        items.push(renderPolicyContainer(group.child(index)));
      }
      const tag = type === 'numberedListItem' ? 'ol' : 'ul';
      const checkAttribute = type === 'checkListItem' ? ' data-checklist="true"' : '';
      html += `<${tag}${checkAttribute}>${items.join('')}</${tag}>`;
      continue;
    }
    html += renderPolicyContainer(container);
    index += 1;
  }
  return html;
}

/** Serializes the durable policy JSON to public policy HTML. */
export function policyTiptapDocumentToHtml(document: ProseMirrorNode): string {
  const validationError = validatePolicyTiptapDocument(document);
  if (validationError) {
    throw new Error(validationError);
  }
  const group = document.firstChild;
  return normalizePolicyHtmlLinks(group?.type.name === 'blockGroup' ? renderPolicyGroup(group) : '');
}

const POLICY_AUTHORING_CAPABILITIES = {
  ai: false,
  externalVideo: false,
  file: false,
  map: false,
  math: false,
  p5: false,
  shader: false,
  table: true,
  three: false,
} satisfies TiptapAuthoringCapabilities;

export interface PolicyTiptapEditorProps {
  blockRoomController: RichTextBlockRoomTiptapController;
  awareness?: Awareness;
  editable?: boolean;
  structureLocked?: boolean;
  userName?: string;
  userColor?: string;
  onEditorReady?: (editor: PolicyTiptapEditorInstance) => void;
  onUnsupportedContent?: (message: string) => void;
}

export function PolicyTiptapEditor({
  blockRoomController,
  awareness,
  editable = true,
  structureLocked = false,
  userName,
  userColor,
  onEditorReady,
  onUnsupportedContent,
}: PolicyTiptapEditorProps) {
  const onUnsupportedContentRef = useRef(onUnsupportedContent);
  const [unsupportedContent, setUnsupportedContent] = useState<string | null>(null);
  onUnsupportedContentRef.current = onUnsupportedContent;
  const reportUnsupported = useCallback((message: string) => {
    setUnsupportedContent(message);
    onUnsupportedContentRef.current?.(message);
  }, []);
  const authoringMode = useMemo<EditorAuthoringMode>(
    () => ({
      allowNeutralBlockEdits: editable && !structureLocked,
      allowLocalizedBlockEdits: editable,
    }),
    [editable, structureLocked],
  );
  const localUser = useMemo(
    () => ({ name: userName ?? 'Admin', color: userColor ?? '#b02d23' }),
    [userColor, userName],
  );
  const additionalExtensions = useMemo(() => [createPolicyContentGuard(reportUnsupported)], [reportUnsupported]);
  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      if (!editor) {
        return;
      }
      const error = validatePolicyTiptapDocument(editor.state.doc);
      if (error) {
        reportUnsupported(error);
        return;
      }
      onEditorReady?.(editor);
    },
    [onEditorReady, reportUnsupported],
  );

  if (unsupportedContent) {
    return (
      <div role="alert" data-testid="policy-tiptap-unsupported-content">
        {unsupportedContent}
      </div>
    );
  }

  if (!awareness) {
    throw new Error('Policy Block-room editor requires provider awareness.');
  }

  return (
    <div data-editor-profile="policy">
      <EditorAuthoringModeProvider value={authoringMode}>
        <TiptapEditor
          blockRoomController={blockRoomController}
          awareness={awareness}
          localUser={localUser}
          editable={editable}
          structureLocked={structureLocked}
          externalVideo={false}
          ai={false}
          authoringCapabilities={POLICY_AUTHORING_CAPABILITIES}
          additionalExtensions={additionalExtensions}
          onEditorReady={handleEditorReady}
        />
      </EditorAuthoringModeProvider>
    </div>
  );
}
