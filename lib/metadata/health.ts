export interface MetadataHealthInput {
  effectiveTitle: string;
  effectiveDescription: string;
}

export const METADATA_HEALTH_CHECKS = {
  missingDescription: 'missingDescription',
  longTitle: 'longTitle',
  longDescription: 'longDescription',
} as const;

export type MetadataHealthCheck = keyof typeof METADATA_HEALTH_CHECKS;

export function buildMetadataHealthChecks(input: MetadataHealthInput): MetadataHealthCheck[] {
  const checks: MetadataHealthCheck[] = [];

  if (!input.effectiveDescription) {
    checks.push(METADATA_HEALTH_CHECKS.missingDescription);
  }
  if (input.effectiveTitle.length > 70) {
    checks.push(METADATA_HEALTH_CHECKS.longTitle);
  }
  if (input.effectiveDescription.length > 160) {
    checks.push(METADATA_HEALTH_CHECKS.longDescription);
  }

  return checks;
}
