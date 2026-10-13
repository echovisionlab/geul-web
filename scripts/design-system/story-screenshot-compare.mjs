import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

// Screenshot the same Storybook stories and interaction states on two running Storybook servers
// (for example a baseline snapshot and the working tree) and report per-case pixel differences.
// Evidence for behaviour-preserving refactors; it does not replace looking at the images.
//
//   node scripts/design-system/story-screenshot-compare.mjs --plan <plan.json> --out <dir> \
//        --before http://127.0.0.1:6132 [--after http://127.0.0.1:6131]
//
// Plan: [{ "name": "public-desktop-light", "story": "pages-application-frames--public",
//          "viewport": [1440, 900], "globals": "theme:dark", "selector": "#app-shell",
//          "actions": [{ "hover": "button[aria-label=Search]" }, { "wait": 800 }, { "click": "..." },
//                      { "press": "Escape" }] }]
// Optional entry fields: "media": "print" emulates print media for the screenshot, and
// "pdf": { "format": "A4" } additionally writes <out>/<name>.<label>.pdf through Chromium's paged
// print path (real pagination, @page margins, break rules). "label" overrides the before/after file
// suffix when capturing one server across phases (--label after-fix).
// "touch": true emulates a touch screen (coarse pointer, touch events); "reducedMotion": "no-preference"
// keeps animations (default "reduce"). More actions: { "scroll": 1200 } (window y) or
// { "scroll": "#heading" } (into view), { "tab": 3 } (Tab presses), { "move": [x, y] } (mouse),
// { "drag": { "selector": "a[aria-expanded]", "from": 0.1, "to": 0.6, "steps": 8, "release": false,
// "pointer": "touch" | "mouse" } } (vertical drag across the element by fraction of its height; touch uses
// real touch points). "measure": { "title": "h1", "body": ".prose" } records the bounding boxes of the
// first match per selector after the actions into summary.json (geometry evidence, not a visual check).
// Writes <out>/<name>.<before|after>.png and <out>/summary.json. Without --after it only captures.

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
if (args.includes('--help') || !option('--plan') || !option('--out') || !option('--before')) {
  console.log(
    'Usage: story-screenshot-compare.mjs --plan <plan.json> --out <dir> --before <url> [--after <url>] [--label <name>]',
  );
  process.exit(args.includes('--help') ? 0 : 1);
}
const plan = JSON.parse(readFileSync(resolve(option('--plan')), 'utf8'));
const out = resolve(option('--out'));
const servers = { before: option('--before'), after: option('--after') };
const beforeLabel = option('--label') ?? 'before';
mkdirSync(out, { recursive: true });

