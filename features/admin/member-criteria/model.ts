import type { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';

export interface MemberCriteriaRow {
  id: string;
  name: string;
  description: string;
  criteria_type: MemberCriteriaKind;
  criteria_type_label: string;
  estimated_count: number | null;
  campaign_count: number;
  delivery_run_count: number;
  download_policy_reference_count: number;
  archived_at: Date | null;
  created_at: Date;
}
