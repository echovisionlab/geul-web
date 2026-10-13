'use client';
import type { ComponentProps } from 'react';
import { ListBlockSkeleton } from '../ListBlockSkeleton';
type PostListSkeletonProps = Omit<ComponentProps<typeof ListBlockSkeleton>, 'className'>;
export function PostListSkeleton(props: PostListSkeletonProps) {
  return <ListBlockSkeleton {...props} className="post-list-block" />;
}
