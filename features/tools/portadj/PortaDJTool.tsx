'use client';

import dynamic from 'next/dynamic';
import { useComputedColorScheme } from '@mantine/core';

const PortaDJ = dynamic(() => import('@dsub/portadj/react').then((module) => module.PortaDJ), { ssr: false });

export function PortaDJTool() {
  const theme = useComputedColorScheme('light');

  return <PortaDJ theme={theme} />;
}
