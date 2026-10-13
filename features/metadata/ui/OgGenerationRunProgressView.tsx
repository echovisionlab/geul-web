import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

export interface OgGenerationRunProgressViewModel {
  countLabel?: string;
  failures: Array<{ id: string; label: string }>;
  error?: string;
}

interface OgGenerationRunProgressViewProps {
  model: OgGenerationRunProgressViewModel;
}

export function OgGenerationRunProgressView({ model }: OgGenerationRunProgressViewProps) {
  if (!model.countLabel && !model.error) {
    return null;
  }

  return (
    <>
      {model.countLabel ? (
        <DsSectionCard withBorder role="status" aria-live="polite" aria-atomic="true" padding="sm">
          <DsLayoutStack gap="xxs">
            <SupportingText tone="primary" data-testid="og-generation-run-counts">
              {model.countLabel}
            </SupportingText>
            {model.failures.map((failure) => (
              <DsText key={failure.id} size="xs" tone="danger">
                {failure.label}
              </DsText>
            ))}
          </DsLayoutStack>
        </DsSectionCard>
      ) : null}
      {model.error ? (
        <DsText size="sm" tone="danger" role="alert">
          {model.error}
        </DsText>
      ) : null}
    </>
  );
}
