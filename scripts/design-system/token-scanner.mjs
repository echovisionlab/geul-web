import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import ts from '@typescript/tooling';
import {
  authoredColorFiles,
  authoredGeometryFiles,
  authoredTypographyFiles,
  fontDefinitionFiles,
  fontRoles,
  legacyDefinitionFiles,
  isPrivateOrFrameworkProperty,
  isProductionSource,
  runtimeRoleOwners,
  sourceRoots,
  tokenDefinitionFiles,
} from './token-policy.mjs';

// Fixed-channel CSS colors. Token expressions such as rgb(var(--channel)) are allowed.
const literalPattern =
  /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.+-][^)]*\)|\bcolor\(\s*(?:srgb|display-p3|a98-rgb|prophoto-rgb|rec2020)\s+[\d.+-][^)]*\)/gi;
const namedColors = new Set(
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgrey darkgreen darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray grey green greenyellow honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgrey lightgreen lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(
    ' ',
  ),
);
const referencePattern = /var\(\s*(--(?:geul-|font-|editor-(?:text|background)-color-)[\w-]+)/gi;
const registeredRolePattern = /^--(?:geul-|font-|editor-(?:text|background)-color-)/;
const dimensionPattern = /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/gi;
const spacingProperty =
  /^(?:padding|margin|gap|row-gap|column-gap|font-size|line-height|border-radius|width|height|min-width|min-height|max-width|max-height)(?:-|$)/;

const enforcedSpacingProperty = /^(?:padding|margin|inset)(?:-[a-z-]+)?$|^(?:gap|row-gap|column-gap)$/;
// React inline style keys for the same spacing relationships (camelCase).
const inlineSpacingKey = /^(?:gap|rowGap|columnGap|(?:padding|margin|inset)(?:[A-Z]\w*)?)$/;
// Type sizes and line heights consume the shared roles (`--geul-font-size-*`, `--geul-heading-*`,
// `--geul-line-height-*`), on screen and on paper. Any absolute or relative unit is a bypass.
const typographyProperty = /^(?:font-size|line-height|font)$/;
const typographyKey = /^(?:fontSize|lineHeight|font)$/;
const typographyDimension =
  /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em|pt|pc|mm|cm|in|q|%|vw|vh|vi|vb|vmin|vmax|svh|dvh|lvh|cqw|cqh|cqi|cqb|ch|ex|cap|ic|lh|rlh)(?![\w-])/gi;
const fontSizeKeyword = /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i;

/** Literal type sizes in a CSS value (`font-size`, `line-height`, `font`). Zero and keywords such as inherit pass. */
export function typographyLiterals(property, value) {
  const candidate = value
    .replace(/\s*!important\s*$/i, '')
    .replace(/url\([^)]*\)|['"][^'"]*['"]/g, '')
    .trim();
  const found = [...candidate.matchAll(typographyDimension)]
    .map((match) => match[0].toLowerCase())
    .filter((item) => Number.parseFloat(item) !== 0);
  if (property === 'font-size' && fontSizeKeyword.test(candidate)) found.push(candidate.toLowerCase());
  if (property === 'line-height' && /^(?:\d*\.)?\d+$/.test(candidate) && Number(candidate) !== 0) found.push(candidate);
  return found;
}

/** Literal type sizes in a TS value: React numbers are pixels or unitless line heights. */
function inlineTypographyLiterals(expression, property) {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
    return inlineTypographyLiterals(expression.expression, property);
  if (ts.isConditionalExpression(expression))
    return [
      ...inlineTypographyLiterals(expression.whenTrue, property),
      ...inlineTypographyLiterals(expression.whenFalse, property),
    ];
  if (ts.isBinaryExpression(expression) && /^(?:\?\?|\|\|)$/.test(expression.operatorToken.getText()))
    return [
      ...inlineTypographyLiterals(expression.left, property),
      ...inlineTypographyLiterals(expression.right, property),
    ];
  if (ts.isNumericLiteral(expression)) return Number(expression.text) !== 0 ? [expression.text] : [];
  const texts = ts.isStringLiteralLike(expression)
    ? [expression.text]
    : ts.isTemplateExpression(expression)
      ? [expression.head.text, ...expression.templateSpans.map((span) => span.literal.text)]
      : [];
  return texts.flatMap((text) => typographyLiterals(property, text));
}

