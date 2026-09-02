export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s가-힣-]/g, ' ') // 특수문자를 공백으로 대체
    .replace(/[\s_]+/g, '-') // 공백을 하이픈으로
    .replace(/-+/g, '-') // 연속된 하이픈을 하나로
    .replace(/^-+|-+$/g, ''); // 앞뒤 하이픈 제거
}

/**
 * Sanitizes slug while typing in manual mode.
 * Unlike generateSlug, this keeps trailing hyphen(s) to avoid jarring cursor jumps.
 */
export function sanitizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .trimStart()
    .replace(/[^\w\s가-힣-]/g, ' ')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '');
}

export function sanitizePageSlugInput(value: string): string {
  return value
    .toLowerCase()
    .trimStart()
    .split('/')
    .map((segment) =>
      segment
        .replace(/[^\w\s가-힣-]/g, ' ')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+/, ''),
    )
    .join('/');
}

export function toSlugInputValue(slug: string | null | undefined): string {
  return slug ?? '';
}

export function toNullableSlug(slug: string | null | undefined): string | null {
  const value = slug?.trim() ?? '';
  return value === '' ? null : value;
}
