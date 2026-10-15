#!/usr/bin/env node
// Spacing relationship audit.
//   node scripts/design-system/spacing-audit.mjs static
//   node scripts/design-system/spacing-audit.mjs measure [--url http://127.0.0.1:6010] [--theme light|dark]
//        [--widths 1440,390] [--stories id,id] [--label before|after]
// Results stay in the ignored .artifacts/design-system/reviews/spacing-audit/ directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from '@typescript/tooling';
import { listSourceFiles } from './token-scanner.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const outDir = path.join(repoRoot, '.artifacts/design-system/reviews/spacing-audit');
const spacingProperty = /^(?:gap|row-gap|column-gap|padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|inset(?:-[a-z-]+)?)$/;
const layoutProps = new Set([
  'gap',
  'rowGap',
  'columnGap',
  'space',
  'block',
  'inline',
  'blockStart',
  'blockEnd',
  'inlineStart',
  'inlineEnd',
  'padding',
  'inset',
]);
const auditedComponents = new Set([
  'LayoutStack',
  'LayoutInline',
  'LayoutGrid',
  'LayoutInset',
  'LayoutSpacer',
  'SectionCard',
  'EmptyState',
  'Stack',
  'Group',
  'SimpleGrid',
  'Flex',
]);
// Static files the audit treats as authored document/print geometry rather than product spacing.
const authoredGeometry = /(?:^lib\/styles\/(?:document-content|print)\.css$|\/PostHeader\/|\/PostHero|PostMeta)/;

const fieldLike =
  /^(?:Field|TextInput|Textarea|Select|NativeSelect|MultiSelect|TagsInput|NumberInput|PasswordInput|Checkbox|Radio|Switch|SegmentedControl|DateInput|DateTimeInput|DateRangeInput|DateTimePicker|TimePicker|ColorInput|FileInput|Slider|PinInput|[A-Z]\w*(?:Field|Input|Select))$/;
const sectionLike = /^(?:SectionCard|Section|Disclosure|[A-Z]\w*(?:Section|Panel|Card))$/;
const headingLike = /^(?:SectionHeader|PageHeader|Heading|Title)$/;
const actionLike = /^(?:Button|IconButton|TextButton|CopyButton|ToolbarCommand|[A-Z]\w*Button)$/;

/** Classifies the relationship a Layout container expresses from its direct JSX children. */
export function classifyRelationship(tag, childTags, hasMap) {
  if (tag === 'LayoutInset' || tag === 'SectionCard') return 'inset';
  if (tag === 'EmptyState') return 'empty-state';
  const inline = tag === 'LayoutInline' || tag === 'Group';
  const has = (pattern) => childTags.some((name) => pattern.test(name));
  if (inline && childTags.length && childTags.every((name) => actionLike.test(name))) return 'action-group';
  if (has(headingLike) && childTags.length > 1) return 'heading→content';
  if (has(sectionLike) && childTags.filter((name) => sectionLike.test(name)).length > 1) return 'section→section';
  if (childTags.filter((name) => fieldLike.test(name)).length > 1) return 'field→field';
  if (hasMap && !childTags.length) return 'list-item rhythm';
  if (!inline && childTags.length && childTags.every((name) => name === 'Text')) return 'text→text';
  if (inline) return 'inline cluster';
  return 'stack (mixed)';
}

/** Normalizes local Core aliases such as DsLayoutStack, EditorDsSectionCard or AppLayoutInset. */
export function normalizeTag(name) {
  return name.replace(/^(?:Editor|App|Story)?Ds(?=[A-Z])/, '').replace(/^(?:App|Story)(?=Layout[A-Z])/, '');
}

function jsxTagName(node) {
  const name = node.tagName;
  if (ts.isIdentifier(name)) return normalizeTag(name.text);
  if (ts.isPropertyAccessExpression(name)) return `${name.expression.getText()}.${name.name.text}`;
  return name.getText();
}