async function capture(browser, base, entry, file) {
  const [width, height] = entry.viewport ?? [1440, 900];
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: entry.reducedMotion ?? 'reduce',
    hasTouch: Boolean(entry.touch),
    isMobile: Boolean(entry.touch),
  });
  const globals = entry.globals ? `&globals=${encodeURIComponent(entry.globals)}` : '';
  if (entry.media) await page.emulateMedia({ media: entry.media });
  await page.goto(`${base}/iframe.html?id=${entry.story}&viewMode=story${globals}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#storybook-root > *', { timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(300);
  for (const action of entry.actions ?? []) {
    if (action.hover) {
      // Enter from outside with intermediate moves so hover handlers see a real pointer entry.
      const box = await page.locator(action.hover).first().boundingBox();
      await page.mouse.move(1, Math.max(1, box.y - 40));
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    }
    if (action.focus) await page.focus(action.focus);
    if (action.scroll !== undefined) {
      await page.evaluate((target) => {
        if (typeof target === 'number') window.scrollTo({ top: target, behavior: 'instant' });
        else document.querySelector(target)?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }, action.scroll);
    }
    if (action.tab) {
      for (let index = 0; index < action.tab; index += 1) await page.keyboard.press('Tab');
    }
    if (action.move) await page.mouse.move(action.move[0], action.move[1], { steps: 4 });
    if (action.drag) await drag(page, action.drag);
    if (action.click) await page.click(action.click);
    if (action.press) await page.keyboard.press(action.press);
    if (action.wait) await page.waitForTimeout(action.wait);
  }
  await page.waitForTimeout(entry.settle ?? 400);
  const measured = entry.measure ? await measure(page, entry.measure) : null;
  const buffer = await page.screenshot({ path: file, fullPage: entry.fullPage ?? false });
  if (entry.pdf) {
    await page.pdf({
      path: file.replace(/\.png$/u, '.pdf'),
      printBackground: true,
      preferCSSPageSize: true,
      ...entry.pdf,
    });
  }
  await page.close();
  return { buffer, measured };
}

/** Vertical drag across an element; touch drags dispatch real touch points (pointerType "touch"). */
async function drag(page, { selector, from = 0.1, to = 0.9, steps = 8, release = true, pointer = 'mouse' }) {
  const box = await page.locator(selector).first().boundingBox();
  const x = box.x + box.width / 2;
  const y = (fraction) => box.y + box.height * fraction;
  if (pointer === 'touch') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, at) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: at }] });
    await touch('touchStart', y(from));
    for (let step = 1; step <= steps; step += 1) await touch('touchMove', y(from + ((to - from) * step) / steps));
    if (release) await touch('touchEnd');
    return;
  }
  await page.mouse.move(x, y(from));
  await page.mouse.down();
  await page.mouse.move(x, y(to), { steps });
  if (release) await page.mouse.up();
}

async function measure(page, selectors) {
  return page.evaluate((entries) => {
    const result = {};
    for (const [key, selector] of Object.entries(entries)) {
      const element = document.querySelector(selector);
      const box = element?.getBoundingClientRect();
      result[key] = box
        ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
        : null;
    }
    result.viewport = { width: window.innerWidth, height: window.innerHeight, scrollY: window.scrollY };
    return result;
  }, selectors);
}

/** Counts differing pixels in a browser canvas (no image-diff dependency). */
async function diff(browser, left, right) {
  const page = await browser.newPage();
  const result = await page.evaluate(
    async ([a, b]) => {
      const load = (data) =>
        new Promise((done) => {
          const image = new Image();
          image.onload = () => done(image);
          image.src = `data:image/png;base64,${data}`;
        });
      const [first, second] = await Promise.all([load(a), load(b)]);
      if (first.width !== second.width || first.height !== second.height) {
        return { sameSize: false, differentPixels: null, ratio: 1 };
      }
      const read = (image) => {
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const x = read(first);
      const y = read(second);
      let different = 0;
      for (let index = 0; index < x.length; index += 4) {
        if (x[index] !== y[index] || x[index + 1] !== y[index + 1] || x[index + 2] !== y[index + 2]) different += 1;
      }
      return { sameSize: true, differentPixels: different, ratio: different / (x.length / 4) };
    },
    [left.toString('base64'), right.toString('base64')],
  );
  await page.close();
  return result;
}

const browser = await chromium.launch();
const summary = [];
try {
  for (const entry of plan) {
    const before = await capture(browser, servers.before, entry, join(out, `${entry.name}.${beforeLabel}.png`));
    const row = { name: entry.name, story: entry.story, viewport: entry.viewport, globals: entry.globals ?? null };
    if (before.measured) row.measured = before.measured;
    if (servers.after) {
      const after = await capture(browser, servers.after, entry, join(out, `${entry.name}.after.png`));
      if (after.measured) row.measuredAfter = after.measured;
      Object.assign(row, await diff(browser, before.buffer, after.buffer));
    }
    summary.push(row);
    console.log(
      `${entry.name.padEnd(44)} ${row.differentPixels == null ? (servers.after ? 'size differs' : 'captured') : `${row.differentPixels} px differ (${(row.ratio * 100).toFixed(3)}%)`}`,
    );
  }
} finally {
  await browser.close();
}
writeFileSync(join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
