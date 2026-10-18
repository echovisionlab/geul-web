import { useId, type ReactNode } from 'react';
import { Heading } from '@/components/core/Typography';
import classes from './EntityDetailLayout.module.css';

export interface EntityDetailLayoutProps {
  /** Poster, cover, portrait or featured image. Without it the detail is one full-width column. */
  media?: ReactNode;
  /** The detail's only `h1`. */
  title: ReactNode;
  titleLang?: string;
  /** Metadata rows directly under the title. */
  meta?: ReactNode;
  /** Interface controls at the title's end (content language, print). */
  actions?: ReactNode;
  /** A listing that completes the overview beside the media, after the metadata (a release's tracklist). */
  listing?: ReactNode;
  /** Related collections (releases, artists, posts) after the body, across the page width. */
  children?: ReactNode;
  /** Authored running content, read like a post body after the overview. */
  body?: ReactNode;
  /**
   * On paper the media either precedes the header as a bounded block (`block`, default) or becomes the
   * header's darkened background with the title and metadata over it (`overlay`).
   */
  printMedia?: 'block' | 'overlay';
}

/**
 * Public detail of a catalog or program entity (event, work, release, artist, label, series), in three
 * parts. The overview identifies the entity: from `md` the media takes the start third and the title,
 * interface controls, metadata and an optional listing the rest; below `md` they stack. The authored body
 * follows like a post body, keeping its reading measure at the start edge, and related collections close
 * the page.
 */
export function EntityDetailLayout({
  media,
  title,
  titleLang,
  meta,
  actions,
  listing,
  children,
  body,
  printMedia = 'block',
}: EntityDetailLayoutProps) {
  return (
    <article
      className={classes.root}
      data-entity-detail=""
      data-has-media={media ? '' : undefined}
      data-print-media={media ? printMedia : undefined}
    >
      <div className={classes.overview}>
        {media ? (
          <div className={classes.media} data-entity-detail-media="">
            {media}
          </div>
        ) : null}
        <div className={classes.main}>
          <header className={classes.header}>
            <div className={classes.titleRow}>
              <Heading level={1} scale="title" wrap="anywhere" lang={titleLang}>
                {title}
              </Heading>
              {actions ? <div className={`${classes.actions} print-hide`}>{actions}</div> : null}
            </div>
            {meta}
          </header>
          {listing}
        </div>
      </div>
      {body ? (
        <div className={classes.body} data-entity-detail-body="">
          {body}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export interface EntityDetailSectionProps {
  title: ReactNode;
  /** Controls for the section's content (search, filters), at the title's end. */
  actions?: ReactNode;
  lang?: string;
  /** Id for the title when controls inside the section refer to it (`aria-describedby`). */
  titleId?: string;
  children: ReactNode;
}

/** One titled part of an entity detail (`h2`), in the public label voice of the metadata rows. */
export function EntityDetailSection({
  title,
  actions,
  lang,
  titleId: providedTitleId,
  children,
}: EntityDetailSectionProps) {
  const generatedTitleId = useId();
  const titleId = providedTitleId ?? generatedTitleId;
  return (
    <section className={classes.section} aria-labelledby={titleId} data-entity-detail-section="">
      <div className={classes.sectionHeader}>
        <h2 id={titleId} className={classes.sectionTitle}>
          {title}
        </h2>
        {actions ? <div className={classes.sectionActions}>{actions}</div> : null}
      </div>
      <div className={classes.sectionBody} lang={lang}>
        {children}
      </div>
    </section>
  );
}

export interface EntityDetailImageProps {
  src: string;
  alt: string;
  /** `cover` fills a square frame (release artwork); `contain` keeps the image's own shape (posters). */
  fit?: 'contain' | 'cover';
}

/** The media slot's image: as wide as the media column, never taller than the viewport allows. */
export function EntityDetailImage({ src, alt, fit = 'contain' }: EntityDetailImageProps) {
  return <img className={classes.image} src={src} alt={alt} data-fit={fit} decoding="async" />;
}
