import type { ReactNode } from 'react';
import { Anchor } from '@mantine/core';

/**
 * Parse markdown-style formatting in text and return ReactNode
 * Supports: **bold**, *italic*, ~~strike~~, __underline__, [link](url)
 * All links open in a new tab
 */
interface Pattern {
  regex: RegExp;
  render: (key: number, match: RegExpExecArray) => ReactNode;
}

export function parseMarkdown(text: string): ReactNode {
  // Order matters: more specific patterns first
  const patterns: Pattern[] = [
    // Links: [text](url)
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (key, match) => (
        <Anchor key={key} component="a" href={match[2]} target="_blank" inherit>
          {parseMarkdown(match[1])}
        </Anchor>
      ),
    },
    // Bold: **text**
    {
      regex: /\*\*([^*]+)\*\*/,
      render: (key, match) => <strong key={key}>{parseMarkdown(match[1])}</strong>,
    },
    // Underline: __text__
    {
      regex: /__([^_]+)__/,
      render: (key, match) => <u key={key}>{parseMarkdown(match[1])}</u>,
    },
    // Strikethrough: ~~text~~
    {
      regex: /~~([^~]+)~~/,
      render: (key, match) => <s key={key}>{parseMarkdown(match[1])}</s>,
    },
    // Italic: *text*
    {
      regex: /\*([^*]+)\*/,
      render: (key, match) => <em key={key}>{parseMarkdown(match[1])}</em>,
    },
  ];

  let result = text;
  const parts: ReactNode[] = [];
  let keyCounter = 0;

  // Find the first matching pattern
  let foundMatch = true;
  while (foundMatch) {
    foundMatch = false;
    let earliestMatch: {
      index: number;
      pattern: (typeof patterns)[0];
      match: RegExpExecArray;
    } | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(result);
      if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
        earliestMatch = { index: match.index, pattern, match };
      }
    }

    if (earliestMatch) {
      foundMatch = true;
      const { index, pattern, match } = earliestMatch;

      // Add text before match
      if (index > 0) {
        parts.push(result.slice(0, index));
      }

      // Add rendered element
      parts.push(pattern.render(keyCounter++, match));

      // Continue with remaining text
      result = result.slice(index + match[0].length);
    }
  }

  // Add remaining text
  if (result) {
    parts.push(result);
  }

  if (parts.length === 0) {
    return text;
  }

  if (parts.length === 1 && typeof parts[0] === 'string') {
    return parts[0];
  }

  return <>{parts}</>;
}
