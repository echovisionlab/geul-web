# Test projects

`pnpm test` runs every Vitest project. CI runs the same complete collection as
independent project jobs, with two shards for components. Every applicable job
still gates `Validate`; project selection is not a changed-file-only CI shortcut.

| Project              | Boundary                                                                  | Command                |
| -------------------- | ------------------------------------------------------------------------- | ---------------------- |
| `node-unit`          | Node logic, policies, codecs, and mocked transports; no DOM or Next setup | `pnpm test:unit`       |
| `component`          | DOM components, SSR output, and offline preview controllers               | `pnpm test:components` |
| `server-contract`    | Route/request contracts with Next request semantics and mocked services   | `pnpm test:server`     |
| `editor-integration` | Tiptap DOM profiles, commands, and collaborative editor wiring            | `pnpm test:editor`     |

These boundaries describe the runtime fixture, not a claim that every Node test
replaces all collaborators. For example, a codec can use real in-memory Yjs data
without a service process. CRDT convergence, keyboard commands, profile guards,
and live structure locks retain their real editor integration tests.

`scripts/test/vitest-projects.ts` discovers the existing `.test.ts` and `.test.tsx`
files once when Vitest starts and assigns each to one project. Existing
`@vitest-environment` directives remain authoritative: SSR stays in Node and DOM
tests keep jsdom. Tiptap jsdom tests and editor `*.integration.test.*` files enter
the editor project; other DOM/SSR tests enter the component project. Remaining
app routes enter the server project; other logic enters Node. A leading
`// @geul-test-tier <project>` comment can state a boundary that the defaults
cannot infer. Restart watch mode after adding a new test file.

The project-discovery regression compares the complete Git test inventory
(the existing 1,106 files plus new tests) against project membership and rejects
missing or duplicate files. It also covers hidden Storybook files, literal Next
route names containing brackets and parentheses, and generated-output exclusions.
Existing test paths remain stable so targeted commands and documentation links
keep working. This inventory contract requires a Git checkout.

Node logic loads only a small transport fixture. Unmocked `fetch` rejects before
network access, and `vi.stubGlobal` replacements are restored after each case.
DOM and Next fixtures are not imported into that project. All projects use fixed
test-only runtime URLs from `test/runtime-env.ts`; shell variables cannot select
a running service stack. Stubbed environment variables restore between cases.
Forks, file parallelism, and Vitest file isolation remain enabled.

Keep per-test `vi.stubGlobal` fixtures in `beforeEach` with corresponding cleanup;
avoid fixtures that are installed only at module load and then removed by a
later case. Unmount React before destroying awareness and Yjs documents, and
perform that cleanup even when an assertion fails. Wait for observable state,
rather than assuming a request finishes after a fixed number of milliseconds.

Email variable/link normalization now has Node tests in `email-preview.test.ts`.
Policy validation and HTML serialization, including heading placement, unsafe
links/colors, callouts, and hard breaks, run in `policy-document.test.ts` without
mounting an editor. The profile suites retain the end-to-end in-memory wiring,
variable insertion, slash menus, keyboard handling, and rejected transactions;
the corresponding standalone policy/normalization cases are no longer repeated
inside those mounted suites.

Policy profile contracts retain editor disposal and replacement-controller
recovery. Media runtime contracts use deferred responses to cover stale ready
success/failure, resync completion after a newer event, and disabled subscriptions.
RPC target and response-header policies run in Node; route contracts retain
cookies, fallback transport, and response behavior with the Next adapter.

For a focused check across the new boundaries:

```sh
pnpm exec vitest run scripts/test/vitest-projects.test.ts test/node-isolation.test.ts features/editor/tiptap/profiles/email-preview.test.ts features/editor/tiptap/profiles/policy-document.test.ts features/editor/tiptap/profiles/EmailTiptapEditor.test.tsx features/editor/tiptap/profiles/PolicyTiptapEditor.test.tsx lib/auth.test.ts lib/api/server-client.test.ts lib/api/rpc-proxy.test.ts lib/media/use-media-processing-runtime-state.test.tsx lib/session-data.test.ts features/auth/hydra-mcp-oauth.test.ts 'app/api/rpc/[...path]/route.test.ts' stories/pages/TranslationAdmin.test.tsx
```

Use CI's per-project durations to measure any speed change. Vitest's phase
percentages can include parallel or overlapping work; they are not an additive
breakdown of elapsed wall time. Project separation does not measure or eliminate
the separate Next/Storybook build and browser-smoke costs.
