import type { ReleaseTrackItem } from '@/lib/collab/schemas/release-fields.schema';

export function toTrackCreditMutationInput(credits: ReleaseTrackItem['credits']) {
  return credits.map((credit, sortOrder) => ({
    id: credit.id || undefined,
    artist_id: credit.artist_id,
    member_id: credit.member_id,
    credited_name: credit.credited_name,
    credit_role: credit.credit_role,
    sort_order: sortOrder,
  }));
}
