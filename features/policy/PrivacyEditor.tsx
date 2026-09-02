'use client';

import { LegalPolicyEditor } from '@/features/policy/LegalPolicyEditor';
import type { LegalPolicyEditorData, LegalPolicyEditorStrategy } from '@/features/policy/legal-policy-types';
import {
  activatePrivacyNowAction,
  cancelPrivacyScheduleAction,
  deletePrivacyVersionAction,
  regeneratePrivacyHtmlAction,
  schedulePrivacyAction,
} from '@/lib/actions/privacy';
import {
  isPrivacyActive,
  isPrivacyArchived,
  isPrivacyDraft,
  isPrivacyEditable,
  isPrivacyScheduled,
  PRIVACY_STATUS,
} from '@/lib/policy-status';
import type { SiteSettingsView } from '@/lib/types/site-setting/config';

const PRIVACY_EDITOR_STRATEGY = {
  entityType: 'privacy',
  translationNamespace: 'privacyEditor',
  listPath: '/admin/privacy',
  backTooltipKey: 'backToPrivacyPolicy',
  status: {
    draft: PRIVACY_STATUS.DRAFT,
    scheduled: PRIVACY_STATUS.SCHEDULED,
    active: PRIVACY_STATUS.ACTIVE,
    archived: PRIVACY_STATUS.ARCHIVED,
    isDraft: isPrivacyDraft,
    isScheduled: isPrivacyScheduled,
    isActive: isPrivacyActive,
    isArchived: isPrivacyArchived,
    isEditable: isPrivacyEditable,
  },
  actions: {
    schedule: schedulePrivacyAction,
    cancelSchedule: cancelPrivacyScheduleAction,
    activateNow: activatePrivacyNowAction,
    deleteVersion: deletePrivacyVersionAction,
    regenerateHtml: regeneratePrivacyHtmlAction,
  },
} satisfies LegalPolicyEditorStrategy;

interface Props {
  initialPrivacy: LegalPolicyEditorData;
  siteSettings: SiteSettingsView | null;
  canEdit: boolean;
}

export function PrivacyEditor({ initialPrivacy, siteSettings, canEdit }: Props) {
  return (
    <LegalPolicyEditor
      initialPolicy={initialPrivacy}
      siteSettings={siteSettings}
      ogBackgroundUrl={siteSettings?.privacy_og_background_url ?? null}
      contactEmail={siteSettings?.privacy_email ?? null}
      strategy={PRIVACY_EDITOR_STRATEGY}
      canEdit={canEdit}
    />
  );
}
