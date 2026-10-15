/** Keep existing editor query parameters while opening the selected submission. */
export function buildSubmissionHref(editBaseHref: string, submissionId: string): string {
  const url = new URL(editBaseHref, 'https://route.invalid');
  url.searchParams.set('submission', submissionId);
  return `${url.pathname}${url.search}${url.hash}`;
}
