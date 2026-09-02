import { cache } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_VERSION } from '@/lib/site-version';

export interface ChangelogInlineText {
  type: 'text';
  text: string;
}

export interface ChangelogInlineLink {
  type: 'link';
  text: string;
  href: string;
}

export type ChangelogInlinePart = ChangelogInlineText | ChangelogInlineLink;

export interface ChangelogItem {
  parts: ChangelogInlinePart[];
  rawText: string;
}

export interface ChangelogGroup {
  title: string;
  items: ChangelogItem[];
}

export interface ChangelogRelease {
  version: string;
  url: string | null;
  date: string | null;
  groups: ChangelogGroup[];
}

const FALLBACK_CHANGELOG_MARKDOWN = `## [${APP_VERSION}](https://github.com/echovisionlab/geul-web/releases) (Preview)

### Changes

* This preview is shown when the deployed app cannot read CHANGELOG.md.
`;

const RELEASE_HEADING_PATTERN = /^## (?:\[([^\]]+)]\(([^)]+)\)|([^\s(]+))(?: \(([^)]+)\))?$/;
const GROUP_HEADING_PATTERN = /^###\s+(.+)$/;
const BULLET_PATTERN = /^[*-]\s+(.+)$/;
const INLINE_LINK_PATTERN = /\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g;

export const getChangelogReleases = cache(async (): Promise<ChangelogRelease[]> => {
  const markdown = await readChangelogMarkdown();

  return parseChangelogMarkdown(markdown);
});

export function parseChangelogMarkdown(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  const releaseIndexes = new Map<string, number>();
  let currentRelease: ChangelogRelease | null = null;
  let currentGroup: ChangelogGroup | null = null;

  const commitCurrentRelease = () => {
    if (!currentRelease) {
      return;
    }

    currentRelease.groups = currentRelease.groups.filter((group) => group.items.length > 0);

    const existingIndex = releaseIndexes.get(currentRelease.version);
    if (existingIndex === undefined) {
      releaseIndexes.set(currentRelease.version, releases.length);
      releases.push(currentRelease);
      return;
    }

    const existingRelease = releases[existingIndex];
    if (countReleaseItems(currentRelease) > countReleaseItems(existingRelease)) {
      releases[existingIndex] = currentRelease;
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const releaseMatch = line.match(RELEASE_HEADING_PATTERN);
    if (releaseMatch) {
      commitCurrentRelease();
      currentRelease = {
        version: releaseMatch[1] ?? releaseMatch[3],
        url: releaseMatch[2] ?? null,
        date: releaseMatch[4] ?? null,
        groups: [],
      };
      currentGroup = null;
      continue;
    }

    if (!currentRelease) {
      continue;
    }

    const groupMatch = line.match(GROUP_HEADING_PATTERN);
    if (groupMatch) {
      currentGroup = {
        title: groupMatch[1],
        items: [],
      };
      currentRelease.groups.push(currentGroup);
      continue;
    }

    const bulletMatch = line.match(BULLET_PATTERN);
    if (!bulletMatch) {
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        title: 'Changes',
        items: [],
      };
      currentRelease.groups.push(currentGroup);
    }

    const rawText = bulletMatch[1];
    currentGroup.items.push({
      rawText,
      parts: parseInlineMarkdownLinks(rawText),
    });
  }

  commitCurrentRelease();

  return releases;
}

function parseInlineMarkdownLinks(markdown: string): ChangelogInlinePart[] {
  const parts: ChangelogInlinePart[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(INLINE_LINK_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({
        type: 'text',
        text: markdown.slice(lastIndex, index),
      });
    }

    parts.push({
      type: 'link',
      text: match[1],
      href: match[2],
    });

    lastIndex = index + match[0].length;
  }

  if (lastIndex < markdown.length) {
    parts.push({
      type: 'text',
      text: markdown.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: markdown }];
}

async function readChangelogMarkdown(): Promise<string> {
  const deployedMarkdown = await readFile(
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'CHANGELOG.md'),
    'utf8',
  ).catch(() => null);
  if (deployedMarkdown) {
    return deployedMarkdown;
  }

  return FALLBACK_CHANGELOG_MARKDOWN;
}

function countReleaseItems(release: ChangelogRelease): number {
  return release.groups.reduce((total, group) => total + group.items.length, 0);
}
