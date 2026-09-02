'use client';

import NextImage from 'next/image';
import Link from 'next/link';
import { Anchor, Box, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { isManagedCdnAssetUrl } from '@/lib/utils/file-url';
import type { AuthorListProps } from './schema';
import linkClasses from '../EntityLink.module.css';

interface AuthorListAuthor {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  post_count: number;
}

interface AuthorListViewClientProps {
  authors: AuthorListAuthor[];
  parsedProps: AuthorListProps;
}

function AuthorAvatar({ src, name, size }: { src: string | null; name: string | null; size: number }) {
  if (src) {
    return (
      <Box
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <NextImage
          src={src}
          alt={name ?? ''}
          fill
          sizes={`${size}px`}
          style={{ objectFit: 'cover' }}
          unoptimized={src.startsWith('http') && !isManagedCdnAssetUrl(src)}
        />
      </Box>
    );
  }

  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: 'var(--mantine-color-blue-filled)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.4,
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </Box>
  );
}

function AuthorAvatarLink({ author, size }: { author: AuthorListAuthor; size: number }) {
  return (
    <Link
      href={`/user/${author.id}`}
      aria-label={author.name ?? undefined}
      tabIndex={-1}
      style={{
        display: 'block',
        borderRadius: '50%',
        color: 'inherit',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <AuthorAvatar src={author.image} name={author.name} size={size} />
    </Link>
  );
}

export function AuthorListViewClient({ authors, parsedProps: p }: AuthorListViewClientProps) {
  const layout = p.layout || 'grid';
  const columns = parseInt(p.columns || '3', 10);
  const showBio = p.showBio !== 'false';
  const showAvatar = p.showAvatar !== 'false';

  if (!authors?.length) {
    return (
      <Text c="dimmed" ta="center" py="xl" className="author-list-block">
        No authors found
      </Text>
    );
  }

  if (layout === 'list') {
    return (
      <Stack gap={0} className="author-list-block">
        {authors.map((author) => (
          <Box
            key={author.id}
            py="sm"
            style={{
              borderBottom: '1px solid color-mix(in srgb, var(--mantine-color-default-border) 55%, transparent)',
            }}
          >
            <Group wrap="nowrap" gap="md">
              {showAvatar ? <AuthorAvatarLink author={author} size={56} /> : null}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Anchor
                  component={Link}
                  href={`/user/${author.id}`}
                  fw={500}
                  size="sm"
                  c="inherit"
                  td="none"
                  className={linkClasses.link}
                >
                  {author.name}
                </Anchor>
                {showBio && author.bio && (
                  <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                    {author.bio}
                  </Text>
                )}
                {author.post_count > 0 && (
                  <Text size="xs" c="dimmed" mt={4}>
                    {author.post_count} posts
                  </Text>
                )}
              </div>
            </Group>
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: columns }} spacing="lg" className="author-list-block">
      {authors.map((author) => (
        <Group key={author.id} align="flex-start" wrap="nowrap" gap="md">
          {showAvatar ? <AuthorAvatarLink author={author} size={64} /> : null}
          <div style={{ minWidth: 0 }}>
            <Anchor
              component={Link}
              href={`/user/${author.id}`}
              fw={500}
              size="sm"
              c="inherit"
              td="none"
              className={linkClasses.link}
            >
              {author.name}
            </Anchor>
            {showBio && author.bio && (
              <Text size="sm" c="dimmed" lineClamp={2} mt={4}>
                {author.bio}
              </Text>
            )}
            {author.post_count > 0 && (
              <Text size="xs" c="dimmed" mt={4}>
                {author.post_count} posts
              </Text>
            )}
          </div>
        </Group>
      ))}
    </SimpleGrid>
  );
}
