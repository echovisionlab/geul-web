import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import classes from './DescriptionView.module.css';

interface ImmersiveSceneDescriptionViewProps {
  children: string;
  variant?: 'description' | 'attribution';
}

function DescriptionLink({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const normalizedHref = normalizeRichTextHref(href ?? '');
  if (!normalizedHref) {
    return <>{children}</>;
  }
  const opensNewWindow = /^https?:\/\//i.test(normalizedHref);
  return (
    <a
      {...props}
      href={normalizedHref}
      target={opensNewWindow ? '_blank' : undefined}
      rel={opensNewWindow ? 'noreferrer' : undefined}
    >
      {children}
    </a>
  );
}

function DescriptionHeading({ level, children }: { level: 3 | 4 | 5; children: ReactNode }) {
  if (level === 3) {
    return <h3>{children}</h3>;
  }
  if (level === 4) {
    return <h4>{children}</h4>;
  }
  return <h5>{children}</h5>;
}

export function ImmersiveSceneDescriptionView({
  children,
  variant = 'description',
}: ImmersiveSceneDescriptionViewProps) {
  return (
    <div className={classes.root} data-immersive-scene-description data-variant={variant}>
      <Markdown
        skipHtml
        remarkPlugins={[remarkBreaks, remarkGfm]}
        urlTransform={(url) => normalizeRichTextHref(url)}
        components={{
          a: DescriptionLink,
          h1: ({ children: headingChildren }) => <DescriptionHeading level={3}>{headingChildren}</DescriptionHeading>,
          h2: ({ children: headingChildren }) => <DescriptionHeading level={4}>{headingChildren}</DescriptionHeading>,
          h3: ({ children: headingChildren }) => <DescriptionHeading level={5}>{headingChildren}</DescriptionHeading>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
