import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, connection: vi.fn(async () => undefined) };
});

// React test runs expect this flag in environments that drive state updates via act().
// Some tests set it inline today; keep the default enabled for the entire suite
// so warnings do not depend on per-file boilerplate.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof document !== 'undefined' && !document.fonts) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

function createMemoryStorage(): Storage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key) {
      return items.get(key) ?? null;
    },
    key(index) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key) {
      items.delete(key);
    },
    setItem(key, value) {
      items.set(key, value);
    },
  };
}

function installMemoryLocalStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
  if (descriptor && 'value' in descriptor && descriptor.value) {
    return;
  }

  const storage = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

installMemoryLocalStorage();

if (typeof window !== 'undefined' && !('maxTouchPoints' in window.navigator)) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  });
}

if (typeof Range !== 'undefined') {
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => document.body.getBoundingClientRect(),
    });
  }
  if (typeof Range.prototype.getClientRects !== 'function') {
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [document.body.getBoundingClientRect()],
    });
  }
}

// Server-side modules validate their runtime configuration even in isolated
// unit tests. Keep the suite self-contained without weakening production env
// validation or requiring a running Geul service stack.
if (process.env.VITEST) {
  process.env.OATHKEEPER_URL ??= 'http://oathkeeper.test';
  process.env.ENCRYPTION_SECRET ??= 'vitest-encryption-secret';
  process.env.KRATOS_URL ??= 'http://kratos.test';
  process.env.KRATOS_ADMIN_URL ??= 'http://kratos-admin.test';
  process.env.SESSION_COOKIE_NAME ??= 'site_session';
  process.env.HYDRA_ADMIN_URL ??= 'http://hydra-admin.test';
  process.env.SITE_ORIGIN ??= 'http://web.test';
  process.env.MCP_OAUTH_ISSUER_URL ??= 'http://sso.test';
  process.env.DRAFT_SECRET ??= 'vitest-draft-secret';
  process.env.HOST ??= 'http://web.test';
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