function propValue(initializer, ast) {
  if (!initializer) return 'true';
  if (ts.isStringLiteral(initializer)) return initializer.text;
  const expression = initializer.expression;
  if (expression && ts.isStringLiteralLike(expression)) return expression.text;
  if (expression && ts.isNumericLiteral(expression)) return `#${expression.text}`;
  return `{${(expression ?? initializer).getText(ast).replace(/\s+/g, ' ')}}`;
}

export function scanTsxSpacing(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const uses = [];
  const inlineStyles = [];
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = jsxTagName(opening);
      if (auditedComponents.has(tag)) {
        const children = ts.isJsxElement(node) ? node.children : [];
        const childTags = [];
        let hasMap = false;
        for (const child of children) {
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))
            childTags.push(jsxTagName(ts.isJsxElement(child) ? child.openingElement : child));
          else if (ts.isJsxExpression(child) && child.expression && /\.map\(/.test(child.expression.getText(ast)))
            hasMap = true;
        }
        const props = {};
        for (const attribute of opening.attributes.properties) {
          if (ts.isJsxAttribute(attribute) && layoutProps.has(attribute.name.getText(ast)))
            props[attribute.name.getText(ast)] = propValue(attribute.initializer, ast);
        }
        const line = ast.getLineAndCharacterOfPosition(opening.getStart(ast)).line + 1;
        uses.push({
          file,
          line,
          tag,
          props,
          childTags,
          relationship: classifyRelationship(tag, childTags, hasMap),
        });
      }
    }
    // style={{ padding: … }} and similar inline spacing keys.
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === 'style' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression &&
      ts.isObjectLiteralExpression(node.initializer.expression)
    ) {
      for (const property of node.initializer.expression.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = property.name.getText(ast).replace(/['"]/g, '');
        if (/^(?:gap|rowGap|columnGap|padding\w*|margin\w*|inset\w*)$/.test(key)) {
          const line = ast.getLineAndCharacterOfPosition(property.getStart(ast)).line + 1;
          inlineStyles.push({ file, line, key, value: property.initializer.getText(ast) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { uses, inlineStyles };
}

function isPrint(decl) {
  for (let parent = decl.parent; parent; parent = parent.parent)
    if (parent.type === 'atrule' && (parent.name === 'page' || /^print\b/.test(parent.params?.trim() ?? '')))
      return true;
  return false;
}

export function scanCssSpacing(file, source) {
  const declarations = [];
  postcss.parse(source, { from: file }).walkDecls((decl) => {
    const property = decl.prop.toLowerCase();
    if (!spacingProperty.test(property) || isPrint(decl)) return;
    const value = decl.value.replace(/\s*!important$/, '').trim();
    const literal = /(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/.test(value.replace(/0px/g, '0'));
    const calc = /calc\(/.test(value);
    declarations.push({
      file,
      line: decl.source.start.line,
      selector: decl.parent?.selector ?? decl.parent?.params ?? '',
      property,
      value,
      bypass: literal ? 'literal' : calc ? 'calc' : undefined,
    });
  });
  return declarations;
}

function tally(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function runStatic() {
  const files = listSourceFiles(repoRoot).filter(
    (file) => /^(?:app|components\/core|features|lib\/styles)\//.test(file) && !authoredGeometry.test(file),
  );
  const css = [];
  const uses = [];
  const inlineStyles = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    if (file.endsWith('.css')) css.push(...scanCssSpacing(file, source));
    else if (file.endsWith('.tsx')) {
      const result = scanTsxSpacing(file, source);
      uses.push(...result.uses);
      inlineStyles.push(...result.inlineStyles);
    }
  }
  const relationshipTable = {};
  for (const use of uses) {
    const value = use.props.gap ?? use.props.space ?? use.props.padding ?? use.props.block ?? '(default)';
    const row = (relationshipTable[`${use.tag} · ${use.relationship}`] ??= {});
    row[value] = (row[value] || 0) + 1;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    cssValueCounts: tally(css, (d) => d.value),
    cssBypasses: css.filter((d) => d.bypass),
    relationshipTable,
    layoutUses: uses,
    inlineStyles,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'static.json'), `${JSON.stringify(report, null, 2)}\n`);
  const lines = ['# Static spacing inventory', '', '## Relationship × value', ''];
  for (const [relationship, values] of Object.entries(relationshipTable).sort())
    lines.push(
      `- ${relationship}: ${Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => `${value}×${count}`)
        .join(', ')}`,
    );
  lines.push('', '## CSS literal/calc bypasses', '');
  for (const d of report.cssBypasses) lines.push(`- ${d.file}:${d.line} \`${d.property}: ${d.value}\` (${d.bypass})`);
  lines.push('', '## Inline style spacing in TSX', '');
  for (const s of inlineStyles) lines.push(`- ${s.file}:${s.line} \`${s.key}: ${s.value}\``);
  fs.writeFileSync(path.join(outDir, 'static.md'), `${lines.join('\n')}\n`);
  console.log(
    `static: ${css.length} CSS declarations, ${uses.length} Layout uses, ${inlineStyles.length} inline styles`,
  );
  console.log(`report: ${path.relative(repoRoot, path.join(outDir, 'static.md'))}`);
}

// ---------------------------------------------------------------------------------------------
// Browser measurement

export const defaultStories = [
  'core-layout-field--state-matrix',
  'core-layout-field--inline',
  'core-input-input-states--state-matrix',
  'core-layout-sectioncard--section-card-basic',
  'core-layout-sectionheader--grouped',
  'core-layout-pageheader--default',
  'core-layout-toolbarlayout--table-controls',
  'core-data-display-datatableview--populated',
  'core-overlays-formmodal--form',
  'core-overlays-confirmmodal--confirm',
  'core-overlays-contentmodal--content',
  'core-overlays-drawer--default',
  'core-navigation-dropdownmenu--default-command-dropdown-menu',
  'core-navigation-tabs--default',
  'core-interaction-disclosure--default',
  'core-feedback-alert--long-content',
  'core-feedback-emptystate--with-action',
  'pages-account-settings--profile',
  'pages-account-settings--security',
  'pages-account-full-pages--profile',
  'pages-admin-dashboard--ready',
  'pages-admin-content-lists--posts',
  'pages-admin-site-settings--ready',
  'pages-admin-user-edit--ready',
  'pages-editors-page--ready',
  'pages-editors-release--ready',
  'pages-public-catalog-entity-detail--release',
  'pages-public-documents--posts-index',
  'pages-auth-login--email',
  'pages-forms-public-response--all-fields',
  'pages-forms-operations--detail',
  'pages-user-profile--public',
];

/** Runs inside the page: measures sibling gaps and Field label/control/help gaps. */
function measureInPage() {
  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'absolute') return false;
    if (style.position === 'fixed') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const describe = (element) => {
    const parts = [element.tagName.toLowerCase()];
    for (const attribute of ['data-core-field', 'data-geul-layout', 'role', 'data-appearance', 'aria-label'])
      if (element.hasAttribute(attribute))
        parts.push(`[${attribute}${element.getAttribute(attribute) ? `=${element.getAttribute(attribute)}` : ''}]`);
    const text = (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    return `${parts.join('')}${text ? ` "${text}"` : ''}`;
  };
  const storyRoot = document.querySelector('#storybook-root') ?? document.body;
  // Overlays render in portals outside the story root; measure them as their own roots.
  const roots = [
    storyRoot,
    ...[...document.querySelectorAll('[role=dialog], [role=alertdialog], [role=menu], [role=listbox]')].filter(
      (element) => !storyRoot.contains(element),
    ),
  ];
  const gaps = [];
  for (const parent of roots.flatMap((root) => [root, ...root.querySelectorAll('*')])) {
    if (parent instanceof SVGElement) continue;
    if (!visible(parent)) continue;
    const children = [...parent.children].filter(visible);
    if (children.length < 2) continue;
    for (let index = 1; index < children.length; index += 1) {
      const previous = children[index - 1].getBoundingClientRect();
      const current = children[index].getBoundingClientRect();
      // Only vertical stacking: the next block starts below the previous one and overlaps horizontally.
      if (current.top < previous.bottom - 0.5) continue;
      if (current.left >= previous.right || current.right <= previous.left) continue;
      gaps.push({
        parent: describe(parent),
        before: describe(children[index - 1]),
        after: describe(children[index]),
        gap: Math.round((current.top - previous.bottom) * 100) / 100,
        y: Math.round(previous.bottom),
      });
    }
  }
  const fields = [];
  for (const label of roots.flatMap((root) => [...root.querySelectorAll('label')])) {
    if (!visible(label)) continue;
    const control = label.htmlFor ? document.getElementById(label.htmlFor) : null;
    if (!control || !visible(control)) continue;
    const labelRect = label.getBoundingClientRect();
    const frame = control.closest('[data-core-input-frame], [data-control-kind]') ?? control;
    const controlRect = frame.getBoundingClientRect();
    const describedBy = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    const help = describedBy.map((id) => document.getElementById(id)).filter((element) => element && visible(element));
    fields.push({
      label: (label.textContent || '').trim().slice(0, 40),
      labelToControl:
        controlRect.top >= labelRect.bottom - 0.5 ? Math.round((controlRect.top - labelRect.bottom) * 100) / 100 : null,
      inlineLabelGap:
        controlRect.top < labelRect.bottom - 0.5
          ? Math.round(
              Math.min(Math.abs(labelRect.left - controlRect.right), Math.abs(controlRect.left - labelRect.right)) *
                100,
            ) / 100
          : null,
      controlToHelp: help.length
        ? Math.round((help[0].getBoundingClientRect().top - controlRect.bottom) * 100) / 100
        : null,
    });
  }
  return { gaps, fields, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth };
}

function summarizeGaps(gaps) {
  return tally(gaps, (gap) => String(gap.gap));
}

async function runMeasure(args) {
  const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const url = option('url', 'http://127.0.0.1:6010');
  const theme = option('theme', 'light');
  const label = option('label', 'current');
  const widths = option('widths', '1440,390').split(',').map(Number);
  const storyFile = option('plan');
  const stories = option('stories')
    ? option('stories').split(',')
    : storyFile
      ? JSON.parse(fs.readFileSync(storyFile, 'utf8'))
      : defaultStories;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const target = path.join(outDir, label);
  fs.mkdirSync(path.join(target, 'screens'), { recursive: true });
  const results = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      for (const id of stories) {
        const entry = { id, width, theme };
        try {
          await page.goto(`${url}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`, {
            waitUntil: 'load',
            timeout: 60000,
          });
          await page.locator('#storybook-root > *').first().waitFor({ timeout: 30000 });
          await page.waitForTimeout(600);
          const measured = await page.evaluate(measureInPage);
          Object.assign(entry, measured, { gapHistogram: summarizeGaps(measured.gaps) });
          const shot = path.join(target, 'screens', `${id}--${width}-${theme}.png`);
          await page.screenshot({ path: shot, fullPage: true });
          entry.screenshot = path.relative(repoRoot, shot);
        } catch (error) {
          entry.error = error.message.split('\n')[0];
        }
        results.push(entry);
        const off = entry.gaps?.filter((gap) => ![0, 4, 8, 10, 12, 16, 24].includes(Math.round(gap.gap))) ?? [];
        console.log(
          `${width} ${id}: ${entry.error ?? `${entry.gaps.length} gaps, ${entry.fields.length} fields, ${off.length} off-scale`}`,
        );
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(target, `measure-${theme}.json`), `${JSON.stringify(results, null, 2)}\n`);
  console.log(`report: ${path.relative(repoRoot, path.join(target, `measure-${theme}.json`))}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'static') runStatic();
  else if (command === 'measure') await runMeasure(args);
  else {
    console.log('Usage: node scripts/design-system/spacing-audit.mjs static | measure [--url] [--theme] [--widths]');
    console.log('       [--stories id,id | --plan stories.json] [--label before|after]');
    process.exitCode = command ? 1 : 0;
  }
}
