import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { tiptapDocumentToHtml, type TiptapHtmlOptions } from './profile-html';

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
  'siteVariable',
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

/** Serializes the durable policy JSON to public policy HTML. */
export function policyTiptapDocumentToHtml(document: ProseMirrorNode, options: TiptapHtmlOptions = {}): string {
  const error = validatePolicyTiptapDocument(document);
  if (error) {
    throw new Error(error);
  }
  return tiptapDocumentToHtml(document, options);
}
