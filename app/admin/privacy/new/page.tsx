'use client';
import { PolicyVersionCreationPage } from '@/features/policy/PolicyVersionCreationPage';
import { createPrivacyVersionAction } from '@/lib/actions/privacy';
export default function Page() {
  return <PolicyVersionCreationPage policy="privacy" createVersion={createPrivacyVersionAction} />;
}