/** Literal spacing in a JSX style value: numbers are React px, strings are checked for dimensions. */
function inlineSpacingLiterals(expression) {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
    return inlineSpacingLiterals(expression.expression);
  if (ts.isConditionalExpression(expression))
    return [...inlineSpacingLiterals(expression.whenTrue), ...inlineSpacingLiterals(expression.whenFalse)];
  if (ts.isBinaryExpression(expression) && /^(?:\?\?|\|\|)$/.test(expression.operatorToken.getText()))
    return [...inlineSpacingLiterals(expression.left), ...inlineSpacingLiterals(expression.right)];
  if (ts.isNumericLiteral(expression)) return Number(expression.text) !== 0 ? [`${expression.text}`] : [];
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  )
    return Number(expression.operand.text) !== 0 ? [`-${expression.operand.text}`] : [];
  const texts = ts.isStringLiteralLike(expression)
    ? [expression.text]
    : ts.isTemplateExpression(expression)
      ? [expression.head.text, ...expression.templateSpans.map((span) => span.literal.text)]
      : [];
  return texts.flatMap((text) =>
    [...text.matchAll(dimensionPattern)]
      .map((match) => match[0].toLowerCase())
      .filter((value) => Number.parseFloat(value) !== 0),
  );
}

function isPrintDeclaration(declaration) {
  for (let parent = declaration.parent; parent; parent = parent.parent) {
    if (
      parent.type === 'atrule' &&
      (parent.name === 'page' || (parent.name === 'media' && /^print(?:\s|$)/.test(parent.params.trim())))
    )
      return true;
  }
  return false;
}

function literals(value, css = false, colorProperty = false) {
  const candidate = css ? value.replace(/url\([^)]*\)|['"][^'"]*['"]/g, '') : value;
  const matches = [...candidate.matchAll(literalPattern)].map((match) => match[0].toLowerCase());
  // Ignore token-name segments and quoted assets before checking CSS named literals.
  // Mantine's named palette keys in TS remain valid API token references.
  if (css && colorProperty) {
    const unreferenced = candidate.replace(/--[\w-]+/g, '');
    for (const match of unreferenced.matchAll(/[a-z]+/gi)) {
      if (namedColors.has(match[0].toLowerCase())) matches.push(match[0].toLowerCase());
    }
  }
  return matches;
}

