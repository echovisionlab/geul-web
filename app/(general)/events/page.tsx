import PublicPageView, { generateMetadata as generatePageMetadata } from '../[...slug]/page';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata({ searchParams }: Props) {
  return generatePageMetadata({ params: Promise.resolve({ slug: ['events'] }), searchParams });
}

export default function EventsRootPage({ searchParams }: Props) {
  return PublicPageView({ params: Promise.resolve({ slug: ['events'] }), searchParams });
}
