/**
 * Logo image heights per placement, in CSS pixels. Logos are trimmed to their artwork
 * (no clear space inside the file), so these are artwork heights. `'intrinsic'` draws
 * the uploaded file at the size it authors, capped by `SiteLogoView`, so a site sizes
 * its full logo by uploading it at that size. Production shells and their Storybook
 * frames share these values.
 */
export const SITE_LOGO_HEIGHT = {
  /** Public header: full logo at its own size, within the header bar. */
  header: 'intrinsic',
  /** Printed page watermark: symbol. */
  printWatermark: 18,
  /** Expanded admin navigation: full logo at its own size. */
  adminExpanded: 'intrinsic',
  /** Collapsed admin navigation rail: symbol. */
  adminCompact: 28,
  /** Standalone form pages (public form, password gate, success, dashboard): full logo at its own size. */
  form: 'intrinsic',
} as const;