export function scanSource(file, source, knownTokens = new Set()) {
  const findings = [];
  const dimensions = [];
  const declarations = [];
  const add = (kind, value, line, column, context = '') => findings.push({ file, kind, value, line, column, context });
  const central = tokenDefinitionFiles.has(file);
  const authored = authoredColorFiles.has(file);
  const references = (value, line, column) => {
    for (const match of value.matchAll(referencePattern)) {
      if (!knownTokens.has(match[1])) add('unknown-token', match[1], line, column);
    }
  };
  if (file.endsWith('.css')) {
    let root;
    try {
      root = postcss.parse(source, { from: file });
    } catch (error) {
      add('parse-error', error.reason || error.message, error.line || 1, error.column || 1);
      return { findings, dimensions, declarations };
    }
    root.walkDecls((decl) => {
      const { line, column } = decl.source.start;
      const context = decl.prop;
      const property = decl.prop.toLowerCase();
      const colorProperty = /color|background|border|shadow|fill|stroke|outline|filter/.test(property);
      if (!central && !authored && (colorProperty || decl.prop.startsWith('--')))
        for (const value of literals(decl.value, true, colorProperty)) add('raw-color', value, line, column, context);
      if (decl.prop.startsWith('--')) {
        declarations.push({ file, name: decl.prop, value: decl.value, line });
        if (
          !central &&
          !(fontDefinitionFiles.has(file) && fontRoles.has(decl.prop)) &&
          !isPrivateOrFrameworkProperty(decl.prop)
        )
          add('custom-token', decl.prop, line, column, decl.value);
      }
      references(decl.value, line, column);
      if (
        !central &&
        !authoredTypographyFiles.has(file) &&
        !isPrintDeclaration(decl) &&
        enforcedSpacingProperty.test(property)
      ) {
        for (const match of decl.value.matchAll(dimensionPattern)) {
          // em offsets on positioned markers follow the glyph metrics of their text, not the spacing scale.
          if (property.startsWith('inset') && /\d(?:em)$/i.test(match[0])) continue;
          if (Number.parseFloat(match[0]) !== 0) add('raw-spacing', match[0].toLowerCase(), line, column, context);
        }
      }
      // Paper has its own projection of the same roles, so print rules are not exempt.
      if (!central && !authoredTypographyFiles.has(file) && typographyProperty.test(property)) {
        for (const value of typographyLiterals(property, decl.value))
          add('raw-font-size', value, line, column, context);
      }
      if (!central && spacingProperty.test(property)) {
        for (const value of decl.value.matchAll(dimensionPattern))
          dimensions.push({ file, property: decl.prop, value: value[0], line });
      }
    });
  } else {
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    if (ast.parseDiagnostics.length) {
      for (const error of ast.parseDiagnostics) {
        const loc = ast.getLineAndCharacterOfPosition(error.start ?? 0);
        add('parse-error', ts.flattenDiagnosticMessageText(error.messageText, '\n'), loc.line + 1, loc.character + 1);
      }
    }
    const visit = (node) => {
      // style={{ padding: 12 }} bypasses the spacing scale exactly like a CSS literal.
      if (
        !central &&
        !authoredGeometryFiles.has(file) &&
        ts.isJsxAttribute(node) &&
        node.name.getText(ast) === 'style' &&
        node.initializer &&
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression &&
        ts.isObjectLiteralExpression(node.initializer.expression)
      ) {
        for (const property of node.initializer.expression.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
          if (!inlineSpacingKey.test(key)) continue;
          const loc = ast.getLineAndCharacterOfPosition(property.getStart(ast));
          for (const value of inlineSpacingLiterals(property.initializer))
            add('raw-spacing', value, loc.line + 1, loc.character + 1, `style.${key}`);
        }
      }
      // Type sizes in style objects, option objects (`{ fontSize: 13 }`), DOM style/canvas assignments
      // (`label.style.fontSize = '11px'`) and setProperty('font-size', …) bypass the shared type roles.
      if (!central && !authoredTypographyFiles.has(file)) {
        let key;
        let value;
        if (ts.isPropertyAssignment(node)) {
          key = node.name.getText(ast).replace(/^['"]|['"]$/g, '');
          value = node.initializer;
          if (key === 'font-size' || key === 'line-height') key = key === 'font-size' ? 'fontSize' : 'lineHeight';
        } else if (
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(node.left)
        ) {
          key = node.left.name.text;
          value = node.right;
        } else if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'setProperty' &&
          node.arguments.length > 1 &&
          ts.isStringLiteralLike(node.arguments[0]) &&
          /^(?:font-size|line-height|font)$/.test(node.arguments[0].text)
        ) {
          key = node.arguments[0].text;
          value = node.arguments[1];
        }
        if (key && value && (typographyKey.test(key) || typographyProperty.test(key))) {
          const loc = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          const property = /^line-?height$/i.test(key)
            ? 'line-height'
            : /^font-?size$/i.test(key)
              ? 'font-size'
              : 'font';
          for (const literal of inlineTypographyLiterals(value, property))
            add('raw-font-size', literal, loc.line + 1, loc.character + 1, key);
        }
      }
      if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
        const expression = node.expression;
        const method = ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)
            ? expression.argumentExpression.text
            : undefined;
        const name = node.arguments[0].text;
        if (method === 'setProperty' && name.startsWith('--') && !central && !isPrivateOrFrameworkProperty(name)) {
          const loc = ast.getLineAndCharacterOfPosition(node.arguments[0].getStart(ast));
          if (registeredRolePattern.test(name) && !knownTokens.has(name))
            add('unknown-token', name, loc.line + 1, loc.character + 1);
          else if (!knownTokens.has(name))
            add('custom-token', name, loc.line + 1, loc.character + 1, node.arguments[1]?.getText(ast) || '');
        }
      }
      if (
        ts.isStringLiteralLike(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        const loc = ast.getLineAndCharacterOfPosition(node.getStart(ast));
        const { text } = node;
        // Property keys are definitions, not values. This catches inline CSS custom properties.
        if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node && text.startsWith('--')) {
          if (
            !central &&
            !(knownTokens.has(text) && runtimeRoleOwners.get(file)?.has(text)) &&
            !isPrivateOrFrameworkProperty(text)
          )
            add('custom-token', text, loc.line + 1, loc.character + 1, node.parent.initializer.getText(ast));
        } else {
          if (!central && !authored)
            for (const value of literals(text)) add('raw-color', value, loc.line + 1, loc.character + 1);
          references(text, loc.line + 1, loc.character + 1);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return { findings, dimensions, declarations };
}

export function listSourceFiles(repoRoot) {
  const files = [];
  const visit = (folder) => {
    if (!fs.existsSync(path.join(repoRoot, folder))) return;
    for (const entry of fs.readdirSync(path.join(repoRoot, folder), { withFileTypes: true })) {
      const file = `${folder}/${entry.name}`;
      if (
        entry.isDirectory() &&
        !/^(?:node_modules|gen|generated|vendor|storybook-static|docs|fixtures|__fixtures__|__tests__)$/.test(
          entry.name,
        )
      )
        visit(file);
      else if (entry.isFile() && isProductionSource(file)) files.push(file);
    }
  };
  sourceRoots.forEach(visit);
  if (fs.existsSync(path.join(repoRoot, 'theme.ts'))) files.push('theme.ts');
  return files.sort();
}

export function readKnownTokens(repoRoot) {
  const known = new Set();
  for (const file of [...tokenDefinitionFiles, ...legacyDefinitionFiles, ...fontDefinitionFiles]) {
    if (!file.endsWith('.css') || !fs.existsSync(path.join(repoRoot, file))) continue;
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    postcss.parse(source).walkDecls((decl) => {
      if (
        /^--geul-/.test(decl.prop) ||
        (fontDefinitionFiles.has(file) && fontRoles.has(decl.prop)) ||
        (tokenDefinitionFiles.has(file) && /^--editor-(?:text|background)-color-/.test(decl.prop))
      )
        known.add(decl.prop);
    });
  }
  return known;
}

export function findingKey(finding) {
  return JSON.stringify([
    finding.file,
    finding.kind,
    finding.value,
    finding.kind === 'custom-token' ? '' : finding.context,
  ]);
}

export function compareBaseline(findings, baseline = {}) {
  const used = new Map();
  const added = [];
  const existing = [];
  for (const finding of findings) {
    const key = findingKey(finding);
    const count = (used.get(key) || 0) + 1;
    used.set(key, count);
    // Unknown references and parse failures never receive a migration allowance.
    if (['unknown-token', 'parse-error'].includes(finding.kind) || count > (baseline[key] || 0)) added.push(finding);
    else existing.push(finding);
  }
  const stale = Object.entries(baseline).filter(([key, count]) => (used.get(key) || 0) < count);
  return { added, existing, stale };
}

export function baselineFrom(findings) {
  const baseline = {};
  for (const finding of findings) {
    if (['unknown-token', 'parse-error'].includes(finding.kind)) continue;
    const key = findingKey(finding);
    baseline[key] = (baseline[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)));
}

export function scanRepository(repoRoot) {
  const known = readKnownTokens(repoRoot);
  const files = listSourceFiles(repoRoot);
  const result = { files, knownTokens: [...known].sort(), findings: [], dimensions: [], declarations: [] };
  for (const file of files) {
    const scan = scanSource(file, fs.readFileSync(path.join(repoRoot, file), 'utf8'), known);
    result.findings.push(...scan.findings);
    result.dimensions.push(...scan.dimensions);
    result.declarations.push(...scan.declarations);
  }
  return result;
}
