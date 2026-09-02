import { Box, Group, Stack, Text } from '@mantine/core';

export interface PrintHeaderViewProps {
  logoSrc: string | null;
  logoAlt: string;
  companyName: string;
  taxId: string | null;
}

export function PrintHeaderView({ logoSrc, logoAlt, companyName, taxId }: PrintHeaderViewProps) {
  return (
    <div className="print-header">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        {logoSrc ? (
          <Box
            component="img"
            src={logoSrc}
            alt={logoAlt}
            style={{
              height: 24,
              width: 'auto',
              objectFit: 'contain',
              border: 0,
            }}
          />
        ) : null}

        <Stack gap={0} align="flex-end">
          <Text size="sm" fw={600} lh={1}>
            {companyName}
          </Text>
          {taxId ? (
            <Text size="xs" c="dimmed" lh={1.2} mt={4}>
              {taxId}
            </Text>
          ) : null}
        </Stack>
      </Group>
    </div>
  );
}
