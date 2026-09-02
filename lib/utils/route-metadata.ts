import type { Metadata } from 'next';

interface RouteMetadataText {
  path: string;
  title: string;
  description: string;
}

interface SectionTitle {
  list: string;
  detail: string;
}

/**
 * Route metadata convention for non-public pages:
 * 1) list pages: plural noun (e.g. "Posts")
 * 2) detail pages: "Edit {Singular}" (e.g. "Edit Post")
 * 3) task pages: explicit action title (e.g. "Form Builder", "Campaign Analytics")
 */
const ADMIN_SECTION_TITLES: Record<string, SectionTitle> = {
  artists: { list: 'Artists', detail: 'Artist' },
  'audience-segments': { list: 'Audience Segments', detail: 'Audience Segment' },
  campaigns: { list: 'Campaigns', detail: 'Campaign' },
  categories: { list: 'Categories', detail: 'Category' },
  clients: { list: 'Clients', detail: 'Client' },
  'email-layouts': { list: 'Email Layouts', detail: 'Email Layout' },
  'email-templates': { list: 'Email Templates', detail: 'Email Template' },
  emails: { list: 'Emails', detail: 'Email' },
  files: { list: 'Files', detail: 'File' },
  formats: { list: 'Formats', detail: 'Format' },
  forms: { list: 'Forms', detail: 'Form' },
  genres: { list: 'Genres', detail: 'Genre' },
  labels: { list: 'Labels', detail: 'Label' },
  menus: { list: 'Menus', detail: 'Menu' },
  pages: { list: 'Pages', detail: 'Page' },
  posts: { list: 'Posts', detail: 'Post' },
  releases: { list: 'Releases', detail: 'Release' },
  series: { list: 'Series', detail: 'Series' },
  styles: { list: 'Styles', detail: 'Style' },
  tags: { list: 'Tags', detail: 'Tag' },
  terms: { list: 'Terms', detail: 'Terms' },
  'user-tags': { list: 'User Tags', detail: 'User Tag' },
  users: { list: 'Users', detail: 'User' },
  works: { list: 'Works', detail: 'Work' },
};

function normalizePathname(pathname: string | null | undefined, fallbackPath: string): string {
  if (!pathname) {
    return fallbackPath;
  }

  const noQuery = pathname.split('?')[0]?.split('#')[0] ?? '';
  const trimmed = noQuery.replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') {
    return fallbackPath;
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function toTitleCaseSegment(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveAdminTitle(path: string): string {
  const segments = path.split('/').filter(Boolean);
  const section = segments[1];
  const third = segments[2];
  const fourth = segments[3];
  const fifth = segments[4];

  if (!section) {
    return 'Dashboard';
  }

  if (section === 'settings') {
    if (third === 'mail') {
      return 'Mail Settings';
    }
    if (third === 'og-image') {
      return 'OG Image Settings';
    }
    return 'Settings';
  }

  if (section === 'map') {
    if (third === 'themes') {
      return fourth ? 'Edit Map Theme' : 'Map Themes';
    }
    if (third === 'places') {
      return fourth ? 'Edit Map Place' : 'Map Places';
    }
    return 'Map Places';
  }

  if (section === 'forms') {
    if (!third) {
      return 'Forms';
    }
    if (!fourth) {
      return 'Edit Form';
    }
    if (fourth === 'builder') {
      return 'Form Builder';
    }
    if (fourth === 'settings') {
      return 'Form Settings';
    }
    if (fourth === 'submissions') {
      return fifth ? 'Form Submission' : 'Form Submissions';
    }
    return 'Edit Form';
  }

  if (section === 'campaigns') {
    if (!third) {
      return 'Campaigns';
    }
    if (fourth === 'analytics') {
      return 'Campaign Analytics';
    }
    return 'Edit Campaign';
  }

  if (section === 'terms') {
    if (!third) {
      return 'Terms';
    }
    return third === 'new' ? 'Create Terms' : 'Edit Terms';
  }

  if (section === 'privacy') {
    if (!third) {
      return 'Privacy';
    }
    return third === 'new' ? 'Create Privacy Policy' : 'Edit Privacy Policy';
  }

  const sectionTitle = ADMIN_SECTION_TITLES[section];
  if (sectionTitle) {
    return third ? `Edit ${sectionTitle.detail}` : sectionTitle.list;
  }

  return third ? `Edit ${toTitleCaseSegment(section)}` : toTitleCaseSegment(section);
}

export function resolveAdminRouteMetadata(pathname: string | null | undefined, siteName: string): RouteMetadataText {
  const path = normalizePathname(pathname, '/admin');
  const title = resolveAdminTitle(path);
  const safeSiteName = siteName || 'Site';

  return {
    path,
    title,
    description: `${title} page in the admin panel for ${safeSiteName}.`,
  };
}

export function withNoIndex(metadata: Metadata): Metadata {
  return {
    ...metadata,
    referrer: metadata.referrer ?? 'no-referrer',
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      googleBot: {
        index: false,
        follow: false,
        noarchive: true,
        noimageindex: true,
      },
    },
  };
}
