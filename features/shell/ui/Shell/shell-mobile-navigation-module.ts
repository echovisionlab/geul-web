import { onDemandModule } from '@/components/core/on-demand-module';

/** Shared chunk boundary for the shell trigger and navigation panel. */
export const mobileNavigation = onDemandModule(() => import('./ShellMobileNavigation'));
