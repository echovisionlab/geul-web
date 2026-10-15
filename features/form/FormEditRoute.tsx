'use client';

import type { ComponentProps } from 'react';
import { FormEditor } from '@/features/form/FormEditor/FormEditor';
import { EntityTranslationsPanel } from '@/features/translation/EntityTranslationsPanel';
import { AdminFormLayoutClient } from '@/features/form/AdminFormLayoutClient';
import AdminFormSubmissionsPage from '@/features/form/AdminFormSubmissionsPage';
import { FormSettingsContent } from '@/features/form/FormSettingsContent';
import {
  FormSubmissionDetailPageView,
  type FormSubmissionDetailPageViewProps,
} from '@/features/form/FormSubmissionDetailPageView';
import { FormEditorProvider } from '@/lib/contexts/FormEditorContext';
import { FormTranslationProvider } from '@/features/form/FormTranslationContext';

/** Serializable tab content chosen by the public form route's `?edit=true` server branch. */
export type FormEditRouteContent =
  | { tab: 'builder' }
  | { tab: 'settings'; settings: Omit<ComponentProps<typeof FormSettingsContent>, 'formId' | 'bindings'> }
  | { tab: 'translations' }
  | { tab: 'submissions'; editBaseHref: string }
  | {
      tab: 'submission';
      submission: FormSubmissionDetailPageViewProps['submission'];
      formSchema: FormSubmissionDetailPageViewProps['formSchema'];
      returnHref: string;
    };

export interface FormEditRouteProps {
  formId: string;
  initialFields: ComponentProps<typeof FormEditorProvider>['initialFields'];
  initialStatus: ComponentProps<typeof AdminFormLayoutClient>['initialStatus'];
  content: FormEditRouteContent;
}

function FormEditRouteContentView({ formId, content }: { formId: string; content: FormEditRouteContent }) {
  switch (content.tab) {
    case 'settings':
      return <FormSettingsContent formId={formId} {...content.settings} />;
    case 'translations':
      return <EntityTranslationsPanel entityType="form" entityId={formId} collapsible={false} />;
    case 'submissions':
      return <AdminFormSubmissionsPage formId={formId} editBaseHref={content.editBaseHref} />;
    case 'submission':
      return (
        <FormSubmissionDetailPageView
          formId={formId}
          submission={content.submission}
          formSchema={content.formSchema}
          returnHref={content.returnHref}
        />
      );
    case 'builder':
      return <FormEditor />;
  }
}

/**
 * The admin form editor rendered by `/forms/[slug]?edit=true`. It holds every collaboration import
 * (Yjs, Hocuspocus) for that route, so the anonymous form page loads it through LazyFormEditRoute.
 */
export function FormEditRoute({ formId, initialFields, initialStatus, content }: FormEditRouteProps) {
  return (
    <FormEditorProvider formId={formId} initialFields={initialFields}>
      <FormTranslationProvider>
        <AdminFormLayoutClient formId={formId} initialStatus={initialStatus}>
          <FormEditRouteContentView formId={formId} content={content} />
        </AdminFormLayoutClient>
      </FormTranslationProvider>
    </FormEditorProvider>
  );
}
