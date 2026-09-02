import type { getWorkView } from '@/lib/queries/work';

type WorkQueryView = NonNullable<Awaited<ReturnType<typeof getWorkView>>>;

export function toWorkViewModel(work: WorkQueryView, getFallbackGroupName: (index: number) => string) {
  const groupNamesById = new Map(work.creditGroups.map((group) => [group.id, group.name]));
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      credits: ReturnType<typeof toCreditView>[];
    }
  >();
  const ungrouped: ReturnType<typeof toCreditView>[] = [];

  for (const credit of work.credits) {
    const creditView = toCreditView(credit);
    if (!credit.groupId) {
      ungrouped.push(creditView);
      continue;
    }

    const group = groups.get(credit.groupId);
    if (group) {
      group.credits.push(creditView);
      continue;
    }

    groups.set(credit.groupId, {
      id: credit.groupId,
      name: groupNamesById.get(credit.groupId)?.trim() || getFallbackGroupName(groups.size + 1),
      credits: [creditView],
    });
  }

  return {
    id: work.id,
    slug: work.slug,
    title: work.title,
    type: work.type,
    year: work.year,
    month: work.month,
    untilYear: work.untilYear,
    untilMonth: work.untilMonth,
    isPresent: work.isPresent,
    summary: work.summary,
    featuredImageUrl: work.featuredImageUrl,
    metadata: (work.metadata as Record<string, unknown>) ?? {},
    content: work.content ?? null,
    blockMedia: work.blockMedia,
    locationPlace: work.locationPlace ?? null,
    createdAt: work.createdAt ?? new Date(),
    updatedAt: work.updatedAt ?? new Date(),
    publishedAt: work.publishedAt,
    credits: { groups: Array.from(groups.values()), ungrouped },
    clients: work.clients ?? [],
    canEdit: false,
    localizationInfo: work.localizationInfo ?? null,
  };
}

function toCreditView(credit: WorkQueryView['credits'][number]) {
  return {
    id: credit.id,
    name: credit.name ?? credit.artist?.name ?? credit.member?.name ?? null,
    creditRole: credit.creditRole,
    imageUrl: credit.artist?.imageUrl ?? credit.member?.image ?? null,
    artistId: credit.artist?.id ?? null,
    artistSlug: credit.artist?.slug ?? null,
    memberId: credit.member?.id ?? null,
  };
}
