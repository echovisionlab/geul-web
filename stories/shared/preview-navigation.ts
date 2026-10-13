import routeIndex from '../../docs/design-system/ui-kit-route-index.json';

export interface PreviewRoute {
  route: string;
  previews: Array<{ storyTitle: string; storyId: string; branch?: string }>;
}

function routeScore(pattern: string, pathname: string): number {
  const expected = pattern.split('/').filter(Boolean);
  const actual = pathname.split('/').filter(Boolean);
  let score = 0;
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index];
    if (segment.startsWith('[...') || segment.startsWith('[[...')) {
      return -1;
    }
    if (!actual[index]) {
      return -1;
    }
    if (segment.startsWith('[')) {
      score += 1;
    } else if (segment === actual[index]) {
      score += 10;
    } else {
      return -1;
    }
  }
  return expected.length === actual.length ? score + 1 : -1;
}

/** Route links open existing local stories, preserving the toolbar globals. */
export function resolvePreviewStory(href: string, routes: PreviewRoute[] = routeIndex.routes): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) {
    return null;
  }
  const url = new URL(href, 'http://storybook.local');
  const storybookPath = url.searchParams.get('path');
  if (storybookPath !== null) {
    return storybookPath.match(/^\/story\/([a-z0-9-]+--[a-z0-9-]+)$/)?.[1] ?? null;
  }
  if (url.pathname === '/iframe.html') {
    return url.searchParams.get('id');
  }
  const candidates = routes
    .map((record) => ({ record, score: routeScore(record.route, url.pathname) }))
    .filter(({ record, score }) => score >= 0 && record.previews.length)
    .sort((a, b) => b.score - a.score);
  const record = candidates[0]?.record;
  if (!record) {
    return null;
  }
  const editing = url.searchParams.get('edit') === 'true' || url.searchParams.get('edit') === '1';
  return (
    record.previews.find((preview) => (editing ? preview.branch === 'edit' : preview.branch !== 'edit'))?.storyId ??
    null
  );
}

const trailKey = 'geul.storybook.navigation';
function previewWindow(): Window {
  return window.parent;
}
function currentStory(url: URL): string | null {
  return url.searchParams.get('id') ?? url.searchParams.get('path')?.replace(/^\/story\//, '') ?? null;
}
function readTrail(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(trailKey) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
function openStory(id: string, replace = false, href?: string) {
  const target = previewWindow();
  const url = new URL(target.location.href);
  if (url.pathname === '/iframe.html') {
    url.searchParams.set('id', id);
  } else {
    url.pathname = '/';
    url.searchParams.set('path', `/story/${id}`);
    url.searchParams.delete('id');
  }
  // Args belong to the requested story. Toolbar globals belong to the preview session.
  const requested = href ? new URL(href, url) : null;
  if (requested?.searchParams.has('args')) {
    url.searchParams.set('args', requested.searchParams.get('args') ?? '');
  } else {
    url.searchParams.delete('args');
  }
  url.hash = '';
  if (replace) {
    target.location.replace(url.toString());
  } else {
    target.location.assign(url.toString());
  }
}

export function navigatePreview(href: string, replace = false): boolean {
  const id = resolvePreviewStory(href);
  if (!id || typeof window === 'undefined') {
    return false;
  }
  const previous = currentStory(new URL(previewWindow().location.href));
  if (previous === id && !new URL(href, previewWindow().location.href).searchParams.has('args')) {
    return true;
  }
  if (previous && !replace) {
    try {
      sessionStorage.setItem(trailKey, JSON.stringify([...readTrail(), previous].slice(-20)));
    } catch {
      /* Private browsing can disallow storage. */
    }
  }
  openStory(id, replace, href);
  return true;
}

export function goBackPreview(): void {
  const trail = readTrail();
  const id = trail.pop();
  try {
    sessionStorage.setItem(trailKey, JSON.stringify(trail));
  } catch {
    /* Navigation also works without storage. */
  }
  if (id) {
    openStory(id, true);
  } else {
    navigatePreview('/', true);
  }
}
