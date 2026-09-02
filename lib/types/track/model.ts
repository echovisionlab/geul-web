import type { CreditTargetType } from '../common/credit';
import type { GenericMetadata } from '../common/metadata';

export type { CreditTargetType };

export type TrackMetadata = GenericMetadata;

export interface TrackSelect {
  id: string;
  release_id: string;
  track_number: number;
  title: string;
  duration_seconds: number | null;
  processing_status: string | null;
  lyrics: string | null;
  metadata: TrackMetadata;
  created_at: Date;
}

export interface TrackBasic {
  id: string;
  track_number: number;
  title: string;
  duration_seconds: number | null;
  audio_attached: boolean;
  audio_original_file_id?: string | null;
  processing_status: string | null;
}

export interface TrackCreditItem {
  id: string;
  credit_type: CreditTargetType;
  // Artist credit
  artist_id: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  // Member credit
  member_id: string | null;
  member_name: string | null;
  // Text credit
  credited_name: string | null;
  // Common
  credit_role: string | null;
  sort_order: number;
}

export interface TrackWithCredits extends TrackSelect {
  credits: TrackCreditItem[];
}

export interface UpdateTrackInput {
  track_number?: number;
  title?: string;
  duration_seconds?: number | null;
  processing_status?: string | null;
  lyrics?: string | null;
}

export interface SetTrackCreditsInput {
  // One of these must be set
  artist_id?: string | null;
  member_id?: string | null;
  credited_name?: string | null;
  // Optional
  credit_role?: string | null;
  sort_order?: number;
}
