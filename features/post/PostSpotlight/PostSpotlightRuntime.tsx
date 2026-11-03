'use client';

import NextImage from 'next/image';
import { IconArticle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { PageLoader } from '@/features/site/PageLoader';
import { CommandPaletteResults } from '@/components/core/CommandPalette';
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
    icon: post.featuredImageUrl ? (
      <NextImage src={post.featuredImageUrl} alt="" fill sizes="36px" style={{ objectFit: 'cover' }} />
    ) : (
      <IconArticle size="1em" />
    ),
    href: `/posts/${post.slug || post.id}`,
  }));

  const getNothingFoundMessage = () => {
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

  if (query.length >= 2 && (isLoading || query !== debouncedQuery)) {
    return <PageLoader placement="flow" message={tCommonStates('loading')} />;
  }
  return (
    <CommandPaletteResults
      items={actions}
      label={tCommonPlaceholders('searchPosts')}
      emptyLabel={getNothingFoundMessage()}
      loading={isLoading}
    />
  );
}
