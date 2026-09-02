'use client';

import { type JSONContent } from '@tiptap/core';
import { type ReactNode, useMemo } from 'react';
import { Field } from '@/components/core/Field';
import { ControlledTiptapEditor } from '@/features/editor/tiptap/profiles/ControlledTiptapEditor';
import {
  WireBlockContainer,
  WireBlockGroup,
  WireBold,
  WireDocument,
  WireHardBreak,
  WireHeading,
  WireItalic,
  WireLink,
  WireNumberedListItem,
  WireParagraph,
  WireStrike,
  WireText,
  WireBulletListItem,
} from '@/features/editor/tiptap/wire-schema';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import classes from './DescriptionEditor.module.css';

interface ImmersiveSceneDescriptionEditorProps {
  label: string;
  description?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  variant?: 'description' | 'attribution';
}

const DESCRIPTION_BLOCK_TYPES = new Set(['paragraph', 'heading', 'bulletListItem', 'numberedListItem']);

function normalizeMarkdown(value: string) {
  return value.replace(/\r\n?/g, '\n').trimEnd();
}

/** The small, Markdown-backed profile used only by immersive-scene copy. */
export function createImmersiveSceneDescriptionExtensions() {
  return [
    WireDocument,
    WireBlockGroup,
    WireBlockContainer,
    WireParagraph,
    WireHeading,
    WireBulletListItem,
    WireNumberedListItem,
    WireText,
    WireHardBreak,
    WireBold,
    WireItalic,
    WireStrike,
    WireLink,
  ];
}

type DescriptionMark = NonNullable<JSONContent['marks']>[number];

function textContent(text: string, marks: DescriptionMark[] = []): JSONContent[] {
  const content: JSONContent[] = [];
  const parts = text.split('\n');
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]) {
      content.push({ type: 'text', text: parts[index], ...(marks.length > 0 ? { marks } : {}) });
    }
    if (index < parts.length - 1) {
      content.push({ type: 'hardBreak' });
    }
  }
  return content;
}

function applyMark(content: JSONContent[], mark: DescriptionMark): JSONContent[] {
  return content.map((node) => (node.type === 'text' ? { ...node, marks: [...(node.marks ?? []), mark] } : node));
}

/** Parses the supported Markdown subset without silently accepting rich HTML. */
function markdownInlineContent(value: string, marks: DescriptionMark[] = []): JSONContent[] {
  const output: JSONContent[] = [];
  let cursor = 0;
  const token = /\[([^\]]*)\]\(([^\s)]+)\)|(\*\*|__|~~|\*|_)(.+?)\3/g;

  for (let match = token.exec(value); match; match = token.exec(value)) {
    if (match.index > cursor) {
      output.push(...textContent(value.slice(cursor, match.index), marks));
    }
    if (match[1] !== undefined) {
      const href = normalizeRichTextHref(match[2]);
      const label = markdownInlineContent(match[1], marks);
      output.push(...(href ? applyMark(label, { type: 'link', attrs: { href } }) : label));
    } else {
      const marker = match[3];
      const mark = marker === '~~' ? 'strike' : marker === '*' || marker === '_' ? 'italic' : 'bold';
      output.push(...markdownInlineContent(match[4], [...marks, { type: mark }]));
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    output.push(...textContent(value.slice(cursor), marks));
  }
  return output;
}

function descriptionBlock(type: string, text: string, attrs: Record<string, unknown> = {}): JSONContent {
  return {
    type: 'blockContainer',
    content: [{ type, ...(Object.keys(attrs).length > 0 ? { attrs } : {}), content: markdownInlineContent(text) }],
  };
}

/** Converts the persisted Markdown value to the local Tiptap wire document. */
export function markdownToImmersiveSceneDocument(value: string): JSONContent {
  const blocks: JSONContent[] = [];
  for (const line of normalizeMarkdown(value).split('\n')) {
    if (!line.trim()) {
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(descriptionBlock('heading', heading[2], { level: heading[1].length }));
    } else if (bullet) {
      blocks.push(descriptionBlock('bulletListItem', bullet[1]));
    } else if (numbered) {
      blocks.push(descriptionBlock('numberedListItem', numbered[2], { start: Number(numbered[1]) }));
    } else {
      blocks.push(descriptionBlock('paragraph', line));
    }
  }
  return {
    type: 'doc',
    content: [{ type: 'blockGroup', content: blocks.length > 0 ? blocks : [descriptionBlock('paragraph', '')] }],
  };
}

function markdownForInline(node: JSONContent): string {
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (node.type !== 'text') {
    return '';
  }
  let result = node.text ?? '';
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'link': {
        const href = normalizeRichTextHref(String(mark.attrs?.href ?? ''));
        result = href ? `[${result}](${href})` : result;
        break;
      }
    }
  }
  return result;
}

/** Serializes only this profile's supported Tiptap document back to Markdown. */
export function immersiveSceneDocumentToMarkdown(document: JSONContent): string {
  const group = document.content?.find((node) => node.type === 'blockGroup');
  if (!group) {
    return '';
  }
  return normalizeMarkdown(
    (group.content ?? [])
      .flatMap((container) => {
        const block = container.content?.[0];
        if (!block || !DESCRIPTION_BLOCK_TYPES.has(block.type ?? '')) {
          return [];
        }
        const inline = (block.content ?? []).map(markdownForInline).join('');
        if (block.type === 'heading') {
          return `${'#'.repeat(Math.min(6, Math.max(1, Number(block.attrs?.level) || 1)))} ${inline}`;
        }
        if (block.type === 'bulletListItem') {
          return `- ${inline}`;
        }
        if (block.type === 'numberedListItem') {
          return `${Math.max(1, Number(block.attrs?.start) || 1)}. ${inline}`;
        }
        return inline;
      })
      .join('\n'),
  );
}

export function ImmersiveSceneDescriptionEditor({
  label,
  description,
  value,
  onChange,
  testId,
  variant = 'description',
}: ImmersiveSceneDescriptionEditorProps) {
  const extensions = useMemo(() => createImmersiveSceneDescriptionExtensions(), []);

  return (
    <Field label={label} description={description}>
      <div className={classes.root} data-testid={testId} data-variant={variant} data-editor-engine="tiptap">
        <ControlledTiptapEditor
          value={value}
          extensions={extensions}
          parseValue={markdownToImmersiveSceneDocument}
          serializeValue={immersiveSceneDocumentToMarkdown}
          normalizeValue={normalizeMarkdown}
          onChange={onChange}
          contentClassName="bn-editor tiptap-editor__content"
          contentTestId="immersive-scene-description-content"
          profile="immersive-scene-copy"
        />
      </div>
    </Field>
  );
}
