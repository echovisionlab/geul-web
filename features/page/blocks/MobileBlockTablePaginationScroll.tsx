'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseBlockTableQuery } from './table-utils';

interface MobileBlockTablePaginationScrollProps {
  namespace: string;
  targetId: string;
}

export function MobileBlockTablePaginationScroll({ namespace, targetId }: MobileBlockTablePaginationScrollProps) {
  const searchParams = useSearchParams();
  const page = parseBlockTableQuery(searchParams, namespace, 1).page ?? 1;
  const previousPageRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousPageRef.current === null) {
      previousPageRef.current = page;
      return;
    }

    if (previousPageRef.current === page) {
      return;
    }

    previousPageRef.current = page;

    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 768px)').matches) {
      return;
    }

    document.getElementById(targetId)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    });
  }, [page, targetId]);

  return null;
}
