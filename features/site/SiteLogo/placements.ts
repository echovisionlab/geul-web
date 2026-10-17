/**
 * Authored logo image heights per placement, in CSS pixels. Logos are trimmed to
 * their artwork (no clear space inside the file), so these are artwork heights.
 * Production shells and their Storybook frames share these values.
 */
export const SITE_LOGO_HEIGHT = {
  /** Public header and navigation drawer heading: full logo. */
  header: 28,
  /** Printed page watermark: full logo. */
  printWatermark: 18,
  /** Expanded admin navigation: full logo. */
  adminExpanded: 36,
  /** Collapsed admin navigation rail: symbol. */
  adminCompact: 28,
  /** Standalone form pages (public form, password gate, success, dashboard): full logo. */
  form: 24,
} as const;
