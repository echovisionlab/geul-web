import { getLocaleDirection, getLocaleFontProfile, type SupportedLocale } from '../lib/i18n/locale';

interface LocaleOwner {
  id: symbol;
  locale: SupportedLocale;
  depth: number;
}

interface DocumentLocaleState {
  owners: LocaleOwner[];
  initialAttributes: Map<string, string | null>;
}

const documentLocales = new WeakMap<Document, DocumentLocaleState>();
const localeAttributes = ['lang', 'dir', 'data-font-profile'] as const;

function projectLocale(document: Document, state: DocumentLocaleState) {
  const root = document.documentElement;
  // Descendant layout effects run first. Depth keeps a nested canvas in control;
  // the most recently mounted peer wins until its own cleanup runs.
  const owner = state.owners.reduce<LocaleOwner | undefined>(
    (current, candidate) => (!current || candidate.depth >= current.depth ? candidate : current),
    undefined,
  );
  if (owner) {
    root.lang = owner.locale;
    root.dir = getLocaleDirection(owner.locale);
    root.dataset.fontProfile = getLocaleFontProfile(owner.locale);
    return;
  }
  for (const [name, value] of state.initialAttributes) {
    if (value === null) {
      root.removeAttribute(name);
    } else {
      root.setAttribute(name, value);
    }
  }
  documentLocales.delete(document);
}

/** Body portals inherit the active preview locale; its last owner restores the host document. */
export function applyStorybookDocumentLocale(document: Document, locale: SupportedLocale, depth = 0): () => void {
  let state = documentLocales.get(document);
  if (!state) {
    state = {
      owners: [],
      initialAttributes: new Map(localeAttributes.map((name) => [name, document.documentElement.getAttribute(name)])),
    };
    documentLocales.set(document, state);
  }
  const id = Symbol('storybook-locale-owner');
  state.owners.push({ id, locale, depth });
  projectLocale(document, state);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    state.owners = state.owners.filter((owner) => owner.id !== id);
    projectLocale(document, state);
  };
}
