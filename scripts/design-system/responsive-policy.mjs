import postcss from 'postcss';
import ts from '@typescript/tooling';
import { isProductionSource, tokenDefinitionFiles } from './token-policy.mjs';

// These thresholds describe one renderer's geometry, not global product breakpoints.
export const geometryQueries = new Map([
  ['components/core/ImageUpload/UploadPlaceholder.module.css', new Set(['(max-width: 18rem)'])],
  ['features/map/ui/MapLibreMapView.css', new Set(['(max-width: 480px)'])],
  ['features/mermaid/Mermaid.module.css', new Set(['(max-width: 680px)'])],
]);
const numericQuery =
  /\((?:(?:min|max)-width\s*:\s*\d+(?:\.\d+)?(?:px|rem|em)|width\s*[<>=]+\s*\d+(?:\.\d+)?(?:px|rem|em)|\d+(?:\.\d+)?(?:px|rem|em)\s*[<>=]+\s*width)\s*\)/g;
const actionPrivate = /--_control-height|--_input-(?:height|font)/;
const actionState = /\[data-(?:control-size|geul-input-(?:size|density)|geul-control-toolbar-density)\b/;
export function scanResponsiveOwnership(file, source) {
  if (!isProductionSource(file) || tokenDefinitionFiles.has(file)) return [];
  const findings = [];
  const add = (line, kind, summary) => findings.push({ file, line, kind, summary });
  const inspectQuery = (text, line) => {
    for (const [query] of text.matchAll(numericQuery)) {
      if (!geometryQueries.get(file)?.has(query))
        add(
          line,
          'literal-breakpoint',
          'Use generated breakpoint variables in CSS or breakpointQuery in JS; component geometry requires a narrow owner record.',
        );
    }
  };
  if (file.endsWith('.css')) {
    try {
      const root = postcss.parse(source, { from: file });
      root.walkAtRules((rule) => {
        if (['media', 'container'].includes(rule.name)) inspectQuery(rule.params, rule.source.start.line);
      });
      if (!file.startsWith('components/core/')) {
        root.walkRules((rule) => {
          if (actionState.test(rule.selector))
            add(rule.source.start.line, 'action-size-ownership', 'Core owns action and input density selectors.');
        });
        root.walkDecls((decl) => {
          if (actionPrivate.test(decl.prop) || actionPrivate.test(decl.value))
            add(decl.source.start.line, 'action-size-ownership', 'Core owns private action and input geometry.');
        });
      }
    } catch {
      add(1, 'parse-error', 'Invalid stylesheet');
    }
  } else {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
        const value = ts.isTemplateExpression(node) ? node.getText(ast) : node.text;
        inspectQuery(value, ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return findings;
}
