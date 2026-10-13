import type { Responsive, Space } from '@/components/core/Layout';

/** One content edge for manager toolbar controls and both selection layouts. */
export const fileBrowserContentInset = { base: 'sm', sm: 'md' } as const satisfies Responsive<Space>;
