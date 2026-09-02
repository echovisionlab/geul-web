import PublicPageView, { generateMetadata as generatePageMetadata } from '../[...slug]/page';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata({ searchParams }: Props) {
  return generatePageMetadata({ params: Promise.resolve({ slug: ['releases'] }), searchParams });
}

export default function ReleasesRootPage({ searchParams }: Props) {
  return PublicPageView({ params: Promise.resolve({ slug: ['releases'] }), searchParams });
}
