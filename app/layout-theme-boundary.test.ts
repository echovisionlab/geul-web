import fs from 'node:fs';
import path from 'node:path';
import ts from '@typescript/tooling';
import { describe, expect, it } from 'vitest';

// RootLayout is a server composition boundary. Check its real JSX ancestry without
// mocking the session/manifest/database bootstrap and accidentally hiding placement.
describe('root catalogue theme boundary', () => {
  it('places one canonical AppDesignSystemProvider outside the message boundary and preserves the server preference', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/layout.tsx'), 'utf8');
    const ast = ts.createSourceFile('app/layout.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const elements: ts.JsxElement[] = [];
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node)) {
        elements.push(node);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    const themed = elements.filter(
      (element) => element.openingElement.tagName.getText(ast) === 'AppDesignSystemProvider',
    );
    const messages = elements.find(
      (element) => element.openingElement.tagName.getText(ast) === 'ClientMessagesProvider',
    );
    expect(themed).toHaveLength(1);
    expect(messages).toBeDefined();
    const ancestors: ts.Node[] = [];
    for (let ancestor = messages?.parent; ancestor; ancestor = ancestor.parent) {
      ancestors.push(ancestor);
    }
    expect(ancestors).toContain(themed[0]);
    const preference = themed[0].openingElement.attributes.properties.find(
      (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'defaultColorScheme',
    );
    expect(preference?.getText(ast)).toBe('defaultColorScheme={initialColorScheme}');
  });
});
