export interface WorkCreditArtist {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
}

export interface WorkCreditMember {
  id: string;
  name: string;
  image: string | null;
}

export interface WorkCreditWithDetails {
  id: string;
  groupId: string | null;
  name: string | null;
  creditRole: string | null;
  sortOrder: number;
  artist: WorkCreditArtist | null;
  member: WorkCreditMember | null;
}

export interface WorkCreditGroup {
  id: string;
  workId: string;
  name: string;
  sortOrder: number;
}

export interface WorkCreditGroupWithCredits extends WorkCreditGroup {
  credits: WorkCreditWithDetails[];
}

export type CreditOrderItem =
  { type: 'group'; id: string } | { type: 'credit'; id: string; creditType: 'artist' | 'member' | 'name' };

export type FlatDisplayItem =
  { type: 'group'; group: WorkCreditGroup } | { type: 'credit'; credit: WorkCreditWithDetails; groupId: string | null };

interface WorkCreditSource {
  id: string;
  groupId?: string | null;
  name?: string | null;
  creditRole?: string | null;
  artist?: {
    id: string;
    name: string;
    slug?: string | null;
    imageAsset?: { url?: string } | null;
  } | null;
  member?: {
    id: string;
    nickname: string;
    avatarAsset?: { url?: string } | null;
  } | null;
}

export function mapWorkCredits(credits: readonly WorkCreditSource[]): WorkCreditWithDetails[] {
  return credits.map((credit, sortOrder) => ({
    id: credit.id,
    groupId: credit.groupId ?? null,
    name: credit.name ?? null,
    creditRole: credit.creditRole ?? null,
    sortOrder,
    artist: credit.artist
      ? {
          id: credit.artist.id,
          name: credit.artist.name,
          slug: credit.artist.slug ?? null,
          imageUrl: credit.artist.imageAsset?.url ?? null,
        }
      : null,
    member: credit.member
      ? {
          id: credit.member.id,
          name: credit.member.nickname,
          image: credit.member.avatarAsset?.url ?? null,
        }
      : null,
  }));
}
