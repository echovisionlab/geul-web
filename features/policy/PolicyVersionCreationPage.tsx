'use client';
import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { PageLoader } from '@/features/site/PageLoader';
import { notifications } from '@/components/core/Notification';

export interface PolicyVersionCreationProps {
  policy: 'terms' | 'privacy';
  createVersion: () => Promise<{ error?: string; data?: { id: string } }>;
  navigate?: (href: string) => void;
}
/** The creation route has a loading surface while its server action creates a draft. */
export function PolicyVersionCreationPage({ policy, createVersion, navigate }: PolicyVersionCreationProps) {
  const router = useRouter();
  const started = useRef(false);
  const [, startNavigation] = useTransition();
  const mutation = useMutation({
    mutationFn: createVersion,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
      }
      const href = result.data && !result.error ? `/${policy}/history/${result.data.id}?edit=true` : `/admin/${policy}`;
      startNavigation(() => (navigate ?? router.replace)(href));
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
      startNavigation(() => (navigate ?? router.replace)(`/admin/${policy}`));
    },
  });
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      mutation.mutate();
    }
  }, [mutation]);
  return <PageLoader />;
}
