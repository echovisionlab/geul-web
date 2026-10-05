# HWP editor runtime

The DSUB HWP editor serves its RHWP Studio runtime from
`/vendors/rhwp/0.8.6-dsub.2/`. The editor opens local HWP/HWPX files in the
browser. The embedded runtime is a DSUB build of RHWP Studio; the upstream
GitHub demo is not loaded. The DSUB embed uses `?scroll=page`: its iframe grows
to the document height, so the site page supplies the vertical scroll and the
footer follows the document. Short documents retain a minimum editor height. The reusable editor integration
lives in `features/hwp-editor`; the tool page composes its title and description
around it. Loading uses the configured site `PageLoader`.

## Local development

Install the application dependencies, then run `pnpm prepare:hwp-runtime`
before starting `pnpm dev`. Preparation downloads the pinned release archive
listed in `scripts/hwp-runtime.json`, checks its SHA256, and copies the runtime
into `public/vendors/rhwp/0.8.6-dsub.2/`. A prepared runtime is reused on later
runs, so the download is only needed for initial setup or repair.

The generated assets and preparation work directories are ignored by Git.
Preparation removes its own temporary files after success or failure. Failed
downloads, checksum mismatches, and incomplete archives leave existing public
assets in place. No runtime environment variable is required.

## Build and updates

CI and the Docker builder prepare the runtime before the application build.
The final Docker image includes the generated public assets. Network access to
the pinned GitHub release is needed during preparation, not while using the
editor.

For a runtime update, build and publish a reviewed archive on the DSUB RHWP
fork. Update the descriptor's release URL, SHA256, source commit, build ID, and
base path together with the preparation script and editor URL. Keep `LICENSE`,
`THIRD_PARTY_LICENSES.md`, `CanvasKit-LICENSE`, and `runtime-manifest.json` in the archive. Do not commit
runtime bundles, fonts, or WASM binaries to the application repository.

## Manual validation

- Open `/tools/hwp` from the DSUB shell and confirm the shell header remains visible.
- Open a long document and confirm the site page scrolls through the full document with the footer at its end.
- Open a shorter document afterward and confirm the iframe shrinks, retaining the minimum editor area.
- Confirm runtime JS, WASM, and font requests use the DSUB origin and the pinned vendor path.
- Open representative HWP and HWPX files; inspect Korean text, layout, tables, and images.
- Edit text, save or download through the editor, and reopen the downloaded document.
- Exercise the editor's PDF export where offered and inspect the resulting document.
- Open a malformed or unsupported file and confirm the editor reports its failure.

Document rendering fidelity and exported-file compatibility require real sample
files and browser checks; asset preparation tests establish archive integrity
and public asset readiness only.
