'use client';
import { PolicyVersionCreationPage } from '@/features/policy/PolicyVersionCreationPage';
import { createTermsVersionAction } from '@/lib/actions/terms';
export default function Page() {
  return <PolicyVersionCreationPage policy="terms" createVersion={createTermsVersionAction} />;
}
