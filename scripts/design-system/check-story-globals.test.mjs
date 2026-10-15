import assert from 'node:assert/strict';
import test from 'node:test';
import { scanStorySource } from './check-story-globals.mjs';

test('rejects theme and locale story globals including aliases and spreads', () => {
  const source = `const locked = {locale: 'ko'}; const mode = { theme: 'dark' }; export const Example = {globals: {...locked, ...mode}};`;
  assert.equal(scanStorySource(source).length, 2);
});
test('fails closed for uninspectable globals', () => {
  assert.equal(scanStorySource(`export const Example = {globals: makeGlobals()};`).length, 1);
});
test('rejects computed globals and cyclic spread configurations', () => {
  assert.equal(scanStorySource(`const g = { ...g }; export const Example = {globals: g};`).length, 1);
  assert.equal(scanStorySource(`export const Example = {globals: {['theme']: 'dark'}};`).length, 1);
});
test('rejects invalid story syntax instead of silently passing', () => {
  assert.ok(scanStorySource(`export const Example = {globals: `).length > 0);
});
test('rejects literal JSX locale spread props and implicit provider defaults', () => {
  assert.equal(
    scanStorySource(
      `const props = {locale:'en'}; function Preview(){ return <MantineProvider><View {...props}/></MantineProvider>; }`,
    ).length,
    2,
  );
});
test('accepts viewport globals and global context locale', () => {
  assert.deepEqual(
    scanStorySource(
      `export const Example = {globals: {viewport: {value: 'phone'}}}; function Preview(){ const locale = useLocale(); return <View locale={locale}/>; }`,
    ),
    [],
  );
});
test('resolves locale aliases in their lexical scopes', () => {
  const source = `function Fixed(){ const locale = 'en'; return <View locale={locale}/>; } function Global(){ const locale = useLocale(); return <View locale={locale}/>; }`;
  assert.equal(scanStorySource(source).length, 1);
});
test('rejects locale args, including local string aliases', () => {
  assert.equal(
    scanStorySource(`const fixed = 'en'; const defaults = {locale: fixed}; export default {args: {...defaults}};`)
      .length,
    1,
  );
});
test('rejects string JSX locale and local aliased providers', () => {
  assert.equal(
    scanStorySource(
      `import {MantineProvider as P} from '@mantine/core'; const locale = 'ja'; function Preview(){return <P forceColorScheme="dark"><View locale={locale}/></P>}`,
    ).length,
    2,
  );
});
test('rejects local provider theme object and locale contexts', () => {
  assert.equal(
    scanStorySource(
      `function Preview(){return <MantineProvider theme={theme}><LocaleProvider locale={useLocale()}><NextIntlClientProvider locale={'ko'}/></LocaleProvider></MantineProvider>}`,
    ).length,
    3,
  );
});
test('keeps fixture translation metadata and authored locale content valid', () => {
  assert.deepEqual(
    scanStorySource(
      `const fixture = {locale: 'ko', requestedLocale:'ko', localizationInfo:{displayedLocale:'ko'}}; export const Example = {args:{document:fixture}}; function Preview(){ return <Document requestedLocale="ko" fixture={fixture}/> }`,
    ),
    [],
  );
});

test('rejects local React Aria and app design-system providers including aliases', () => {
  assert.equal(
    scanStorySource(
      `import { I18nProvider as P, RouterProvider } from 'react-aria-components'; function Preview(){ return <P locale={useLocale()}><RouterProvider navigate={noop}><DesignSystemProvider><View/></DesignSystemProvider></RouterProvider></P>; }`,
    ).length,
    3,
  );
  assert.equal(
    scanStorySource(
      `import {AppDesignSystemProvider as P} from '@/lib/providers/AppDesignSystemProvider'; function Preview(){ return <P><View/></P>; }`,
    ).length,
    1,
  );
});
