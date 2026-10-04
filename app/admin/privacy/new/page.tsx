'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Box } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';
import { notifications } from '@mantine/notifications';
import { createPrivacyVersionAction } from '@/lib/actions/privacy';

export default function NewPrivacyPage() {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  const createMutation = useMutation({
    mutationFn: createPrivacyVersionAction,
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        startNavigation(() => {
          router.replace('/admin/privacy');
        });
        return;
      }
      if (result.data) {
        const href = `/privacy/history/${result.data.id}?edit=true`;
        startNavigation(() => {
          router.replace(href);
        });
      }
    },
  });

  useEffect(() => {
    createMutation.mutate();
  }, []);

  return (
    <Box pos="relative" h="100%" mih={200}>
      <PageLoader
        height="100%"
        minHeight={200}
        message={createMutation.isPending || isNavigating ? 'Creating new version...' : 'Redirecting...'}
      />
    </Box>
  );
}
