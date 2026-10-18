import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library registers its automatic cleanup when its module first loads. Shared-runtime projects reuse that
// module across files, so later files would keep earlier renders; register cleanup for every file here.
afterEach(() => {
  cleanup();
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

// jsdom has no 2D drawing backend. Font probes observe an unavailable context;
// rendering and font support remain covered by the real-browser Storybook suite.
if (typeof HTMLCanvasElement !== 'undefined' && typeof CanvasRenderingContext2D === 'undefined') {
  const getContext = HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value(this: HTMLCanvasElement, contextId: string, options?: unknown) {
      return contextId === '2d' ? null : getContext.call(this, contextId, options);
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
