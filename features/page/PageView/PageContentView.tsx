// Server Component - no 'use client'
import { ContentChrome, ContentLayoutView, type DocumentLayout } from '@/features/document-layout';
import type { ContentBlockMediaItem } from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedPageSection } from '@/features/editor/contract/localized-page';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ContentLanguageMenu } from '@/features/translation/ContentLanguageMenu';
import { ContentLocaleNotice } from '@/features/translation/ContentLocaleNotice';
import { pageHasLocalizedText } from './page-localized-text';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { buildGeneratedPageTocItems } from '@/lib/toc-items';
import { GeneratedPageRenderer } from './GeneratedPageRenderer';
import classes from './PageContentView.module.css';

interface PageContentViewProps {
  page: {
    title: string;
    showTitle: boolean;
    content: LocalizedPageSection[] | null;
    blockMedia: readonly ContentBlockMediaItem[];
    documentLayout: DocumentLayout;
    localizationInfo?: {
      requestedLocale: string;
      displayedLocale: string;
      sourceLocale: string;
      isFallback: boolean;
      isOriginal: boolean;
      machineGenerated: boolean;
      fallbackReason: number;
      availableLocales?: string[];
    } | null;
  };
  pathname: string;
  query?: Record<string, string | string[] | undefined>;
  requestedLocale: string;
}

export function PageContentView({ page, pathname, query, requestedLocale }: PageContentViewProps) {
  const controls = page.localizationInfo ? (
    <ContentLanguageMenu
      pathname={pathname}
      query={query}
      requestedLocale={requestedLocale}
      localizationInfo={page.localizationInfo}
    />
  ) : null;
  // Pages stay quiet about translations; they only say when the requested language is unavailable
  // and the body has text that would have been translated.
  const notice =
    page.localizationInfo && pageHasLocalizedText(page.content) ? (
      <ContentLocaleNotice pathname={pathname} query={query} localizationInfo={page.localizationInfo} />
    ) : null;
  const showTitle = page.showTitle && !!page.title;
  const chrome = showTitle ? (
    <ContentChrome title={page.title} className={controls ? classes.chromeWithControls : undefined} />
  ) : null;

  return (
    <ContentBlockMediaRuntimeProvider items={page.blockMedia}>
      <ContentLayoutView
        layout={page.documentLayout}
        contentLanguage={page.localizationInfo?.displayedLocale || requestedLocale}
        chrome={chrome}
        controls={controls}
        notice={notice}
        className={['page-content', !showTitle && controls ? classes.withoutTitle : undefined]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Sections keep their authored widths; Core reserves the outline at their inline end. */}
        <TableOfContents
          items={buildGeneratedPageTocItems(page.content)}
          enabled={!page.documentLayout.hideTableOfContents}
        >
          <GeneratedPageRenderer sections={page.content ?? []} query={query} requestedLocale={requestedLocale} />
        </TableOfContents>
      </ContentLayoutView>
    </ContentBlockMediaRuntimeProvider>
  );
}
