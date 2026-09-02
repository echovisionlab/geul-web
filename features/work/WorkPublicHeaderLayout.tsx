import type { ReactNode } from 'react';
import Image from 'next/image';
import classes from './WorkPublicHeaderLayout.module.css';

export interface WorkPublicHeaderLayoutProps {
  featuredImageUrl: string | null;
  imageAlt: string;
  children: ReactNode;
}

export function WorkPublicHeaderLayout({ featuredImageUrl, imageAlt, children }: WorkPublicHeaderLayoutProps) {
  if (!featuredImageUrl) {
    return children;
  }

  return (
    <div className={classes.root} data-work-featured-header="">
      <div className={classes.image}>
        <Image
          src={featuredImageUrl}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 60vw"
          style={{ objectFit: 'cover' }}
          quality={100}
          preload
        />
      </div>
      <div className={classes.content}>{children}</div>
    </div>
  );
}
