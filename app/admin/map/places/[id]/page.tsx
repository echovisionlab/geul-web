'use client';
import { use } from 'react';
import Page from '@/features/admin/map-place/MapPlaceDetailPage';
export default function Route({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Page id={id} />;
}
