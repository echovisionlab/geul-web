'use client';

import { Children } from 'react';
import { Carousel, type CarouselProps } from '@mantine/carousel';
import '@mantine/carousel/styles.css';

export function ListCarouselRuntime({ children, ...props }: CarouselProps) {
  return (
    <Carousel {...props}>
      {Children.map(children, (child) => (
        <Carousel.Slide>{child}</Carousel.Slide>
      ))}
    </Carousel>
  );
}
