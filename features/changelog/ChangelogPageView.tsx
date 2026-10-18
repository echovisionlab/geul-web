'use client';
import { SupportingText, Heading as DsHeading, Text as DsText, List, ListItem } from '@/components/core/Typography';
import {
  LayoutContainer as DsLayoutContainer,
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import type { ReactNode } from 'react';
import Link from '@/components/core/Navigation';

// Leaf modules: these documents have no authored layout, so the collaboration schema stays off the route.
import { ContentChrome } from '@/features/document-layout/ui/ContentChrome';
import { ContentLayoutView } from '@/features/document-layout/ui/ContentLayoutView';
import { FLOW_DOCUMENT_LAYOUT } from '@/features/document-layout/ui/types';
import { TableOfContents, type TocItem } from '@/features/navigation/TableOfContents';
import type { ChangelogRelease, ChangelogInlinePart } from '@/lib/changelog/changelog';
import { APP_VERSION_LABEL } from '@/lib/site-version';

/** Release notes read as one running-text document: reading column from the start edge, outline at the end. */
export function ChangelogPageView({ releases }: { releases: ChangelogRelease[] }) {
  const tocItems = buildChangelogTocItems(releases);
  const header = (
    <DsLayoutStack as="header" gap="xs" lang="en">
      <DsLayoutInline gap="sm" align="baseline">
        <DsHeading level={1} scale="title">
          Changelog
        </DsHeading>
        <DsText size="sm" tone="secondary">
          {APP_VERSION_LABEL}
        </DsText>
      </DsLayoutInline>
      <DsLayoutStack>
        <SupportingText tone="secondary">Product updates, fixes, and internal release notes.</SupportingText>
      </DsLayoutStack>
    </DsLayoutStack>
  );
  return (
    <ContentLayoutView layout={FLOW_DOCUMENT_LAYOUT} chrome={<ContentChrome measure="reading">{header}</ContentChrome>}>
      <TableOfContents items={tocItems}>
        <DsLayoutContainer size="reading" inset="none" placement="start">
          <DsLayoutStack gap="none" lang="en">
            {releases.map((release) => (
              <DsLayoutInset key={release.version} blockEnd="xl">
                <DsLayoutStack as="section" gap="md" aria-labelledby={`release-${release.version}`}>
                  <DsLayoutInline gap="sm" align="baseline">
                    <DsHeading level={2} id={`release-${release.version}`}>
                      {release.version}
                    </DsHeading>
                    {release.date ? (
                      <DsText as="span" size="sm" tone="secondary">
                        {release.date}
                      </DsText>
                    ) : null}
                  </DsLayoutInline>

                  {release.groups.map((group) => (
                    <div key={`${release.version}-${group.title}`}>
                      <DsHeading level={3} id={getReleaseGroupHeadingId(release.version, group.title)}>
                        {group.title}
                      </DsHeading>
                      <List leading="document">
                        {group.items.map((item) => (
                          <ListItem key={item.rawText}>{renderInlineParts(item.parts)}</ListItem>
                        ))}
                      </List>
                    </div>
                  ))}
                </DsLayoutStack>
              </DsLayoutInset>
            ))}
          </DsLayoutStack>
        </DsLayoutContainer>
      </TableOfContents>
    </ContentLayoutView>
  );
}
function buildChangelogTocItems(releases: ChangelogRelease[]): TocItem[] {
  return releases.flatMap((release) => [
    {
      id: getReleaseHeadingId(release.version),
      label: release.version,
      level: 2,
    },
    ...release.groups.map((group) => ({
      id: getReleaseGroupHeadingId(release.version, group.title),
      label: group.title,
      level: 3,
    })),
  ]);
}

function getReleaseHeadingId(version: string): string {
  return `release-${version}`;
}

function getReleaseGroupHeadingId(version: string, title: string): string {
  return `release-${version}-${slugifyHeading(title)}`;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function renderInlineParts(parts: ChangelogInlinePart[]): ReactNode[] {
  return parts.map((part, index) => {
    if (part.type === 'text') {
      return part.text;
    }

    return (
      <Link href={part.href} key={`${part.href}-${index}`} target="_blank" rel="noopener noreferrer">
        {part.text}
      </Link>
    );
  });
}
