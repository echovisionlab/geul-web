# geul-web

The Geul web application, maintained in a private Next.js source repository.

## Development

Requirements: Node.js `24.21.0` and pnpm `12.9.1`.

The committed `.npmrc` routes `@echovisionlab` to private GitHub Packages and uses
`//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`. Export `NODE_AUTH_TOKEN`
with a GitHub personal access token (classic) that has `read:packages`, access to
the private packages, and `repo` for private sibling repositories (authorize org
SSO if required). Keep the token in your shell or secret manager, never in the
repository or `.env` (pnpm does not load `.env` for authentication). The same auth
line can be used in `~/.npmrc` for other checkouts.

`@echovisionlab/ionian` and `@echovisionlab/audio-transcoder` remain on public
npmjs through explicit, versioned tarball dependencies in `package.json` and the
lockfile. They do not need republishing to GitHub Packages. When upgrading them,

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm prepare:maplibre-worker
pnpm prepare:p5-runtime
pnpm dev
```

Run the resolver before installing or fetching dependencies. GitHub Packages
uses digest-bearing download URLs that cannot be derived from a version number.
The resolver obtains those URLs for the locked `geul-*` packages, verifies the
committed SHA-512 pins, and changes only their lockfile locations. It fails on
missing access, unpublished versions, or changed artifacts; it never changes
versions or pins. CI and Docker run it before their frozen installs too.

For Go work in sibling repositories, set
`GOPRIVATE=github.com/echovisionlab/*` and authenticate Git to GitHub using your
credential manager or SSH. This web repository has no private Go module build.

While working, check only what the working tree changed (typecheck, ESLint and
Stylelint on changed files, `i18n:check` when messages changed, Vitest for related
tests, and the Storybook test-runner for affected stories against `pnpm storybook`):

```sh
pnpm verify:changed              # all of the above; --no-storybook / --base <ref>
pnpm test:changed                # Vitest for related tests only
pnpm storybook:test:changed      # affected stories only (--dry-run lists them)
```

Run the full checks before submitting a change:

```sh
pnpm lint
pnpm lint:styles
pnpm typecheck
pnpm test
pnpm build
```

Unreleased sibling contracts (`../geul-event-contracts`, `../geul-common`,
`../geul-telemetry`) are consumed with `LOCAL_CONTRACTS=1` and the
`*:local-contracts` scripts (`typecheck`, `test`, `storybook`, `build`);
`LOCAL_CONTRACTS=1 pnpm verify:changed` uses them too. Never point a dependency at a
sibling checkout with a pnpm `link:` override.

The production image is published by the release workflow as
`registry.rawsector.com/echovisionlab/geul-web:<tag>`. Harbor requires authenticated
pulls; see [Docker image builds and pulls](docs/deployment/docker-image-build.md).

## Private packages

`@echovisionlab` packages are installed from GitHub Packages (see `.npmrc`).
Locally, export `NODE_AUTH_TOKEN` with a classic PAT that has `read:packages`
(and `repo` for the private geul repositories). CI reads the repository secret
`PRIVATE_DEPS_TOKEN` as `NODE_AUTH_TOKEN`; Docker builds receive it only as a
BuildKit secret.

This standalone repository uses Geul-namespaced browser, storage, runtime, and
wire identifiers. Deployments provide their public and service URLs through the
environment contract; no compatibility aliases are supported.

## Translations

`messages/en.json` is the source of truth for UI copy; the other locales must have exactly its
keys and ICU structure. Run `pnpm i18n:check` after changing messages, and `pnpm i18n:scopes`
after adding `useTranslations` calls to client components. See [docs/i18n.md](docs/i18n.md).

## Geul design system

Storybook is the documentation and review surface for the design system, production
Core components, reusable compositions and page fixtures. Tokens, `theme.ts` and
`components/core/**` own the adopted visual and interaction contracts.

Run `pnpm storybook` to browse **Foundations / Overview**, then the system rules,
component documentation and page documentation. Theme, locale and viewport controls
apply to the same production components used by the application.

Read the [design system](docs/design-system.md) for ownership and adopted rules,
and the [Storybook guide](docs/ui-kit.md) for documentation, previews and checks.
For a repeatable review, run `node scripts/design-system/review.mjs run compact-product`.
The [review tooling guide](docs/design-system/review-tools.md) explains plans, status,
evidence recording and the persistent local output directory.
A fixture or passing automatic check does not establish complete page or assistive
technology verification.

## Page editing durability

Switching edit locales waits for Page room changes and metadata/layout updates
to receive durable server acknowledgements. Failed saves keep the current locale
open for retry; initial Yjs synchronization alone does not establish persistence.
Local edits made during a save are flushed before leaving the room.

Before a revision or room-epoch reload destroys an admitted local document, the
editor retains a recovery snapshot for the same Page and locale. The Page offers
a JSON download containing the last bootstrap document, the local typed document
when it can be materialized, local title/summary/layout, revision metadata, and a replayable Yjs update. This
snapshot is held in browser memory: download it before browser reload or leaving.
It may include already saved edits and never overwrites canonical content
automatically. A different Page or locale cannot access the previous snapshot.

Read-only nested blocks render mutation-free canvas previews where available;
column topology controls require current structural editing authority.

Licensed under the PolyForm Noncommercial 1.0.0. Copyright 2026 Echo Vision
Lab. Author: state303 <state303@rawsector.com>.
