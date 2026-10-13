interface CatalogTranslator {
  (key: never): string;
  has: (key: never) => boolean;
}

/**
 * Describes an email template variable from the shared catalogue. `confirm_link` is the legacy alias of
 * `confirm_url`; names outside the catalogue (custom data) have no description.
 */
export function describeEmailTemplateVariable(
  variableName: string,
  translators: {
    catalog: CatalogTranslator;
    siteOrigin: () => string;
    logoEmailUrl: () => string;
  },
): string | null {
  const normalizedName = variableName.trim().toLowerCase();
  if (normalizedName === 'site_origin') {
    return translators.siteOrigin();
  }
  if (normalizedName === 'logo_email_url') {
    return translators.logoEmailUrl();
  }
  const lookupKey = (normalizedName === 'confirm_link' ? 'confirm_url' : normalizedName) as never;
  return translators.catalog.has(lookupKey) ? translators.catalog(lookupKey) : null;
}
