import type { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';

export interface AudienceSegmentRow {
  id: string;
  name: string;
  description: string;
  segment_type: SegmentType;
  segment_type_label: string;
  estimated_count: number | null;
  campaign_count: number;
  delivery_run_count: number;
  download_policy_reference_count: number;
  archived_at: Date | null;
  created_at: Date;
}
