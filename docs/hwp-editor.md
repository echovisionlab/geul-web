# HWP editor runtime

The DSUB HWP editor uses `rust-hwp-intl@0.1.0`. Its editor API comes from
`rust-hwp-intl/editor`, and the same npm package contains the Studio runtime in
`studio.tar.gz`. DSUB serves that runtime at `/vendors/rust-hwp-intl/0.1.0/`.
Local HWP/HWPX files open in the browser.

The embed uses `?scroll=page`: its iframe grows to the document height, so the
site page supplies the vertical scroll and the footer follows the document.
Short documents retain a minimum editor height. The reusable integration lives
in `features/hwp-editor`; the tool page adds its title and description. Loading
uses the configured site `PageLoader`.

## Local development

Install the application dependencies and run `pnpm dev`. Its preparation hook
resolves `rust-hwp-intl/studio.tar.gz` from the installed package, checks the
SHA256 and source commit pinned in `scripts/hwp-runtime.json`, and copies the
runtime into `public/vendors/rust-hwp-intl/0.1.0/`. You can also run preparation
separately with `pnpm prepare:hwp-runtime`.

Preparation works offline once the npm dependencies are installed. It reuses a
complete prepared runtime and repairs missing assets from the installed
archive. The source repository is private; preparation does not need GitHub
credentials or access to a GitHub release.

Generated assets and preparation work directories are ignored by Git.
Preparation removes its temporary files after success or failure. A missing
package archive, checksum mismatch, or incomplete archive leaves existing
public assets in place. No runtime environment variable is required.

## Build and updates

CI and the Docker builder prepare the runtime before the application build.
The final Docker image includes the generated public assets, so the browser
loads runtime JS, WASM, and fonts from the DSUB origin.

For an update, publish the reviewed `rust-hwp-intl` package with its matching
Studio archive. Update the exact npm version and lockfile, then set the runtime
descriptor's archive SHA256, source commit, build ID, and base path. The source
commit must match the archive manifest's `downstreamCommit`. Update the
preparation script and editor URL to the same versioned path.

Keep `LICENSE`, `THIRD_PARTY_LICENSES.md`, `CanvasKit-LICENSE`, and
`runtime-manifest.json` in the archive. The manifest records source provenance
and hashes for the core files and runtime assets. Do not commit runtime bundles,
fonts, or WASM binaries to the application repository.

## Manual validation

- Open `/tools/hwp` from the DSUB shell and confirm the shell header remains visible.
- Open a long document and confirm the site page scrolls through the full document with the footer at its end.
- Open a shorter document afterward and confirm the iframe shrinks, retaining the minimum editor area.
- Expand and collapse the basic toolbox and confirm the site page keeps its vertical scroll position.
- Confirm runtime JS, WASM, and font requests use the DSUB origin and the pinned vendor path.
- Open representative HWP and HWPX files; inspect Korean text, layout, tables, and images.
- Edit text, save or download through the editor, and reopen the downloaded document.
- Exercise the editor's PDF export where offered and inspect the resulting document.
- Open a malformed or unsupported file and confirm the editor reports its failure.

Document rendering fidelity and exported-file compatibility require real sample
files and browser checks. Asset preparation tests establish archive integrity
and public asset readiness.
