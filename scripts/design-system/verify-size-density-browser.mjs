// Run against a built Storybook served by serve-kit.mjs.
// Optional arguments: Playwright module file, preview base URL.
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : 'playwright');
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:6030';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out =
  process.env.DENSITY_ARTIFACT_DIR ??
  fileURLToPath(new URL('../../.artifacts/design-system/size-density/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const width of [320, 390, 767, 768, 769, 1280])
    for (const touch of [false, true]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => {
        errors.push(e.message);
        console.log('PAGE_ERROR', e.message);
      });
      const locale = width === 320 ? 'de' : width === 390 ? 'ar' : 'ko';
      const theme = touch ? 'dark' : 'light';
      await page.goto(
        `${baseUrl}/iframe.html?id=composition-size-and-density--shared-owners&viewMode=story&globals=theme:${theme};locale:${locale}`,
      );
      await page.locator('[data-density-preview]').waitFor({ timeout: 60000 });
      if (touch) {
        await page.waitForFunction(
          () => document.querySelectorAll('[role=toolbar] button[data-control-kind=button][aria-label]').length === 2,
        );
      }
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const rect = (e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        const buttons = [...document.querySelectorAll('[data-density-row] button')].map(rect);
        const tools = [...document.querySelectorAll('[role=toolbar] button')].map(rect);
        const target = [...document.querySelectorAll('[data-density-preview] button')].map(rect).filter((r) => r.w > 0);
        return {
          viewport: innerWidth,
          overflow: document.documentElement.scrollWidth,
          buttons,
          tools,
          target,
          coarse: matchMedia('(any-pointer:coarse)').matches,
          font: getComputedStyle(document.querySelector('[data-density-preview] input')).fontSize,
        };
      });
      assert.equal(m.overflow, m.viewport, JSON.stringify(m));
      assert(
        m.buttons.every((r) => r.h === (touch ? 44 : 36)),
        JSON.stringify({ width, touch, ...m }),
      );
      assert(m.tools.every((r) => r.h >= (touch ? 44 : 28)));
      if (touch) assert(m.target.every((r) => r.h >= 44));
      for (let i = 0; i < m.tools.length; i++)
        for (let j = i + 1; j < m.tools.length; j++) {
          const a = m.tools[i],
            b = m.tools[j];
          assert(
            !(a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5),
            'Overlapping toolbar targets',
          );
        }
      await page.locator('[data-menu-trigger]').click();
      const menu = page.locator('[role=menu]');
      await menu.waitFor();
      const rows = await menu
        .locator('[role=menuitem]')
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().height));
      assert(rows.every((h) => h >= (touch ? 44 : 26)));
      await page.keyboard.press('Escape');
      await page.locator('[data-density-row] button').first().focus();
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth);
      assert.notEqual(focus, '0px');
      if (width === 320 || width === 390)
        await page.screenshot({
          path: `${out}/${width}-${touch ? 'touch' : 'fine'}-${locale}-${theme}.png`,
          fullPage: true,
        });
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`PASS ${width} ${touch ? 'touch' : 'fine'}`);
      results.push({ width, touch, locale, theme, ...m, menuRows: rows, focus });
      await context.close();
    }
  for (const readOnly of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('PAGE_ERROR', e.message);
    });
    await page.goto(
      `${baseUrl}/iframe.html?id=feature-editor-compactframe--${readOnly ? 'read-only' : 'editable'}&viewMode=story&globals=theme:light;locale:ko`,
    );
    await page.locator('[data-testid=compact-tiptap-editor-content]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    const editor = page.locator('[data-testid=compact-tiptap-editor-content]');
    assert.equal(await editor.getAttribute('contenteditable'), String(!readOnly));
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth,
      viewport: innerWidth,
      handles: [...document.querySelectorAll('[data-geul-reorder-gutter] button')].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, w: r.width, h: r.height };
      }),
    }));
    assert.equal(m.overflow, m.viewport);
    if (!readOnly) {
      await editor.click();
      await page.keyboard.press('End');
      await page.keyboard.type(' edited');
      assert((await editor.innerText()).includes('edited'));
    } else {
      const selected = await editor.evaluate((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(range);
        return s.toString();
      });
      assert(selected.length > 0);
      assert.equal(m.handles.length, 0);
    }
    await page.screenshot({ path: `${out}/compact-${readOnly ? 'readonly' : 'editable'}-320.png`, fullPage: true });
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ readOnly, ...m });
    await context.close();
  }
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      errors.push(e.message);
      console.log('PAGE_ERROR', e.message);
    });
    await page.goto(
      `${baseUrl}/iframe.html?id=feature-editor-compact-frame--block-gutter&viewMode=story&globals=theme:dark;locale:ko`,
    );
    await page.locator('[data-testid=tiptap-editor-content]').waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    const handles = page.locator('[data-geul-reorder-gutter] button');
    await handles.first().waitFor();
    const m = await page.evaluate(() => ({
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth,
      handles: [...document.querySelectorAll('[data-geul-reorder-gutter] button')].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, w: r.width, h: r.height };
      }),
    }));
    assert.equal(m.overflow, m.viewport);
    assert(m.handles.length > 0);
    assert(m.handles.every((r) => r.x >= 0 && r.x + r.w <= m.viewport && r.w >= 44 && r.h >= 44));
    await handles.first().click();
    await page.locator('[role=menu]').waitFor();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${out}/editor-gutter-${width}.png`, fullPage: true });
    assert.equal(errors.length, 0, errors.join('\n'));
    results.push({ editorGutter: true, width, ...m });
    await context.close();
  }
  for (const kind of ['scale', 'short-height']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: kind === 'scale' ? 844 : 360 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const id = kind === 'scale' ? 'composition-size-and-density--shared-owners' : 'core-overlays-contentmodal--compact';
    await page.goto(`${baseUrl}/iframe.html?id=${id}&viewMode=story&globals=theme:light;locale:ko`);
    await page.locator(kind === 'scale' ? '[data-density-preview]' : '[role=dialog]').waitFor();
    if (kind === 'scale') {
      await page.waitForFunction(
        () => document.querySelectorAll('[role=toolbar] button[data-control-kind=button][aria-label]').length === 2,
      );
      await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
    }
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => ({
      viewport: innerWidth,
      overflow: document.documentElement.scrollWidth,
      height: innerHeight,
    }));
    assert.equal(m.overflow, m.viewport);
    if (kind === 'scale') {
      const labels = await page
        .locator('[role=toolbar] button[data-control-kind=button][aria-label]')
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const label = Array.from(button.querySelectorAll('span')).find(
              (span) => span.childElementCount === 0 && span.textContent === button.getAttribute('aria-label'),
            );
            return label ? label.getBoundingClientRect().width : 0;
          }),
        );
      assert.equal(labels.length, 2);
      assert(
        labels.every((width) => width > 0),
        'Touch commands retain visible labels at 200% text scale',
      );
    }
    if (kind === 'short-height') {
      const dialog = page.locator('[role=dialog]');
      const button = dialog.locator('button').last();
      await button.scrollIntoViewIfNeeded();
      const r = await button.boundingBox();
      assert(r.y >= 0 && r.y + r.height <= m.height);
      await button.click();
    }
    await page.screenshot({ path: `${out}/${kind}.png`, fullPage: true });
    results.push({ kind, ...m });
    await context.close();
  }
  await writeFile(`${out}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} browser cases`);
} finally {
  await browser.close();
}
