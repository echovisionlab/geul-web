export function formatSelectedCountLabel(locale: string, count: number) {
  if (locale === 'ko') {
    return `${count}개 선택`;
  }
  return `${count} selected`;
}
