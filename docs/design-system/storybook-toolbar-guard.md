# Storybook toolbar contract

The global decorator in `.storybook/preview.tsx` owns the selected locale, message catalog, document language/direction and `ThemeId`. Its shared `DesignSystemProvider` applies Light, Dark, Ocean Light or Ocean Dark to the document and portaled UI through the same semantic roles used by the application. Stories read language with `useLocale()` and `useTranslations()`, and theme context with `useColorScheme()`. Date/time fixtures pass the selected locale to formatting and calendar components. Presets override existing roles; they do not add component token families or persist application preferences.

`node scripts/design-system/check-story-globals.mjs` runs within `design-system:check` and `design-system:generate`. It scans every CSF story under components, features and stories, plus TypeScript/JavaScript helpers under stories and .storybook. Tests, fixture directories, generated builds and the main/manager/global preview entrypoints are excluded.

The guard rejects:

- Story `globals.locale` and `globals.theme`, including local aliases, computed string keys and object spreads. Viewport globals remain valid.
- Fixed string locale args and JSX locale props, including inspectable local aliases and spread props.
- Local provider wrappers, including `DesignSystemProvider`, `AppDesignSystemProvider`, `LegacyThemeBridge`, `I18nProvider`, `RouterProvider`, `MantineProvider`, `NextIntlClientProvider` and `LocaleProvider`. Aliased imports and implicit defaults also shadow the shared decorators.
- Invalid source syntax and uninspectable or cyclic story globals.

User-authored content, artwork, brand identities and translation metadata such as `requestedLocale` remain valid fixture data. The guard does not ban invariant imagery colors. It does not infer whether arbitrary text is an interface label, follow imported helper implementations outside stories, evaluate dynamic JavaScript expressions, or prove visual contrast. Translation and interaction tests plus browser checks complement this static invariant.

Run `node --test scripts/design-system/check-story-globals.test.mjs` for the guard regressions. Keep locale and theme selections in the toolbar; additional component states belong in args and viewport variants.

## Docs string control names

The installed Storybook Docs 10.5.8 `TextControl` did not name its textarea by the
property key. With a length limit, its wrapping label instead supplied the count;
without a limit, the accessible name was empty. Undefined values also exposed the
same “Set string” name for every property.

`patches/@storybook__addon-docs@10.5.8.patch` names the textarea with its property key
and the setter “Set string for {key}”. It retains the visible setter wording, original
IDs, callbacks, length limits, required state, read-only behavior and autofocus.
The correction changes only those two TextControl branches. pnpm's patch entry and
lockfile make it reproducible after installation. Recheck the patch when upgrading
Storybook and remove it when upstream supplies equivalent names.

`.storybook/TextControl.accessibility.test.tsx` mounts the installed public
`TextControl` and `PureArgsTable` exports. It checks distinct names, edits and setter
transitions, read-only activation, IDs and scoped axe form-label rules. The direct
accessible-name assertions matter because axe's label rule accepts the original
placeholder even when it does not identify the property.
