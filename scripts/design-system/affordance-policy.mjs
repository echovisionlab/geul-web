import ts from '@typescript/tooling';
import { isProductionSource } from './token-policy.mjs';

/** Checks explicit Core slots; composed/dynamic layouts still require rendered review. */
export function scanAffordancePlacement(file, source) {
  if (!isProductionSource(file) || !file.endsWith('.tsx') || file.startsWith('components/core/')) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const core = new Map(),
    icons = new Map(),
    findings = [];
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const module = node.moduleSpecifier.text,
      bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const target = /^@\/components\/core(?:\/|$)/.test(module) ? core : module === '@tabler/icons-react' ? icons : null;
    if (target)
      for (const entry of bindings.elements) target.set(entry.name.text, entry.propertyName?.text ?? entry.name.text);
  }
  const opening = (node) =>
    ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  const property = (node, name) =>
    node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(tree) === name);
  const literal = (attribute) =>
    attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : undefined;
  const contains = (node, predicate) => {
    if (predicate(node)) return true;
    let found = false;
    ts.forEachChild(node, (child) => {
      if (!found && contains(child, predicate)) found = true;
    });
    return found;
  };
  const handle = (node) => {
    const control = opening(node);
    return (
      control &&
      core.get(control.tagName.getText(tree)) === 'IconButton' &&
      literal(property(control, 'interaction')) === 'drag-handle'
    );
  };
  const report = (node, kind, summary) => {
    const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
    findings.push({ file, line: position.line + 1, column: position.character + 1, kind, summary });
  };
  const visit = (node) => {
    const control = opening(node),
      name = control && core.get(control.tagName.getText(tree));
    if (name === 'Button' || name === 'TextButton') {
      const slot = property(control, 'leftSection');
      if (
        slot &&
        contains(slot, (child) => {
          const glyph = opening(child);
          return glyph && ['IconChevronDown', 'IconChevronUp'].includes(icons.get(glyph.tagName.getText(tree)));
        })
      )
        report(
          slot,
          'opening-indicator-left',
          'Opening chevrons belong on the right. Use the Core menu/disclosure indicator.',
        );
    }
    if (name === 'Disclosure') {
      const actions = property(control, 'actions');
      if (actions && contains(actions, handle))
        report(actions, 'drag-handle-trailing', 'Drag handles belong in leadingActions, before the label.');
    }
    if (name === 'LayoutInline' && ts.isJsxElement(node)) {
      const children = node.children.filter(
        (child) => !(ts.isJsxText(child) && !child.text.trim()) && !(ts.isJsxExpression(child) && !child.expression),
      );
      children.forEach((child, index) => {
        if (index > 0 && handle(child))
          report(
            child,
            'drag-handle-trailing',
            'Place the drag handle first in its row, before the content and actions.',
          );
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return findings;
}
