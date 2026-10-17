'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { useTranslations } from 'next-intl';
import { getCollectionMetrics } from '@/components/core/Collection/collection-contract';
import { collectionMinColumnWidth } from '@/features/page/blocks/content-layout';
import {
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';
import { SectionCard as DsSectionCard } from '@/components/core/Section';

import { Avatar, type AvatarSize } from '@/components/core/Display';
import Link, { NavigationLink as Anchor } from '@/components/core/Navigation';
import type { AuthorListProps } from './schema';
interface AuthorListAuthor {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  post_count: number;
}
export interface AuthorListViewClientProps {
  authors: AuthorListAuthor[];
  parsedProps: AuthorListProps;
}
function AuthorAvatar({ src, name, size }: { src: string | null; name: string | null; size: AvatarSize }) {
  return <Avatar src={src} alt={name ?? undefined} size={size} shape="circle" name={name} />;
}
function AuthorAvatarLink({ author, size }: { author: AuthorListAuthor; size: AvatarSize }) {
  return (
    <Link href={`/user/${author.id}`} aria-label={author.name ?? undefined} tabIndex={-1}>
      <AuthorAvatar src={author.image} name={author.name} size={size} />
    </Link>
  );
}
export function AuthorListViewClient({ authors, parsedProps: p }: AuthorListViewClientProps) {
  const t = useTranslations();
  const metrics = getCollectionMetrics(p.itemSize);
  const layout = p.layout || 'grid';
  const showBio = p.showBio !== 'false';
  const showAvatar = p.showAvatar !== 'false';
  if (!authors?.length) {
    return (
      <div className="author-list-block" data-collection-size={p.itemSize}>
        <DsLayoutInset block="xl">
          <SupportingText tone="secondary" align="center">
            {t('common.messages.noAuthorsFound')}
          </SupportingText>
        </DsLayoutInset>
      </div>
    );
  }
  const displayAuthors = authors.map((author) => ({
    ...author,
    name: author.name?.trim() || t('common.states.unknownAuthor'),
  }));
  if (layout === 'list') {
    return (
      <div className="author-list-block" data-collection-size={p.itemSize} role="list">
        <DsLayoutStack gap="none">
          {displayAuthors.map((author) => (
            <DsSectionCard role="listitem" key={author.id} padding="none" appearance="plain" border="block-end">
              <DsLayoutInset block={metrics.rowInset}>
                <DsLayoutInset space="none">
                  <DsLayoutInline wrap="nowrap" gap={metrics.rowGap}>
                    {showAvatar ? <AuthorAvatarLink author={author} size={metrics.avatarSize} /> : null}
                    <DsLayoutInset flexible space="none">
                      <Anchor href={`/user/${author.id}`} weight="medium" appearance="quiet" tone="inherit">
                        <DsText as="span" size={metrics.titleSize} weight="medium" lines={2}>
                          {author.name}
                        </DsText>
                      </Anchor>
                      {showBio && author.bio && (
                        <DsLayoutInset blockStart="xxs">
                          <DsText size={metrics.metaSize} tone="secondary" lines={2}>
                            {author.bio}
                          </DsText>
                        </DsLayoutInset>
                      )}
                      {author.post_count > 0 && (
                        <DsLayoutInset blockStart="xxs">
                          <DsText size={metrics.metaSize} tone="secondary">
                            {t('pageEditor.blockEditor.badges.posts', { count: author.post_count })}
                          </DsText>
                        </DsLayoutInset>
                      )}
                    </DsLayoutInset>
                  </DsLayoutInline>
                </DsLayoutInset>
              </DsLayoutInset>
            </DsSectionCard>
          ))}
        </DsLayoutStack>
      </div>
    );
  }
  return (
    <div className="author-list-block" data-collection-size={p.itemSize} role="list">
      <DsLayoutGrid minColumnWidth={collectionMinColumnWidth('grid', p.itemSize)} gap={metrics.gridGap}>
        {displayAuthors.map((author) => (
          <DsLayoutInline role="listitem" key={author.id} align="start" wrap="nowrap" gap={metrics.rowGap}>
            {showAvatar ? <AuthorAvatarLink author={author} size={metrics.avatarSize} /> : null}
            <DsLayoutInset flexible space="none">
              <Anchor href={`/user/${author.id}`} weight="medium" appearance="quiet" tone="inherit">
                <DsText as="span" size={metrics.titleSize} weight="medium" lines={2}>
                  {author.name}
                </DsText>
              </Anchor>
              {showBio && author.bio && (
                <DsLayoutInset blockStart="xxs">
                  <DsText size={metrics.metaSize} tone="secondary" lines={2}>
                    {author.bio}
                  </DsText>
                </DsLayoutInset>
              )}
              {author.post_count > 0 && (
                <DsLayoutInset blockStart="xxs">
                  <DsText size={metrics.metaSize} tone="secondary">
                    {t('pageEditor.blockEditor.badges.posts', { count: author.post_count })}
                  </DsText>
                </DsLayoutInset>
              )}
            </DsLayoutInset>
          </DsLayoutInline>
        ))}
      </DsLayoutGrid>
    </div>
  );
}
