import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/tooling';
import postcss from 'postcss';
import { isProductionSource } from './token-policy.mjs';
import { collectLayoutSources } from './layout-policy.mjs';
export const collectFrameworkSources = collectLayoutSources;
const owners = /^components\/core\//;
const providerFiles = new Set(['lib/providers/DesignSystemProvider.tsx']);
/** Native disclosure is only retained by the development-only DOM diagnostic viewer. */
export const nativeDisclosureOwners = new Map([
  [
    'app/editor-lab-local/EditorInteractionLab.tsx',
    'Development diagnostic JSON/DOM inspection, not product disclosure',
  ],
]);
/**
 * Native interactive controls outside Core. Each owner states why Core cannot render it.
 * Hidden form fields carry protocol data and are always allowed.
 */
export const nativeControlOwners = new Map([
  [
    'features/page/PageView/blocks/DefaultBlockView.tsx',
    'Authored task-list state rendered read-only inside published document content',
  ],
  [
    'features/page/PageView/blocks/GeneratedRichTextBlockViewRuntime.tsx',
    'Authored task-list state rendered read-only inside published document content',
  ],
]);
const nativeControlTags = new Set(['button', 'input', 'select', 'textarea']);
/** Vendor presentation is forbidden at every application boundary. */
export const transitionalFrameworkOwners = new Set();
const closedComponents = new Set([
  'Button',
  'IconButton',
  'TextButton',
  'NavigationLink',
  'Link',
  'TextInput',
  'Textarea',
  'NumberInput',
  'Select',
  'MultiSelect',
  'NativeSelect',
  'Checkbox',
  'Switch',
  'Slider',
  'RangeSlider',
  'SegmentedControl',
  'Radio',
  'PasswordInput',
  'PinInput',
  'ColorInput',
  'JsonInput',
  'SearchComboboxView',
  'CountrySelect',
  'DateTimeInput',
  'DateInput',
  'DateTimePicker',
  'MonthPickerInput',
  'DateRangeInput',
  'TimePicker',
  'Field',
  'Text',
  'Heading',
  'SectionCard',
  'StatCard',
  'SectionHeader',
  'LabelBadge',
  'StatusBadge',
  'Alert',
  'Progress',
  'Avatar',
  'Spinner',
  'Separator',
  'Skeleton',
  'ScrollArea',
  'Table',
  'Pagination',
  'ContentModal',
  'ConfirmModal',
  'FormModal',
  'Drawer',
  'Popover',
  'Tooltip',
  'DropdownMenu',
  'Disclosure',
  'MenuToggle',
  'Tabs',
  'CommandPalette',
  'CommandPaletteResults',
  'CommandSuggestions',
  'NativeRange',
  'MediaTransport',
  'MediaAudioFrame',
  'MediaVideoFrame',
  'MediaActionSlot',
  'Carousel',
  'ParameterPanel',
  'MapNavigation',
  'ApplicationFrame',
  'SegmentedProgress',
  'DisclosureRegion',
  'ToolbarSurface',
  'ProcessingOverlay',
  'FloatingPanel',
  'MediaImage',
  'Chart',
  'FilePicker',
  'ImageUploadField',
  'ImagePreviewFrame',
  'UploadPlaceholder',
  'VisuallyHidden',
  'Code',
  'List',
  'SelectionSurface',
  'SelectionGrid',
  'SelectionToolbar',
  'SelectionPath',
  'SelectionStatus',
  'SelectionThumbnail',
  'SelectionMarquee',
  'SocialIcon',
  'SocialIconGlyph',
  'SocialIdentityIcon',
  'ResizeHandle',
]);
const closedFamilies =
  /(?:^|\/)components\/core(?:\/(?:Button|IconButton|TextButton|Navigation|Input|Field|Typography|Section|Badge|Alert|Progress|Display|Modal|Drawer|Popover|Tooltip|DropdownMenu|Disclosure|MenuToggle|Tabs|CommandPalette|Carousel|ApplicationFrame|ParameterPanel|MapNavigation|Selection|Chart|MediaImage|MediaControls|ImageUpload|FloatingPanel|Social|ResizeHandle)(?:\/|$)|\/index(?:\.ts)?$|$)/;
