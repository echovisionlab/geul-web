import { DraftModeAlertView } from './ui/DraftModeAlertView';

interface DraftModeAlertProps {
  id: string;
  status?: string;
}

export function DraftModeAlert({ id, status }: DraftModeAlertProps) {
  const statusText = status === 'draft' ? ' (Draft)' : status === 'published' ? ' (Published)' : '';
  const message = `Draft mode${statusText} - This link expires in 24 hours`;

  return <DraftModeAlertView id={id} message={message} />;
}
