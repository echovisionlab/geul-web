export interface TrackCreditInput {
  /** Omit for a new credit; preserve the persisted ID for an update or delete diff. */
  id?: string;
  artist_id?: string | null;
  member_id?: string | null;
  credited_name?: string | null;
  credit_role?: string | null;
  sort_order?: number;
}

export function mapTrackCreditInput(credit: TrackCreditInput) {
  return {
    id: credit.id || undefined,
    artistId: credit.artist_id ?? undefined,
    memberId: credit.member_id ?? undefined,
    creditedName: credit.credited_name ?? undefined,
    creditRole: credit.credit_role ?? undefined,
    sortOrder: credit.sort_order ?? 0,
  };
}
