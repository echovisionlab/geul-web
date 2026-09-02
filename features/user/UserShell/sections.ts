import { MySection } from '@echovisionlab/geul-proto/secure/member_pb.ts';

const KNOWN_MY_SECTIONS = new Set<MySection>([
  MySection.PROFILE,
  MySection.SECURITY,
  MySection.SETTINGS,
  MySection.POSTS,
  MySection.SERIES,
  MySection.WORKS,
  MySection.ARTISTS,
  MySection.FORMS,
]);

export function mySectionToPath(section: MySection): string | null {
  switch (section) {
    case MySection.PROFILE:
      return 'profile';
    case MySection.SECURITY:
      return 'security';
    case MySection.SETTINGS:
      return 'settings';
    case MySection.POSTS:
      return 'posts';
    case MySection.SERIES:
      return 'series';
    case MySection.WORKS:
      return 'works';
    case MySection.ARTISTS:
      return 'artists';
    case MySection.FORMS:
      return 'forms';
    default:
      return null;
  }
}

export function normalizeMySections(sections?: MySection[]): MySection[] {
  if (!sections || sections.length === 0) {
    return [];
  }

  const deduped: MySection[] = [];
  const seen = new Set<MySection>();
  for (const section of sections) {
    if (!KNOWN_MY_SECTIONS.has(section) || seen.has(section)) {
      continue;
    }
    seen.add(section);
    deduped.push(section);
  }
  return deduped;
}
