'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { IconArticle, IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { Spotlight } from '@mantine/spotlight';
import { searchPublishedPosts } from '@/lib/queries/post-browser';

interface SearchedPost {
  id: string;
  title: string;
  slug: string;
  featuredImageUrl: string;
}

export function PostSpotlight() {
  const router = useRouter();
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['post', 'searchPublished', debouncedQuery],
    queryFn: () => searchPublishedPosts(debouncedQuery, 10),
    enabled: debouncedQuery.length >= 2,
  });

  // searchPublishedPostsAction returns an array of posts directly
  const posts = (data ?? []) as SearchedPost[];

  const actions = posts.map((post) => ({
    id: post.id,
    label: post.title || tCommonStates('untitledPlain'),
    leftSection: post.featuredImageUrl ? (
      <Box
        style={{
          width: 38,
          height: 38,
          borderRadius: 'var(--mantine-radius-sm)',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <NextImage
          src={post.featuredImageUrl}
          alt={post.title || ''}
          fill
          sizes="38px"
          style={{ objectFit: 'cover' }}
        />
      </Box>
    ) : (
      <IconArticle size={24} />
    ),
    onClick: () => {
      router.push(`/posts/${post.slug || post.id}`);
    },
  }));

  const getNothingFoundMessage = () => {
    if (query.length === 0) {
      return tCommonPlaceholders('searchPosts');
    }
    if (query.length < 2) {
      return tCommonMessages('typeAtLeast2Characters', { count: 2 });
    }
    if (isLoading) {
      return tCommonStates('loading');
    }
    return tCommonMessages('noPostsFound');
  };

  return (
    <Spotlight
      actions={actions}
      query={query}
      onQueryChange={setQuery}
      shortcut="mod + /"
      nothingFound={getNothingFoundMessage()}
      highlightQuery
      searchProps={{
        placeholder: tCommonPlaceholders('searchPosts'),
        leftSection: <IconSearch size={20} />,
      }}
      styles={{
        content: {
          padding: 'var(--mantine-spacing-sm)',
        },
        search: {
          border: 'none',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          borderRadius: 0,
          background: 'transparent',
        },
        action: {
          padding: 'var(--mantine-spacing-sm)',
          borderRadius: 'var(--mantine-radius-md)',
        },
        actionBody: {
          flex: 1,
        },
        actionsGroup: {
          padding: 'var(--mantine-spacing-xs) 0',
        },
      }}
      filter={() => actions}
    >
      {actions.map((action) => (
        <Spotlight.Action key={action.id} onClick={action.onClick}>
          <Group wrap="nowrap" w="100%" gap="md">
            {action.leftSection}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} truncate>
                {action.label}
              </Text>
            </div>
          </Group>
        </Spotlight.Action>
      ))}
    </Spotlight>
  );
}
