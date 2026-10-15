import { getThemeDefinition, themeDefinitions, type ThemeId } from './themes';

interface InlineDeclaration {
  value: string;
  priority: string;
}

interface ThemeOwner {
  id: symbol;
  themeId: ThemeId;
  depth: number;
}

interface DocumentThemeState {
  owners: ThemeOwner[];
  initialMode: string | null;
  initialThemeId: string | null;
  declarations: Map<string, InlineDeclaration>;
}

const documentThemes = new WeakMap<Document, DocumentThemeState>();
const overrideVariables = Array.from(
  new Set(themeDefinitions.flatMap(({ overrides }) => Object.keys(overrides).map((role) => `--geul-${role}`))),
);

function restoreAttribute(root: HTMLElement, name: string, value: string | null) {
  if (value === null) {
    root.removeAttribute(name);
  } else {
    root.setAttribute(name, value);
  }
}

function projectTheme(document: Document, state: DocumentThemeState) {
  const root = document.documentElement;
  for (const [name, { value, priority }] of state.declarations) {
    if (value) {
      root.style.setProperty(name, value, priority);
    } else {
      root.style.removeProperty(name);
    }
  }

  // React mounts descendant layout effects first. Depth keeps the nested preview's
  // ownership stable regardless of that effect order; the newest peer wins.
  const owner = state.owners.reduce<ThemeOwner | undefined>(
    (current, candidate) => (!current || candidate.depth >= current.depth ? candidate : current),
    undefined,
  );
  if (owner) {
    const definition = getThemeDefinition(owner.themeId);
    root.dataset.geulTheme = definition.base;
    root.dataset.geulThemeId = definition.id;
    for (const [role, value] of Object.entries(definition.overrides)) {
      root.style.setProperty(`--geul-${role}`, value);
    }
  } else {
    restoreAttribute(root, 'data-geul-theme', state.initialMode);
    restoreAttribute(root, 'data-geul-theme-id', state.initialThemeId);
    documentThemes.delete(document);
  }
}

/**
 * Own the document's active theme so body portals inherit the same roles. A document
 * has one active theme; nested previews take priority and restore their parent on exit.
 * Only preset overrides are touched, preserving unrelated runtime CSS declarations.
 */
export function applyDocumentTheme(document: Document, themeId: ThemeId, depth = 0): () => void {
  const root = document.documentElement;
  let state = documentThemes.get(document);
  if (!state) {
    state = {
      owners: [],
      initialMode: root.getAttribute('data-geul-theme'),
      initialThemeId: root.getAttribute('data-geul-theme-id'),
      declarations: new Map(
        overrideVariables.map((name) => [
          name,
          { value: root.style.getPropertyValue(name), priority: root.style.getPropertyPriority(name) },
        ]),
      ),
    };
    documentThemes.set(document, state);
  }
  const id = Symbol('theme-owner');
  state.owners.push({ id, themeId, depth });
  projectTheme(document, state);
  return () => {
    state.owners = state.owners.filter((owner) => owner.id !== id);
    projectTheme(document, state);
  };
}
