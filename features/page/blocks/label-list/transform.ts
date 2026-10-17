/** The fields of a label that its list item needs (server render and client pages share them). */
export interface LabelListSource {
  id: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  countryCode?: string | null;
}

export function toLabelListItem(label: LabelListSource) {
  return {
    id: label.id,
    href: `/labels/${label.slug?.trim() || label.id}`,
    title: label.name,
    imageUrl: label.imageUrl ?? null,
    imageAlt: label.name,
    countryCode: label.countryCode ?? null,
  };
}
