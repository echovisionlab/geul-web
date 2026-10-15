import { IconEyeOff } from '@tabler/icons-react';

import { Alert } from '@/components/core/Alert';

interface DraftModeAlertViewProps {
  id: string;
  message: string;
}

export function DraftModeAlertView({ id, message }: DraftModeAlertViewProps) {
  return (
    <div
      className="print-hide"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--geul-layer-banner)',
        maxWidth: 'calc(100% - 32px)',
      }}
    >
      <Alert id={`draft-mode-alert-${id}`} tone="warning" prominence="strong" icon={<IconEyeOff size={16} />}>
        {message}
      </Alert>
    </div>
  );
}
