'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

// The public label route renders this editor only in edit mode; loading it on demand keeps the
// rich-text editor out of the anonymous label page's first load (same pattern as LazyReleaseEditor).
const AdminLabelDetailClient = dynamic(() =>
  withQueryClient(import('./AdminLabelDetailClient').then((module) => module.AdminLabelDetailClient)),
);

type Props = ComponentProps<typeof AdminLabelDetailClient>;

export function LazyAdminLabelDetailClient(props: Props) {
  return <AdminLabelDetailClient {...props} />;
}
