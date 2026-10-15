'use client';
import { componentBindings } from '@/components/core/bindings';
import { useTranslations } from 'next-intl';
import { Carousel, type CarouselProps } from '@/components/core/Carousel';
export type ListCarouselProps = Omit<CarouselProps, 'labels'>;
export function ListCarouselRuntime(props: ListCarouselProps) {
  const pagination = useTranslations('dataTable.pagination');
  const common = useTranslations('common.labels');
  return (
    <Carousel
      {...componentBindings(props)}
      labels={{
        region: common('content'),
        previous: pagination('previousPage'),
        next: pagination('nextPage'),
        slide: (page) => pagination('page', { page }),
      }}
    />
  );
}
