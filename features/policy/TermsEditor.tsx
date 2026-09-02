'use client';

import { LegalPolicyEditor } from '@/features/policy/LegalPolicyEditor';
import type { LegalPolicyEditorData, LegalPolicyEditorStrategy } from '@/features/policy/legal-policy-types';
import {
  activateTermsNowAction,
  cancelTermsScheduleAction,
  deleteTermsVersionAction,
  regenerateTermsHtmlAction,
  scheduleTermsAction,
} from '@/lib/actions/terms';
import {
  isTermsActive,
  isTermsArchived,
  isTermsDraft,
  isTermsEditable,
  isTermsScheduled,
  TERMS_STATUS,
} from '@/lib/policy-status';
import type { SiteSettingsView } from '@/lib/types/site-setting/config';

const TERMS_EDITOR_STRATEGY = {
  entityType: 'terms',
  translationNamespace: 'termsEditor',
  listPath: '/admin/terms',
  backTooltipKey: 'backToTermsOfService',
  status: {
    draft: TERMS_STATUS.DRAFT,
    scheduled: TERMS_STATUS.SCHEDULED,
    active: TERMS_STATUS.ACTIVE,
    archived: TERMS_STATUS.ARCHIVED,
    isDraft: isTermsDraft,
    isScheduled: isTermsScheduled,
    isActive: isTermsActive,
    isArchived: isTermsArchived,
    isEditable: isTermsEditable,
  },
  actions: {
    schedule: scheduleTermsAction,
    cancelSchedule: cancelTermsScheduleAction,
    activateNow: activateTermsNowAction,
    deleteVersion: deleteTermsVersionAction,
    regenerateHtml: regenerateTermsHtmlAction,
  },
} satisfies LegalPolicyEditorStrategy;

interface Props {
  initialTerms: LegalPolicyEditorData;
  siteSettings: SiteSettingsView | null;
  canEdit: boolean;
}

export function TermsEditor({ initialTerms, siteSettings, canEdit }: Props) {
  return (
    <LegalPolicyEditor
      initialPolicy={initialTerms}
      siteSettings={siteSettings}
      ogBackgroundUrl={siteSettings?.terms_og_background_url ?? null}
      contactEmail={siteSettings?.legal_email ?? null}
      strategy={TERMS_EDITOR_STRATEGY}
      canEdit={canEdit}
    />
  );
}
