import PublicPageView, { generateMetadata as generatePageMetadata } from '../(general)/[...slug]/page';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata({ searchParams }: Props) {
  return generatePageMetadata({ params: Promise.resolve({ slug: ['forms'] }), searchParams });
}

export default function FormsRootPage({ searchParams }: Props) {
  return PublicPageView({ params: Promise.resolve({ slug: ['forms'] }), searchParams });
}
