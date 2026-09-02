import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Box, Group, Stack, Text, Title } from '@mantine/core';
import { TableOfContents, type TocItem } from '@/features/navigation/TableOfContents';
import { buildLoginRedirectHref } from '@/lib/auth/login-page';
import { getChangelogReleases, type ChangelogInlinePart } from '@/lib/changelog/changelog';
import { APP_VERSION_LABEL } from '@/lib/site-version';
import { getRequestHeaders } from '@/lib/utils/header.server';
import { getRequestPathWithSearchFromHeaders } from '@/lib/utils/request-path';
import { getSession } from '@/lib/utils/session.server';
import classes from './ChangelogPage.module.css';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Recent product updates and fixes.',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';

export default async function ChangelogPage() {
  const session = await getSession();

  if (!session?.user) {
    const headersList = await getRequestHeaders();
    const currentPath = getRequestPathWithSearchFromHeaders(headersList, '/changelog');
    redirect(buildLoginRedirectHref(currentPath));
  }

  if (session.user.role !== 'admin' && session.user.role !== 'author') {
    redirect('/');
  }

  const releases = await getChangelogReleases();
  const tocItems = buildChangelogTocItems(releases);

  return (
    <Stack gap="xl">
      <Stack component="header" gap="xs">
        <Group gap="sm" align="baseline">
          <Title order={1}>Changelog</Title>
          <Text size="sm" c="dimmed">
            {APP_VERSION_LABEL}
          </Text>
        </Group>
        <Text c="dimmed" maw={720}>
          Product updates, fixes, and internal release notes for Geul.
        </Text>
      </Stack>

      <Box className={`prose changelog-content ${classes.content}`}>
        {releases.map((release) => (
          <Stack
            component="section"
            key={release.version}
            gap="md"
            mb="xl"
            aria-labelledby={`release-${release.version}`}
          >
            <Group gap="sm" align="baseline">
              <Title order={2} id={`release-${release.version}`}>
                {release.version}
              </Title>
              {release.date ? (
                <Text component="span" size="sm" c="dimmed">
                  {release.date}
                </Text>
              ) : null}
            </Group>

            {release.groups.map((group) => (
              <Box key={`${release.version}-${group.title}`}>
                <Title order={3} id={getReleaseGroupHeadingId(release.version, group.title)}>
                  {group.title}
                </Title>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.rawText}>{renderInlineParts(item.parts)}</li>
                  ))}
                </ul>
              </Box>
            ))}
          </Stack>
        ))}
      </Box>

      <TableOfContents items={tocItems} />
    </Stack>
  );
}

function buildChangelogTocItems(releases: Awaited<ReturnType<typeof getChangelogReleases>>): TocItem[] {
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
