'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { FormEditRouteProps } from './FormEditRoute';

// The public form route renders the collaborative editor only in edit mode; loading it on demand
// keeps Yjs and Hocuspocus out of the anonymous form page's first load (as LazyAdminLabelDetailClient).
const FormEditRoute = dynamic(() => import('./FormEditRoute').then((module) => module.FormEditRoute), {
  loading: () => <PageLoader placement="flow" />,
});

export function LazyFormEditRoute(props: FormEditRouteProps) {
  return <FormEditRoute {...props} />;
}
