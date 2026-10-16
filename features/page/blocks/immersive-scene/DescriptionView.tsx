'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { normalizeRichTextHref } from '@echovisionlab/geul-common/editor/link-normalization';
import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import classes from './DescriptionView.module.css';
import { useSiteSettings } from '@/lib/contexts/ManifestContext';
import { resolveSiteVariableHref, siteVariableContext } from '@/lib/site-variables';
import type { SiteVariableContext } from '@echovisionlab/geul-common/site-variables';
type MarkdownNode = { type: string; url?: string; children?: MarkdownNode[] };

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

function siteVariableLinks(context: SiteVariableContext) {
  return () => (tree: MarkdownNode) => {
    const visit = (node: MarkdownNode) => {
      if (node.type === 'link' || node.type === 'definition') {
        node.url = resolveSiteVariableHref(node.url ?? '', context) ?? '';
      }
      if (node.children) {
        node.children.forEach(visit);
      }
    };
    visit(tree);
  };
}

export function ImmersiveSceneDescriptionView({
  children,
  variant = 'description',
}: ImmersiveSceneDescriptionViewProps) {
  const { settings } = useSiteSettings();
  return (
    <div className={classes.root} data-immersive-scene-description data-variant={variant}>
      <Markdown
        skipHtml
        remarkPlugins={[remarkBreaks, remarkGfm, siteVariableLinks(siteVariableContext(settings))]}
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