const forbidden = new Set([
  'style',
  'styles',
  'className',
  'classNames',
  'vars',
  'unstyled',
  'component',
  'renderRoot',
  'color',
  'c',
  'bg',
  'radius',
  'shadow',
  'p',
  'px',
  'py',
  'pt',
  'pb',
  'pl',
  'pr',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mb',
  'ml',
  'mr',
  'ms',
  'me',
  'w',
  'h',
  'miw',
  'mih',
  'maw',
  'mah',
  'fz',
  'fw',
  'ff',
  'lh',
  'ta',
  'td',
  'tt',
  'opacity',
  'bd',
  'bdrs',
]);
const normalize = (value) => value.split(path.sep).join('/');
function ownModule(file, specifier, root) {
  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(root, path.dirname(file), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    base + '.ts',
    base + '.tsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
  ])
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return normalize(path.relative(root, candidate));
  return null;
}
export function createFrameworkResolver(root) {
  const cache = new Map();
  function exportsFor(file, specifier, seen = new Set()) {
    const target = ownModule(file, specifier, root),
      canonical = specifier.startsWith('@/') ? specifier.slice(2) : target;
    if (canonical && closedFamilies.test(canonical)) return new Map([...closedComponents].map((name) => [name, name]));
    if (!target || seen.has(target)) return new Map();
    if (cache.has(target)) return cache.get(target);
    const ast = ts.createSourceFile(target, fs.readFileSync(path.join(root, target), 'utf8'), 99, true),
      result = new Map(),
      next = new Set(seen).add(target);
    for (const s of ast.statements) {
      if (
        !ts.isExportDeclaration(s) ||
        !s.moduleSpecifier ||
        !ts.isStringLiteralLike(s.moduleSpecifier) ||
        s.isTypeOnly
      )
        continue;
      const upstream = exportsFor(target, s.moduleSpecifier.text, next);
      if (!s.exportClause) for (const [k, v] of upstream) result.set(k, v);
      else if (ts.isNamedExports(s.exportClause))
        for (const e of s.exportClause.elements) {
          const original = upstream.get(e.propertyName?.text ?? e.name.text);
          if (original && !e.isTypeOnly) result.set(e.name.text, original);
        }
    }
    cache.set(target, result);
    return result;
  }
  return { exportsFor };
}
export function scanFrameworkOwnership(
  file,
  source,
  { root = process.cwd(), resolver = createFrameworkResolver(root) } = {},
) {
  file = normalize(file);
  if (!isProductionSource(file) || file.includes('.type-test.')) return [];
  const findings = [];
  const ast = ts.createSourceFile(file, source, 99, true, file.endsWith('.tsx') ? 4 : 3);
  const add = (node, kind, summary, severity = 'error') => {
    const p =
      typeof node === 'number'
        ? { line: node - 1, character: 0 }
        : ast.getLineAndCharacterOfPosition(node.getStart(ast));
    findings.push({ file, line: p.line + 1, column: p.character + 1, kind, summary, severity });
  };
  const owner = owners.test(file) || ['lib/styles/design-tokens.css', 'lib/styles/variables.css'].includes(file);
  const names = new Map(),
    namespaces = new Set(),
    projections = new Set(),
    sortableItemHooks = new Set();
  const specifier = (value, node) => {
    if (
      value.startsWith('@mantine/') &&
      !/^@mantine\/(hooks|form)(\/|$)/.test(value) &&
      !transitionalFrameworkOwners.has(file)
    )
      add(node, 'vendor-ui', 'Mantine presentation is forbidden. Compose the typed Core owner.');
    if (/^react-aria-components(?:\/|$)/.test(value) && !owner && !providerFiles.has(file))
      add(node, 'raw-aria-ui', 'React Aria primitives belong to Core; consume the closed Core contract.');
    if (!owner && /components\/core\/.*\.css$/.test(value))
      add(node, 'core-style-import', 'Private Core styles may only be imported by their owner.');
  };
  if (file.endsWith('.css')) {
    try {
      const css = postcss.parse(source);
      css.walkRules((rule) => {
        if (
          !owner &&
          /data-(?:geul|core)-|\.react-aria-/.test(rule.selector.replace(/\[data-geul-theme(?:=[^\]]+)?\]/g, ''))
        )
          add(
            rule.source.start.line,
            'core-state-css',
            'Core state/primitive selectors may only be styled by their owner.',
          );
      });
      css.walkDecls((decl) => {
        if (
          !owner &&
          /--_(?:control|input|surface|carousel|layout|overlay|social|toc)-/.test(decl.prop + ' ' + decl.value)
        )
          add(decl.source.start.line, 'core-private-css', 'Core private variables may only be used by their owner.');
      });
      css.walkAtRules('import', (rule) => {
        const value = rule.params.replace(/["']/g, '');
        specifier(value, rule.source.start.line);
      });
    } catch (error) {
      add(error.line ?? 1, 'parse', error.message);
    }
    return findings;
  }
  for (const s of ast.statements) {
    if (
      (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) &&
      s.moduleSpecifier &&
      ts.isStringLiteralLike(s.moduleSpecifier)
    ) {
      const value = s.moduleSpecifier.text;
      specifier(value, s);
      if (
        ts.isImportDeclaration(s) &&
        !s.importClause?.isTypeOnly &&
        ['@/components/core/Sortable', '@/components/core'].includes(value)
      ) {
        const bindings = s.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const b of bindings.elements)
            if (!b.isTypeOnly && (b.propertyName?.text ?? b.name.text) === 'useSortableItem')
              sortableItemHooks.add(b.name.text);
      }
      if (ts.isImportDeclaration(s) && !s.importClause?.isTypeOnly && value === '@/components/core/bindings') {
        const bindings = s.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const b of bindings.elements) {
            if (
              !b.isTypeOnly &&
              ['fieldBindings', 'interactionBindings', 'componentBindings'].includes(
                b.propertyName?.text ?? b.name.text,
              )
            )
              projections.add(b.name.text);
          }
      }
      if (ts.isImportDeclaration(s) && !s.importClause?.isTypeOnly) {
        const exports = resolver.exportsFor(file, value),
          bindings = s.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings))
          for (const b of bindings.elements)
            if (!b.isTypeOnly && exports.has(b.propertyName?.text ?? b.name.text))
              names.set(b.name.text, exports.get(b.propertyName?.text ?? b.name.text));
        if (bindings && ts.isNamespaceImport(bindings) && exports.size) namespaces.add(bindings.name.text);
        if (s.importClause?.name && /components\/core\/Navigation/.test(value))
          names.set(s.importClause.name.text, 'NavigationLink');
      }
    }
  }
  function initializer(name, node) {
    for (let current = node.parent; current; current = current.parent) {
      const statements = ts.isSourceFile(current) || ts.isBlock(current) ? current.statements : null;
      if (statements)
        for (const statement of statements) {
          if (ts.isVariableStatement(statement))
            for (const d of statement.declarationList.declarations)
              if (ts.isIdentifier(d.name) && d.name.text === name) return d.initializer;
          if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
        }
      if (
        ts.isFunctionLike(current) &&
        current.parameters?.some((p) => ts.isIdentifier(p.name) && p.name.text === name)
      )
        return null;
    }
    return null;
  }
  /** `{...item.handle}` where `const item = useSortableItem(...)`: Core projects the handle binding. */
  function sortableHandleProjection(expression, node) {
    if (
      !ts.isPropertyAccessExpression(expression) ||
      expression.name.text !== 'handle' ||
      !ts.isIdentifier(expression.expression)
    )
      return false;
    const name = expression.expression.text;
    for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
      if (
        ts.isFunctionLike(current) &&
        current.parameters?.some((p) => ts.isIdentifier(p.name) && p.name.text === name)
      )
        return false;
      if (!ts.isBlock(current)) continue;
      for (const statement of current.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const d of statement.declarationList.declarations) {
          if (!ts.isIdentifier(d.name) || d.name.text !== name) continue;
          const init = d.initializer;
          return Boolean(
            init &&
            ts.isCallExpression(init) &&
            ts.isIdentifier(init.expression) &&
            sortableItemHooks.has(init.expression.text) &&
            !projectionIsShadowed(init.expression.text, init),
          );
        }
      }
    }
    return false;
  }
  function projectionIsShadowed(name, node) {
    const binds = (binding) =>
      ts.isIdentifier(binding)
        ? binding.text === name
        : binding.elements.some((element) => ts.isBindingElement(element) && binds(element.name));
    for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) {
      if (ts.isFunctionLike(current) && current.parameters?.some((p) => binds(p.name))) return true;
      if (ts.isBlock(current))
        for (const statement of current.statements) {
          if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => binds(d.name)))
            return true;
          if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return true;
        }
    }
    return false;
  }
  function properties(node, seen = new Set()) {
    if (!node || seen.has(node)) return null;
    seen = new Set(seen).add(node);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))
      return properties(node.expression, seen);
    if (ts.isIdentifier(node)) return properties(initializer(node.text, node), seen);
    if (ts.isConditionalExpression(node)) {
      // Both closed literal branches are checked; either unresolved branch keeps the spread unresolved.
      const whenTrue = properties(node.whenTrue, seen);
      const whenFalse = properties(node.whenFalse, seen);
      return whenTrue && whenFalse ? [...whenTrue, ...whenFalse] : null;
    }
    if (!ts.isObjectLiteralExpression(node)) return null;
    const result = [];
    for (const p of node.properties) {
      if (ts.isSpreadAssignment(p)) {
        const nested = properties(p.expression, seen);
        result.push(...(nested ?? [{ name: null, node: p }]));
      } else if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)))
        result.push({ name: p.name.text, node: p });
      else if (p.name && ts.isComputedPropertyName(p.name) && ts.isStringLiteralLike(p.name.expression))
        result.push({ name: p.name.expression.text, node: p });
      else result.push({ name: null, node: p });
    }
    return result;
  }
  function protectedProp(name, component) {
    return (
      forbidden.has(name) ||
      name.startsWith('data-geul-') ||
      name.startsWith('data-core-') ||
      (['SocialIcon', 'SocialIconGlyph', 'SocialIdentityIcon'].includes(component) &&
        ['width', 'height', 'fill', 'stroke', 'strokeWidth'].includes(name))
    );
  }
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      specifier(node.arguments[0].text, node);
    if (!owner && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      const tag = node.tagName.getText(ast);
      if (/^[a-z]/.test(tag) && !nativeControlOwners.has(file)) {
        const attribute = (name) =>
          node.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(ast) === name);
        const literal = (a) => (a?.initializer && ts.isStringLiteral(a.initializer) ? a.initializer.text : undefined);
        if (nativeControlTags.has(tag) && !(tag === 'input' && literal(attribute('type')) === 'hidden'))
          add(
            node,
            'raw-native-control',
            `Native <${tag}> belongs to a Core control (Button, IconButton, TextButton, TextInput, Select, FilePicker...). Extend Core when no owner fits.`,
          );
        if (literal(attribute('role')) === 'button')
          add(node, 'raw-native-control', 'role="button" on a generic element belongs to a Core command control.');
      }
      if (tag === 'summary' && !nativeDisclosureOwners.has(file)) {
        add(
          node,
          'raw-disclosure',
          'Product disclosure triggers belong to Core Disclosure; native summary is reserved for the named diagnostic owner.',
        );
      }
      const parts = node.tagName.getText(ast).split('.'),
        closed =
          names.get(parts[0]) ||
          (parts.length > 1 && namespaces.has(parts[0]) && closedComponents.has(parts[1]) ? parts[1] : undefined);
      if (closed)
        for (const a of node.attributes.properties) {
          if (ts.isJsxAttribute(a) && protectedProp(a.name.getText(ast), closed))
            add(
              a,
              'core-visual-prop',
              `Core does not accept external presentation ${a.name.getText(ast)}. Extend the owner contract when necessary.`,
            );
          if (ts.isJsxSpreadAttribute(a)) {
            const values = properties(a.expression);
            const projected =
              (ts.isCallExpression(a.expression) &&
                ts.isIdentifier(a.expression.expression) &&
                projections.has(a.expression.expression.text) &&
                !projectionIsShadowed(a.expression.expression.text, a)) ||
              sortableHandleProjection(a.expression, a);
            if (!projected && (!values || values.some((p) => p.name === null)))
              add(
                a,
                'unresolved-core-spread',
                'Dynamic Core forwarding requires a closed prop type and runtime projection; static policy cannot prove its contents.',
                'warning',
              );
            for (const p of values ?? [])
              if (p.name && protectedProp(p.name, closed))
                add(p.node, 'core-visual-prop', `Core spread supplies forbidden presentation ${p.name}.`);
          }
        }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}
