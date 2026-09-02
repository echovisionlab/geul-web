import type { RichTextDocument } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export interface LegalPolicyEditorData {
  id: string;
  version: number;
  title: string;
  document: RichTextDocument | null;
  status: string;
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface LegalPolicyActionResult {
  success?: boolean;
  error?: string;
}

export interface LegalPolicyEditorStrategy {
  entityType: 'privacy' | 'terms';
  translationNamespace: 'privacyEditor' | 'termsEditor';
  listPath: '/admin/privacy' | '/admin/terms';
  backTooltipKey: 'backToPrivacyPolicy' | 'backToTermsOfService';
  status: {
    draft: string;
    scheduled: string;
    active: string;
    archived: string;
    isDraft: (status: string) => boolean;
    isScheduled: (status: string) => boolean;
    isActive: (status: string) => boolean;
    isArchived: (status: string) => boolean;
    isEditable: (status: string) => boolean;
  };
  actions: {
    schedule: (id: string, effectiveFrom: Date) => Promise<LegalPolicyActionResult>;
    cancelSchedule: (id: string) => Promise<LegalPolicyActionResult>;
    activateNow: (id: string) => Promise<LegalPolicyActionResult>;
    deleteVersion: (id: string) => Promise<LegalPolicyActionResult>;
    regenerateHtml: (id: string) => Promise<LegalPolicyActionResult>;
  };
}
