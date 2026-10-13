#!/usr/bin/env node
// Typography role audit.
//   node scripts/design-system/typography-audit.mjs static
//   node scripts/design-system/typography-audit.mjs measure [--url http://127.0.0.1:6010] [--label before|after]
//        [--widths 390,834,1440] [--themes light,dark] [--locales en,ar] [--media screen,print]
//        [--stories id,id | --plan stories.json] [--pdf] [--out dir]
//   node scripts/design-system/typography-audit.mjs compare <before/measure.json> <after/measure.json>
//   node scripts/design-system/typography-audit.mjs gaps <measure.json>   (editor ↔ published block gaps)
// Results stay in the ignored .artifacts/design-system/reviews/typography/audit/ directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from '@typescript/tooling';
import { listSourceFiles } from './token-scanner.mjs';
import { authoredTypographyFiles } from './token-policy.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const outDir = path.join(repoRoot, '.artifacts/design-system/reviews/typography/audit');
const typeProperty = /^(?:font-size|line-height|font|letter-spacing)$/;
const typographyComponents = new Set(['Text', 'Heading', 'SupportingText', 'LocaleCode', 'Code']);
const typographyProps = ['size', 'weight', 'tone', 'level', 'scale', 'role', 'font', 'casing'];

/** Classifies one CSS type value: shared role, component-private role, expression or literal bypass. */
export function classifyTypeValue(property, value) {
  const bare = value.replace(/\s*!important$/u, '').trim();
  if (/^(?:inherit|initial|unset|revert|0)$/u.test(bare)) return 'keyword';
  if (property === 'line-height' && bare === '0') return 'keyword';
  const withoutVars = bare.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/gu, '');
  if (/(?<![\w-])-?(?:\d*\.)?\d+(?:px|rem|em|pt|pc|mm|cm|in|q|%|vw|vh|vmin|vmax|cqi|ch|ex)\b/iu.test(withoutVars))
    return 'literal';
  if (
    property === 'font-size' &&
    /^(?:xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/iu.test(withoutVars.trim())
  )
    return 'literal';
  if (property === 'line-height' && /^(?:\d*\.)?\d+$/u.test(bare)) return 'literal';
  if (/\b(?:calc|min|max|clamp)\(/u.test(bare)) return 'expression';
  if (/^var\(--geul-/u.test(bare)) return 'token';
  if (/^var\(--_/u.test(bare)) return 'private';
  if (/^var\(/u.test(bare)) return 'other-variable';
  return 'keyword';
}

function isPrint(decl) {
  for (let parent = decl.parent; parent; parent = parent.parent)
    if (parent.type === 'atrule' && (parent.name === 'page' || /^print\b/u.test(parent.params?.trim() ?? '')))
      return true;
  return false;
}

export function scanCssTypography(file, source) {
  const declarations = [];
  postcss.parse(source, { from: file }).walkDecls((decl) => {
    const property = decl.prop.toLowerCase();
    if (!typeProperty.test(property)) return;
    if (property === 'font' && /^(?:inherit|initial|unset)$/u.test(decl.value.trim())) return;
    const value = decl.value.trim();
    declarations.push({
      file,
      line: decl.source.start.line,
      selector: decl.parent?.selector ?? decl.parent?.params ?? '',
      property,
      value,
      print: isPrint(decl),
      kind: classifyTypeValue(property, value),
    });
  });
  return declarations;
}

function jsxTagName(node) {
  const name = node.tagName;
  if (ts.isIdentifier(name)) return name.text.replace(/^(?:Editor|App|Story)?Ds(?=[A-Z])/u, '');
  return name.getText();
}

function propValue(initializer, ast) {
  if (!initializer) return 'true';
  if (ts.isStringLiteral(initializer)) return initializer.text;
  const expression = initializer.expression;
  if (expression && ts.isStringLiteralLike(expression)) return expression.text;
  if (expression && ts.isNumericLiteral(expression)) return expression.text;
  return `{${(expression ?? initializer).getText(ast).replace(/\s+/gu, ' ')}}`;
}

/** Core typography usage, inline font styles and runtime DOM font assignments in TS/TSX. */
export function scanTsTypography(file, source) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const uses = [];
  const inline = [];
  const line = (node) => ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
  const visit = (node) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      const tag = jsxTagName(opening);
      if (typographyComponents.has(tag)) {
        const props = {};
        for (const attribute of opening.attributes.properties)
          if (ts.isJsxAttribute(attribute) && typographyProps.includes(attribute.name.getText(ast)))
            props[attribute.name.getText(ast)] = propValue(attribute.initializer, ast);
        uses.push({ file, line: line(opening), tag, props });
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(ast).replace(/^['"]|['"]$/gu, '');
      if (/^(?:fontSize|lineHeight|font)$/u.test(key))
        inline.push({ file, line: line(node), key, value: node.initializer.getText(ast).replace(/\s+/gu, ' ') });
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      /^(?:fontSize|lineHeight|font)$/u.test(node.left.name.text)
    )
      inline.push({ file, line: line(node), key: `.${node.left.name.text}=`, value: node.right.getText(ast) });
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { uses, inline };
}

function tally(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function runStatic() {
  const files = listSourceFiles(repoRoot).filter((file) => /^(?:app|components|features|lib)\//u.test(file));
  const css = [];
  const uses = [];
  const inline = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
    if (file.endsWith('.css')) css.push(...scanCssTypography(file, source));
    else {
      const result = scanTsTypography(file, source);
      uses.push(...result.uses);
      inline.push(...result.inline);
    }
  }
  const feature = (item) => !/^(?:components\/core|lib\/styles)\//u.test(item.file);
  const report = {
    generatedAt: new Date().toISOString(),
    cssValueCounts: tally(
      css.filter((d) => d.property === 'font-size'),
      (d) => `${d.print ? '[print] ' : ''}${d.value}`,
    ),
    cssLiterals: css.filter((d) => d.kind === 'literal'),
    cssExpressions: css.filter((d) => d.kind === 'expression'),
    featureCssFontSizes: css.filter((d) => d.property === 'font-size' && feature(d) && d.kind !== 'keyword'),
    coreUsage: tally(uses, (use) =>
      [use.tag, ...typographyProps.filter((key) => use.props[key]).map((key) => `${key}=${use.props[key]}`)].join(' '),
    ),
    inline,
    authoredExceptions: [...authoredTypographyFiles.entries()],
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'static.json'), `${JSON.stringify(report, null, 2)}\n`);
  const lines = ['# Static typography inventory', '', '## CSS font-size values', ''];
  for (const [value, count] of Object.entries(report.cssValueCounts)) lines.push(`- \`${value}\` ×${count}`);
  lines.push('', '## CSS literal type values (bypass the shared roles)', '');
  for (const d of report.cssLiterals)
    lines.push(`- ${d.file}:${d.line} ${d.print ? '[print] ' : ''}\`${d.property}: ${d.value}\``);
  lines.push('', '## CSS type expressions (calc/min/max/clamp)', '');
  for (const d of report.cssExpressions)
    lines.push(`- ${d.file}:${d.line} ${d.print ? '[print] ' : ''}\`${d.property}: ${d.value}\``);
  lines.push('', '## Feature CSS font sizes (check whether Core Text/Heading owns the role)', '');
  for (const d of report.featureCssFontSizes) lines.push(`- ${d.file}:${d.line} \`${d.selector}\` → \`${d.value}\``);
  lines.push('', '## Core typography usage (component × props)', '');
  for (const [key, count] of Object.entries(report.coreUsage)) lines.push(`- ${key} ×${count}`);
  lines.push('', '## Inline/runtime font properties in TS/TSX', '');
  for (const s of inline) lines.push(`- ${s.file}:${s.line} \`${s.key} ${s.value}\``);
  fs.writeFileSync(path.join(outDir, 'static.md'), `${lines.join('\n')}\n`);
  console.log(
    `static: ${css.length} CSS type declarations (${report.cssLiterals.length} literal), ${uses.length} Core typography uses, ${inline.length} inline font properties`,
  );
  console.log(`report: ${path.relative(repoRoot, path.join(outDir, 'static.md'))}`);
}

// ---------------------------------------------------------------------------------------------
// Browser measurement

export const defaultStories = [
  'foundations-typography--reference',
  'core-typography-text--scale',
  'core-typography-text--heading-levels',
  'pages-public-documents--post',
  'pages-public-documents--post-hero',
  'pages-public-documents--post-long-document',
  'pages-public-documents--page-long-document',
  'pages-legal-public-document--terms',
  'pages-public-utilities--changelog',
  'pages-public-catalog-entity-detail--release',
  'feature-editor-tiptap-playground--editor',
  'feature-editor-tiptap-playground--published',
  'pages-editors-post--ready',
];

/** Runs inside the page: shared role sizes, text sizes and the document heading hierarchy. */
function measureInPage() {
  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.append(probe);
  const root = getComputedStyle(document.documentElement);
  const roles = {};
  for (const name of [
    'font-size-xs',
    'font-size-sm',
    'font-size-md',
    'font-size-lg',
    'font-size-xl',
    'heading-title',
    'heading-h1',
    'heading-h2',
    'heading-h3',
    'heading-h4',
    'heading-h5',
    'heading-h6',
    'chrome-font-size',
    'chrome-section-font-size',
  ]) {
    if (!root.getPropertyValue(`--geul-${name}`).trim()) continue;
    probe.style.fontSize = `var(--geul-${name})`;
    roles[name] = Number.parseFloat(getComputedStyle(probe).fontSize);
  }
  probe.remove();
  const allowed = new Set(Object.values(roles).map((value) => Math.round(value * 100) / 100));
  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const describe = (element) => {
    const parts = [element.tagName.toLowerCase()];
    for (const attribute of ['data-core-typography', 'data-size', 'data-level', 'data-role', 'data-content-type'])
      if (element.hasAttribute(attribute)) parts.push(`[${attribute}=${element.getAttribute(attribute)}]`);
    const owner = element.closest('[class]');
    const className = owner?.getAttribute('class')?.split(/\s+/u)[0] ?? '';
    return `${parts.join('')}${className ? ` .${className.replace(/_[\w-]{5,}$/u, '')}` : ''}`;
  };
  const texts = [];
  for (const element of document.body.querySelectorAll('*')) {
    if (element instanceof SVGElement || /^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/u.test(element.tagName)) continue;
    const own = [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ')
      .trim();
    if (!own || !visible(element)) continue;
    const style = getComputedStyle(element);
    const size = Math.round(Number.parseFloat(style.fontSize) * 100) / 100;
    texts.push({
      size,
      lineHeight: style.lineHeight,
      weight: style.fontWeight,
      descriptor: describe(element),
      text: own.replace(/\s+/gu, ' ').slice(0, 40),
      // Authored runtimes size their own glyphs relative to the surrounding role (KaTeX, Monaco, maps).
      runtime: Boolean(element.closest('.katex, .monaco-editor, .maplibregl-map, canvas')),
      offScale: !allowed.has(size) && !element.closest('.katex, .monaco-editor, .maplibregl-map'),
    });
  }
  const sizeOf = (selector) => {
    const element = [...document.querySelectorAll(selector)].find(visible);
    return element ? Math.round(Number.parseFloat(getComputedStyle(element).fontSize) * 100) / 100 : null;
  };
  // Body headings by authored level: published headings carry `data-heading-level` (their element may be
  // demoted under a document title); materialized HTML without it falls back to the element.
  const authored = (level) =>
    `.prose :is(h1, h2, h3, h4, h5, h6)[data-heading-level="${level}"], .prose h${level}:not([data-heading-level]), ` +
    `.tiptap-editor [data-content-type=heading][data-level="${level}"]`;
  const hierarchy = {
    title: sizeOf('[data-document-title], h1[data-core-typography=heading]'),
    h1: sizeOf(authored(1)),
    h2: sizeOf(authored(2)),
    h3: sizeOf(authored(3)),
    body: sizeOf('.prose p, .tiptap-editor [data-content-type=paragraph]'),
  };
  // Every visible body heading: element, authored level and box, for before/after comparison by id.
  const headings = [...document.querySelectorAll('.prose :is(h1, h2, h3, h4, h5, h6)')]
    .filter(visible)
    .map((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const tag = element.tagName.toLowerCase();
      return {
        key: element.id || `${tag}-${index}`,
        tag,
        authored: Number(element.getAttribute('data-heading-level') ?? tag.slice(1)),
        size: Math.round(Number.parseFloat(style.fontSize) * 100) / 100,
        lineHeight: style.lineHeight,
        weight: style.fontWeight,
        top: Math.round((rect.top + scrollY) * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
      };
    });
  const outline = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading][aria-level]')]
    .filter(visible)
    .map((element) => Number(element.getAttribute('aria-level') ?? element.tagName.slice(1)));
  const round = (value) => Math.round(value * 10) / 10;
  // Reading measure: characters per full line (the last line is excluded) of the first long paragraph in
  // the published body and in the editor, grouped into lines by glyph position. Spaces count.
  const lineStats = (element) => {
    const style = getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const top = element.getBoundingClientRect().top;
    const lines = new Map();
    const range = document.createRange();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent;
      for (let index = 0; index < text.length; index += 1) {
        if (/[\udc00-\udfff]/u.test(text[index])) continue;
        range.setStart(node, index);
        range.setEnd(node, Math.min(text.length, index + (/[\ud800-\udbff]/u.test(text[index]) ? 2 : 1)));
        const rect = [...range.getClientRects()].find((box) => box.width > 0);
        if (!rect) continue;
        const line = Math.floor((rect.top + rect.height / 2 - top) / lineHeight);
        lines.set(line, (lines.get(line) ?? 0) + 1);
      }
    }
    const counts = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, count]) => count);
    const full = counts.slice(0, -1).sort((a, b) => a - b);
    return {
      surface: element.closest('.tiptap-editor') ? 'editor' : 'published',
      lang: element.closest('[lang]')?.getAttribute('lang') ?? null,
      dir: getComputedStyle(element).direction,
      width: round(element.getBoundingClientRect().width),
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: style.lineHeight,
      lineHeightRatio: Math.round((lineHeight / Number.parseFloat(style.fontSize)) * 100) / 100,
      lines: counts.length,
      charsPerLine: full.length ? { median: full[Math.floor(full.length / 2)], min: full[0], max: full.at(-1) } : null,
    };
  };
  const reading = ['.prose p', '.tiptap-editor [data-content-type=paragraph]']
    .map((selector) =>
      [...document.querySelectorAll(selector)].find(
        (element) => visible(element) && element.textContent.trim().length >= 160,
      ),
    )
    .filter(Boolean)
    .map(lineStats);
  // Block rhythm: the box gap between consecutive visible blocks of each published `.prose` (and nested
  // `[data-document-children]`) and each Tiptap block group, labelled by block kind. Gaps are box gaps.
  const kindOf = (element) =>
    element.getAttribute('data-document-block') ??
    element.querySelector(':scope > [data-container-kind]')?.getAttribute('data-container-kind') ??
    element.querySelector('[data-content-type]')?.getAttribute('data-content-type') ??
    element.tagName.toLowerCase();
  const idOf = (element) =>
    element.getAttribute('data-id') ?? element.firstElementChild?.getAttribute('data-id') ?? null;
  const gapList = (group) => {
    const children = [...group.children].filter(visible);
    return children.slice(1).map((element, index) => ({
      fromId: idOf(children[index]),
      toId: idOf(element),
      from: kindOf(children[index]),
      to: kindOf(element),
      gap: round(element.getBoundingClientRect().top - children[index].getBoundingClientRect().bottom),
    }));
  };
  const blockGaps = {
    published: [...document.querySelectorAll('.prose, .prose [data-document-children], .prose [data-callout-content]')]
      .filter(visible)
      .map((group) => ({
        nested: group.hasAttribute('data-document-children'),
        gaps: gapList(group),
      })),
    editor: [...document.querySelectorAll('.tiptap-editor .editor-block-group')].filter(visible).map((group) => ({
      nested: Boolean(group.parentElement?.closest('.editor-block-group')),
      gaps: gapList(group),
    })),
  };
  // Outline clearance: the reading column (first running-text block), the widest breakout and the
  // persistent outline column or rail, in the inline direction of the document.
  const readingBlock =
    [...document.querySelectorAll('.prose[data-reading-measure] > [data-document-block="paragraph"]')].find(visible) ??
    [...document.querySelectorAll('[data-geul-layout-size="reading"]')].find(visible) ??
    null;
  const navigation = [...document.querySelectorAll('[data-presentation]')].find(visible) ?? null;
  const box = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { left: round(rect.left), right: round(rect.right), width: round(rect.width) };
  };
  const breakouts = [...document.querySelectorAll('.prose[data-reading-measure] > [data-document-measure]')]
    .filter(visible)
    .map((element) => ({ measure: element.getAttribute('data-document-measure'), ...box(element) }));
  const rtl = readingBlock ? getComputedStyle(readingBlock).direction === 'rtl' : false;
  const clearance = (target) => {
    if (!target || !navigation) return null;
    const nav = navigation.getBoundingClientRect();
    return round(rtl ? target.left - nav.right : nav.left - target.right);
  };
  const body = box(readingBlock);
  const layout = {
    presentation: navigation?.getAttribute('data-presentation') ?? null,
    body,
    navigation: box(navigation),
    bodyCenterOffset: body ? round((body.left + body.right) / 2 - innerWidth / 2) : null,
    clearance: clearance(body),
    breakouts: breakouts.map((breakout) => ({ ...breakout, clearance: clearance(breakout) })),
  };
  return {
    roles,
    texts,
    hierarchy,
    headings,
    outline: { h1Count: outline.filter((level) => level === 1).length, levels: outline },
    reading,
    blockGaps,
    layout,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
  };
}

/** Written after every entry so an interrupted run keeps its evidence. */
function writeSummary(target, results) {
  const summary = results.map(({ texts = [], ...entry }) => ({
    ...entry,
    sizeHistogram: tally(texts, (text) => String(text.size)),
    offScale: texts.filter((text) => text.offScale),
  }));
  fs.writeFileSync(path.join(target, 'measure.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

async function runMeasure(args) {
  const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const url = option('url', 'http://127.0.0.1:6010');
  const label = option('label', 'current');
  const widths = option('widths', '390,834,1440').split(',').map(Number);
  const themes = option('themes', 'light').split(',');
  const locales = option('locales', 'en').split(',');
  const media = option('media', 'screen').split(',');
  const planFile = option('plan');
  const stories = option('stories')
    ? option('stories').split(',')
    : planFile
      ? JSON.parse(fs.readFileSync(planFile, 'utf8'))
      : defaultStories;
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const target = option('out') ? path.resolve(option('out'), label) : path.join(outDir, label);
  fs.mkdirSync(path.join(target, 'screens'), { recursive: true });
  const results = [];
  try {
    for (const mode of media)
      for (const width of mode === 'print' ? [794] : widths)
        for (const theme of themes)
          for (const locale of locales) {
            const context = await browser.newContext({
              viewport: { width, height: mode === 'print' ? 1123 : 1000 },
              deviceScaleFactor: 1,
              reducedMotion: 'reduce',
            });
            const page = await context.newPage();
            if (mode === 'print') await page.emulateMedia({ media: 'print' });
            for (const id of stories) {
              const entry = { id, width, theme, locale, media: mode };
              const name = `${id}--${mode}-${width}-${theme}-${locale}`;
              try {
                await page.goto(
                  `${url}/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`theme:${theme};locale:${locale}`)}`,
                  { waitUntil: 'load', timeout: 120000 },
                );
                await page.locator('#storybook-root > *').first().waitFor({ timeout: 90000 });
                await page.evaluate(() => document.fonts?.ready);
                await page.waitForTimeout(800);
                Object.assign(entry, await page.evaluate(measureInPage));
                const shot = path.join(target, 'screens', `${name}.png`);
                await page.screenshot({ path: shot, fullPage: true });
                entry.screenshot = path.relative(repoRoot, shot);
                if (mode === 'print' && args.includes('--pdf')) {
                  const pdf = path.join(target, 'screens', `${name}.pdf`);
                  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
                  entry.pdf = path.relative(repoRoot, pdf);
                }
              } catch (error) {
                entry.error = error.message.split('\n')[0];
              }
              results.push(entry);
              writeSummary(target, results);
              const off = entry.texts?.filter((text) => text.offScale) ?? [];
              const h = entry.hierarchy ?? {};
              const measureLine = (entry.reading ?? [])
                .map(
                  (stats) =>
                    `${stats.surface} ${stats.width}px ${stats.lineHeightRatio} ${stats.charsPerLine?.median ?? '-'} ch/line`,
                )
                .join(', ');
              const clearance =
                entry.layout?.clearance == null
                  ? ''
                  : `; outline ${entry.layout.presentation} clearance ${entry.layout.clearance}px`;
              console.log(
                `${mode} ${width} ${theme} ${locale} ${id}: ${
                  entry.error ??
                  `${entry.texts.length} texts, ${off.length} off-scale; title ${h.title} h1 ${h.h1} h2 ${h.h2} h3 ${h.h3} body ${h.body}; page h1 × ${entry.outline?.h1Count}${measureLine ? `; ${measureLine}` : ''}${clearance}`
                }`,
              );
            }
            await context.close();
          }
  } finally {
    await browser.close();
  }
  writeSummary(target, results);
  console.log(`report: ${path.relative(repoRoot, path.join(target, 'measure.json'))}`);
}

/**
 * Compares two `measure` runs heading by heading (matched by story, media, width, theme, locale and
 * heading id): font size, line height, weight and box height must be equal; the element may differ.
 */
export function compareMeasures(before, after) {
  const caseKey = (entry) => `${entry.id} ${entry.media} ${entry.width} ${entry.theme} ${entry.locale}`;
  const afterCases = new Map(after.map((entry) => [caseKey(entry), entry]));
  const rows = [];
  for (const entry of before) {
    const other = afterCases.get(caseKey(entry));
    const afterHeadings = new Map((other?.headings ?? []).map((heading) => [heading.key, heading]));
    for (const heading of entry.headings ?? []) {
      const next = afterHeadings.get(heading.key);
      const differences = next
        ? ['size', 'lineHeight', 'weight', 'height', 'width', 'authored'].filter(
            (property) => heading[property] !== next[property],
          )
        : ['missing'];
      rows.push({
        case: caseKey(entry),
        key: heading.key,
        authored: heading.authored,
        before: `${heading.tag} ${heading.size}px/${heading.lineHeight} h${heading.height}`,
        after: next ? `${next.tag} ${next.size}px/${next.lineHeight} h${next.height}` : 'missing',
        differences,
      });
    }
  }
  return rows;
}

function runCompare(args) {
  const [beforeFile, afterFile] = args;
  if (!beforeFile || !afterFile) {
    console.log(
      'Usage: node scripts/design-system/typography-audit.mjs compare <before/measure.json> <after/measure.json>',
    );
    process.exitCode = 1;
    return;
  }
  const rows = compareMeasures(
    JSON.parse(fs.readFileSync(beforeFile, 'utf8')),
    JSON.parse(fs.readFileSync(afterFile, 'utf8')),
  );
  const changed = rows.filter((row) => row.differences.length);
  const lines = [
    '| case | heading | authored | before | after | differences |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows)
    lines.push(
      `| ${row.case} | ${row.key} | ${row.authored} | ${row.before} | ${row.after} | ${row.differences.join(', ') || '='} |`,
    );
  const report = path.join(path.dirname(path.resolve(afterFile)), 'compare.md');
  fs.writeFileSync(report, `${lines.join('\n')}\n`);
  console.log(`${rows.length} headings compared, ${changed.length} differ`);
  for (const row of changed)
    console.log(`  ${row.case} ${row.key}: ${row.before} -> ${row.after} (${row.differences})`);
  console.log(`report: ${path.relative(repoRoot, report)}`);
  if (changed.length) process.exitCode = 1;
}

/**
 * Editor ↔ published block rhythm of one `measure` run: the gap above each block of every Tiptap block
 * group (top level and nested) is paired by block id with the gap above the same block in the published `.prose`
 * (the comparison story renders one document in both). A pair differs when the box gaps are not equal
 * within half a pixel; it is unpaired when the previous block differs (an unpublished blank draft).
 */
export function compareBlockGaps(entries) {
  const rows = [];
  for (const entry of entries) {
    // Top-level and nested groups (children, callout content); block ids are unique in a document.
    const flatten = (groups = []) =>
      groups.flatMap((group) => group.gaps.map((gap) => ({ ...gap, nested: group.nested })));
    const editor = flatten(entry.blockGaps?.editor).filter((gap) => gap.toId && gap.fromId);
    const published = flatten(entry.blockGaps?.published).filter((gap) => gap.toId);
    if (!editor.length || !published.length) continue;
    const publishedById = new Map(published.map((gap) => [gap.toId, gap]));
    for (const left of editor) {
      const right = publishedById.get(left.toId);
      // Blank drafts are not published, so a block can follow a different neighbour in each surface.
      const comparable = Boolean(right && right.fromId === left.fromId);
      rows.push({
        case: `${entry.id} ${entry.media} ${entry.width} ${entry.theme} ${entry.locale}`,
        block: left.toId,
        nested: left.nested,
        editor: `${left.from} → ${left.to} ${left.gap}`,
        published: right ? `${right.from} → ${right.to} ${right.gap}` : 'not published',
        state: !comparable ? 'unpaired' : Math.abs(left.gap - right.gap) <= 0.5 ? 'equal' : 'differs',
      });
    }
  }
  return rows;
}

function runGaps(args) {
  const [file] = args;
  if (!file) {
    console.log('Usage: node scripts/design-system/typography-audit.mjs gaps <measure.json>');
    process.exitCode = 1;
    return;
  }
  const rows = compareBlockGaps(JSON.parse(fs.readFileSync(file, 'utf8')));
  const lines = ['| case | block | editor | published | state |', '| --- | --- | --- | --- | --- |'];
  for (const row of rows)
    lines.push(
      `| ${row.case} | ${row.block?.slice(-4) ?? ''}${row.nested ? ' (nested)' : ''} | ${row.editor} | ${row.published} | ${row.state} |`,
    );
  const report = path.join(path.dirname(path.resolve(file)), 'gaps.md');
  fs.writeFileSync(report, `${lines.join('\n')}\n`);
  const differing = rows.filter((row) => row.state === 'differs');
  const unpaired = rows.filter((row) => row.state === 'unpaired');
  console.log(
    `${rows.length} editor block gaps, ${differing.length} differ, ${unpaired.length} unpaired (unpublished neighbour)`,
  );
  for (const row of [...differing, ...unpaired])
    console.log(`  ${row.state} ${row.case} ${row.block}: editor ${row.editor} / published ${row.published}`);
  console.log(`report: ${path.relative(repoRoot, report)}`);
  if (differing.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'static') runStatic();
  else if (command === 'measure') await runMeasure(args);
  else if (command === 'compare') runCompare(args);
  else if (command === 'gaps') runGaps(args);
  else {
    console.log('Usage: node scripts/design-system/typography-audit.mjs static');
    console.log(
      '       node scripts/design-system/typography-audit.mjs measure [--url] [--label] [--widths 390,834,1440]',
    );
    console.log('            [--themes light,dark] [--locales en,ar] [--media screen,print] [--pdf]');
    console.log('            [--stories id,id | --plan stories.json] [--out dir]');
    console.log(
      '       node scripts/design-system/typography-audit.mjs compare <before/measure.json> <after/measure.json>',
    );
    console.log('       node scripts/design-system/typography-audit.mjs gaps <measure.json>');
    process.exitCode = command ? 1 : 0;
  }
}
