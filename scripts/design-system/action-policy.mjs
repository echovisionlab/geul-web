import ts from '@typescript/tooling';
import { isProductionSource } from './token-policy.mjs';

/** Explicit semantic evidence only. Arbitrary callbacks/spreads require contextual review. */
export function scanActionUsage(file, source) {
  if (!isProductionSource(file) || !/\.[jt]sx$/.test(file)) return [];
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map();
  for (const node of tree.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    if (!/(?:components\/core|^\.\.?\/)/.test(node.moduleSpecifier.text)) continue;
    for (const entry of bindings.elements) imports.set(entry.name.text, entry.propertyName?.text ?? entry.name.text);
  }
  const opening = (node) =>
    ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
  const prop = (node, name) =>
    node.attributes.properties.find(
      (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(tree) === name,
    );
  const tag = (node) => {
    const parts = node.tagName.getText(tree).split('.');
    return [imports.get(parts[0]) ?? parts[0], ...parts.slice(1)].join('.');
  };
  const strong = (attribute) => {
    if (!attribute?.initializer) return false;
    let found = false;
    const visit = (node) => {
      if (ts.isStringLiteral(node) && node.text === 'strong') found = true;
      ts.forEachChild(node, visit);
    };
    visit(attribute.initializer);
    return found;
  };
  const findings = [];
  const visit = (node) => {
    const control = opening(node);
    if (control && ['Button', 'IconButton', 'TextButton'].includes(tag(control)) && strong(prop(control, 'emphasis'))) {
      const selection = prop(control, 'aria-pressed') || prop(control, 'aria-current');
      let menu = ['menu', 'disclosure'].includes(prop(control, 'indicator')?.initializer?.text);
      for (let parent = node.parent; parent; parent = parent.parent) {
        const ancestor = opening(parent);
        if (ancestor && ['DropdownMenu.Target', 'Popover.Target'].includes(tag(ancestor))) menu = true;
      }
      if (selection || menu) {
        findings.push({
          file,
          line: tree.getLineAndCharacterOfPosition(control.getStart(tree)).line + 1,
          kind: selection ? 'selection-as-commit' : 'opening-as-commit',
          summary:
            'Selection and opening controls use medium/low emphasis; strong is reserved for a principal commit or a reviewed contrast boundary.',
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return findings;
}
