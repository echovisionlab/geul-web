'use client';

import { LayoutInline as DsLayoutInline, LayoutInset as DsLayoutInset } from '@/components/core/Layout';

import { Skeleton } from '@/components/core/Display';

export function CreditGroupHeaderSkeleton() {
  return (
    <DsLayoutInset block="xxs">
      <DsLayoutInline gap="xs">
        <Skeleton roleType="icon" />
        <Skeleton roleType="text" />
      </DsLayoutInline>
    </DsLayoutInset>
  );
}

export function CreditSkeleton() {
  return (
    <DsLayoutInset block="xxs">
      <DsLayoutInline gap="xs">
        <Skeleton roleType="icon" />
        <Skeleton roleType="icon" shape="circle" />
        <Skeleton roleType="text" />
        <Skeleton roleType="text" />
        <Skeleton roleType="text" />
      </DsLayoutInline>
    </DsLayoutInset>
  );
}
