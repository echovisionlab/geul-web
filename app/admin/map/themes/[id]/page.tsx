import { notFound } from 'next/navigation';
import { ThemeEditorPage } from '@/features/admin/MapThemeEditor/ThemeEditorPage';
import { getMapThemeByIdAction } from '@/lib/actions/map-theme';
import { isValidUuid } from '@/lib/utils/validation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditThemePage({ params }: PageProps) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    notFound();
  }

  const theme = await getMapThemeByIdAction(id);
  if (!theme) {
    notFound();
  }

  return <ThemeEditorPage themeId={id} initialTheme={theme} />;
}
