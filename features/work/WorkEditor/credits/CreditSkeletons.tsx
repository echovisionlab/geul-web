'use client';

import { Group, Skeleton } from '@mantine/core';

export function CreditGroupHeaderSkeleton() {
  return (
    <Group gap="xs" py={6}>
      <Skeleton width={14} height={14} radius="sm" />
      <Skeleton width={100} height={14} radius="sm" />
    </Group>
  );
}

export function CreditSkeleton() {
  return (
    <Group gap="xs" py={4}>
      <Skeleton width={14} height={14} radius="sm" />
      <Skeleton circle width={20} height={20} />
      <Skeleton width={80} height={12} radius="sm" />
      <Skeleton width={40} height={16} radius="sm" />
      <Skeleton width={60} height={12} radius="sm" />
    </Group>
  );
}
