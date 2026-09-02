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

Licensed under the PolyForm Noncommercial 1.0.0. Copyright 2026 Echo Vision
Lab. Author: state303 <state303@dsub.io>.
