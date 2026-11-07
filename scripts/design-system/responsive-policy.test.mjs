import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanResponsiveOwnership as scan } from './responsive-policy.mjs';
test('CSS viewport and container thresholds must consume registered projections', () => {
  assert.equal(scan('features/example/View.css', '@media (max-width: 768px) {.x {display:none}}').length, 1);
  assert.equal(scan('components/core/Example.css', '@container list (width < 48em) {.x {display:none}}').length, 1);
  assert.deepEqual(
    scan('features/example/View.css', '@media (width < $mantine-breakpoint-sm) {.x {display:none}}'),
    [],
  );
});
test('script and image sizes cannot replicate shared thresholds', () => {
  assert.equal(scan('features/example/View.tsx', "window.matchMedia('(max-width: 768px)')").length, 1);
  assert.equal(scan('features/example/View.tsx', 'const image=<img sizes="(min-width: 62em) 50vw, 100vw"/>').length, 1);
  assert.deepEqual(scan('features/example/View.tsx', "window.matchMedia(breakpointQuery('sm'));"), []);
});
test('component geometry exceptions cannot approve another threshold or file', () => {
  assert.deepEqual(scan('features/map/ui/MapLibreMapView.css', '@media (max-width: 480px) {}'), []);
  assert.equal(scan('features/map/ui/MapLibreMapView.css', '@media (max-width: 768px) {}').length, 1);
  assert.equal(scan('features/example/View.css', '@media (max-width: 480px) {}').length, 1);
});
test('tokenized private control overrides still violate ownership', () => {
  assert.equal(scan('features/example/View.css', '.x { --_control-height:var(--geul-control-height-xs) }').length, 1);
  assert.equal(scan('features/example/View.css', '[data-control-size="compact"] { height:100% }').length, 1);
  assert.deepEqual(
    scan(
      'components/core/Control.module.css',
      '[data-control-size="compact"] { --_control-height:var(--geul-control-height-compact) }',
    ),
    [],
  );
});
test('prose, zero geometry and generated projection retain their own contracts', () => {
  assert.deepEqual(scan('features/example/View.css', '.x { width:768px; max-width:100% }'), []);
  assert.deepEqual(scan('node_modules/@echovisionlab/design-system/src/tokens.css', '@media (min-width:48em) {}'), []);
  assert.deepEqual(scan('features/example/View.stories.tsx', "window.matchMedia('(max-width:768px)')"), []);
});
