import { ApplicationErrorPage } from '@/features/application-error/ApplicationErrorPage';

export default function NotFound() {
  return <ApplicationErrorPage status={404} />;
}
