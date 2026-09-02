import PublicPageView, { generateMetadata as generatePageMetadata } from '../[...slug]/page';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateMetadata({ searchParams }: Props) {
  return generatePageMetadata({ params: Promise.resolve({ slug: ['labels'] }), searchParams });
}

export default function LabelsRootPage({ searchParams }: Props) {
  return PublicPageView({ params: Promise.resolve({ slug: ['labels'] }), searchParams });
}
