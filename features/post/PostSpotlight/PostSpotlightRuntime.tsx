'use client';

import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import { IconArticle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box } from '@mantine/core';
import { SpotlightAction, SpotlightActionsList, SpotlightEmpty } from '@mantine/spotlight';
import { searchPublishedPosts } from '@/lib/queries/post-browser';

interface SearchedPost {
  id: string;
  title: string;
  slug: string;
  featuredImageUrl: string;
}

export interface PostSpotlightRuntimeProps {
  query: string;
  debouncedQuery: string;
  opened: boolean;
}

export function PostSpotlightRuntime({ query, debouncedQuery, opened }: PostSpotlightRuntimeProps) {
  const router = useRouter();
  const tCommonMessages = useTranslations('common.messages');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tCommonStates = useTranslations('common.states');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['post', 'searchPublished', debouncedQuery],
    queryFn: () => searchPublishedPosts(debouncedQuery, 10),
    enabled: opened && debouncedQuery.length >= 2,
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
    if (isError) {
      return tCommonMessages('failedToLoad');
    }
    return tCommonMessages('noPostsFound');
  };

  if (actions.length === 0) {
    return <SpotlightEmpty>{getNothingFoundMessage()}</SpotlightEmpty>;
  }

  return (
    <SpotlightActionsList>
      {actions.map((action) => (
        <SpotlightAction key={action.id} {...action} highlightQuery />
      ))}
    </SpotlightActionsList>
  );
}
