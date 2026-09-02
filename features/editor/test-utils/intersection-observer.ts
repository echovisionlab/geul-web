export interface IntersectionObserverFixture {
  Observer: typeof IntersectionObserver;
  observers: readonly IntersectionObserver[];
  emit: (observer: IntersectionObserver, isIntersecting: boolean, target?: Element) => void;
}

function createEmptyRect(): DOMRectReadOnly {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  };
}

function createEntry(isIntersecting: boolean, target: Element): IntersectionObserverEntry {
  const rect = createEmptyRect();
  return {
    time: 0,
    rootBounds: null,
    boundingClientRect: rect,
    intersectionRect: rect,
    intersectionRatio: isIntersecting ? 1 : 0,
    isIntersecting,
    target,
  };
}

export function createIntersectionObserverFixture(): IntersectionObserverFixture {
  const instances: FixtureIntersectionObserver[] = [];

  class FixtureIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null;
    readonly rootMargin: string;
    readonly scrollMargin = '';
    readonly thresholds: readonly number[];
    readonly observedElements = new Set<Element>();
    readonly callback: IntersectionObserverCallback;

    constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
      this.callback = callback;
      this.root = options.root ?? null;
      this.rootMargin = options.rootMargin ?? '0px';
      this.thresholds = Array.isArray(options.threshold) ? [...options.threshold] : [options.threshold ?? 0];
      instances.push(this);
    }

    disconnect(): void {
      this.observedElements.clear();
    }

    observe(target: Element): void {
      this.observedElements.add(target);
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    unobserve(target: Element): void {
      this.observedElements.delete(target);
    }

    emit(isIntersecting: boolean, target?: Element): void {
      const targets = target ? (this.observedElements.has(target) ? [target] : []) : [...this.observedElements];
      const entries = targets.map((observedTarget) => createEntry(isIntersecting, observedTarget));
      if (entries.length > 0) {
        this.callback(entries, this);
      }
    }
  }

  return {
    Observer: FixtureIntersectionObserver,
    get observers() {
      return instances;
    },
    emit(observer, isIntersecting, target) {
      const selectedObserver = instances.find((instance) => instance === observer);
      selectedObserver?.emit(isIntersecting, target);
    },
  } satisfies IntersectionObserverFixture;
}
