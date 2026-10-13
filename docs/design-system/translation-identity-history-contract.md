# Translation, site identity, avatar and legal history presentation

This contract records the adopted presentation changes and their source boundaries.
It does not establish complete browser, server or assistive technology verification.

## Translation languages and state

[TranslationLocaleRow](../../features/translation/TranslationLocaleRow.tsx) displays the language name once.
The locale code remains its data/selection identity and is not repeated as a visual EN/JA-style label.
[Panel locale options](../../features/translation/useTranslationPanelLabels.ts) also use names.
The shared [option formatter](../../features/translation/locale-option-format.ts) removes only a matching trailing code suffix;
meaningful qualifiers such as `Português (Brasil)` remain. Submitted locale values do not change.
Source options retain their translated source-language indication.
The shared [TranslationLocaleControl](../../features/translation/TranslationLocaleControl.tsx) also uses the language
name in menu triggers, including compact Page and Post editor headers. Compact density changes control geometry,
not the language's identity. The trigger shows `한국어`, `English`, `日本語` or the supplied language name;
matching code suffixes are removed, while regional qualifiers remain. Menu source options and the trigger's
accessible name retain their source-language context. Locale values and change callbacks remain unchanged.
[ContentLanguageMenu](../../features/translation/ContentLanguageMenu.tsx) applies the same name convention to public
content, using the native names from the supported locale registry. The current displayed language remains selected
even when the requested language falls back to the source.

[EntityTranslationsPanel](../../features/translation/EntityTranslationsPanel.tsx) no longer repeats Existing/Missing badges.
Missing targets retain their explanatory text. Updated-at context remains when available.
Queued/running summaries, actual job badges, cancellation, generation/regeneration, create/edit/preview/delete,
permissions, errors, notifications and save-before-mutation behavior remain intact.
The source-language field is the primary source indicator; there is no duplicated source row.
Collapsed/expanded behavior and live status relationships remain owned by the existing disclosure/row contracts.

Review [LocaleRows stories](../../features/translation/TranslationLocaleRow.stories.tsx) in Collapsed, Expanded,
ReadOnly and Active states, and the existing actual EntityTranslationsPanel fixtures.
The local row fixture does not submit a generation job; production mutation tests use mocked services.

## Site logo and title fallback

[SiteLogo](../../features/site/SiteLogo/SiteLogo.tsx) uses the configured theme asset as before.
[SiteLogoView](../../features/site/ui/SiteLogo/SiteLogoView.tsx) renders the site title when no asset exists or an asset fails.
If identity is absent, it displays `LOGO` rather than returning an empty slot or using the image's descriptive alt as identity.
A changed asset URL can render a new image after a failed source.

The optional `size` API is closed to existing Core Typography xs/sm/md/lg/xl roles, default md.
Fallback text uses that named role with medium weight; it does not introduce a separate font scale.
Without an explicit asset height, the image uses the corresponding existing font-size token.
Legacy numeric `height` and image `style` remain authored asset geometry; they do not override fallback typography.
The controller supplies configured site identity explicitly; direct View fixtures can use `fallbackText` or their identity alt.

Review Default, Missing, MissingXL, Unconfigured and UnavailableAsset in the
[SiteLogo stories](../../features/site/ui/SiteLogo/SiteLogoView.stories.tsx).
Image alt, theme-asset selection and CDN resolution retain their existing responsibilities.

## Avatar removal

[ProfileAvatarControl](../../features/user/ui/ProfileAvatarControl/ProfileAvatarControl.tsx) keeps removal as an actual Core IconButton.
Its existing compact density context selects the 28px fine-pointer target; the common coarse-pointer minimum remains 44px.
The glyph remains the original 16px Core icon frame, with no path cropping or new icon scale.

The approved avatar-specific treatment uses danger/strong, providing a red default fill from existing action roles.
[ImageUploadField](../../components/core/ImageUpload/ImageUploadField.tsx) exposes only `removeButtonEmphasis="medium"|"strong"`.
Its default remains medium, with existing danger tone and xs geometry for ordinary consumers.
The avatar consumes strong inside its compact context. The crop dialog is outside that context.
No public tone override, raw color, numeric action size or new token was added.

Removal names, pending/disabled restrictions, upload validation, crop cancellation/save, controller persistence,
notifications and session updates remain intact. Check Empty and WithImage in the
[avatar stories](../../features/user/ui/ProfileAvatarControl/ProfileAvatarControl.stories.tsx).

## Legal history status

[LegalPolicyHistoryClient](../../features/policy/LegalPolicyHistoryClient.tsx) renders Current/Archived using sm Core Text.
These are plain status labels without a colored badge surface.
Version links, language query parameters, effective dates, table headers, server snapshots, loading and error behavior remain unchanged.
This presentation change does not alter legal content or policy lifecycle status.

Review [Legal History](../../stories/pages/LegalHistory.stories.tsx) for privacy/terms and archived/current rows.
History-detail rendering and server persistence are separate contracts.

## Verification scope

Relevant regressions check compact header/native and regional language names, source-aware accessible names,
displayed-language fallback selection, preserved missing/job actions and mutations,
site-title/LOGO/asset-error fallback, named-size types, ordinary upload defaults, avatar removal and legal table relationships.
Record browser theme, locale, viewport, pointer, focus and actual observed geometry separately.
Story existence, a prop marker or a DOM test does not prove all viewport layouts or assistive technology behavior.
