# geul-web

The Geul web application, published as a standalone Next.js source repository.

## Development

Requirements: Node.js `24.19.0` and pnpm `11.22.0`.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm prepare:maplibre-worker
pnpm prepare:p5-runtime
pnpm dev
```

Run the focused checks before submitting a change:

```sh
pnpm lint
pnpm lint:styles
pnpm typecheck
pnpm test
pnpm build
```

The production image is published by the release workflow as
`registry.dsub.io/echovisionlab/geul-web:<tag>`.

This standalone repository uses Geul-namespaced browser, storage, runtime, and
wire identifiers. Deployments provide their public and service URLs through the
environment contract; no compatibility aliases are supported.

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
Lab. Author: state303 <state303@dsub.io>.
