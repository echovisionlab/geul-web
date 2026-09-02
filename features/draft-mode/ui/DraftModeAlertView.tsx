import { IconEyeOff } from '@tabler/icons-react';
import { Box } from '@mantine/core';
import { Alert } from '@/components/core/Alert';

interface DraftModeAlertViewProps {
  id: string;
  message: string;
}

export function DraftModeAlertView({ id, message }: DraftModeAlertViewProps) {
  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        maxWidth: 'calc(100% - 32px)',
      }}
    >
      <Alert
        id={`draft-mode-alert-${id}`}
        tone="warning"
        prominence="strong"
        icon={<IconEyeOff size={16} />}
        styles={{
          root: {
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            '@media print': { display: 'none' },
          },
        }}
      >
        {message}
      </Alert>
    </Box>
  );
}
