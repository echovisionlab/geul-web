import { Paper, Stack, Text } from '@mantine/core';

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
        <Paper withBorder p="sm" role="status" aria-live="polite" aria-atomic="true">
          <Stack gap={4}>
            <Text size="sm" data-testid="og-generation-run-counts">
              {model.countLabel}
            </Text>
            {model.failures.map((failure) => (
              <Text key={failure.id} size="xs" c="red">
                {failure.label}
              </Text>
            ))}
          </Stack>
        </Paper>
      ) : null}
      {model.error ? (
        <Text size="sm" c="red" role="alert">
          {model.error}
        </Text>
      ) : null}
    </>
  );
}
