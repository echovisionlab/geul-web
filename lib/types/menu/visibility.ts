export function normalizeMenuVisibilityRole(role: string): string {
  const trimmed = role.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = trimmed.toLowerCase();
  return normalized === 'admin' || normalized === 'author' || normalized === 'user' ? normalized : trimmed;
}
