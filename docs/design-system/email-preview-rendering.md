# Email preview and delivery rendering

Email previews display the complete HTML returned by the Go email renderer.
The web preview does not add fonts, a body reset, direction attributes or
presentation CSS. The selected email layout and shared Go content normalizer
own the resulting markup for preview and delivery.

`Pages/Admin/Email Editors` and `Pages/Editors/Campaign` use local canonical
rooms, layout HTML and sample variables. Their adapter sends
`controller.getLocalizedDocumentSnapshot()` as protobuf JSON to
`POST /__fixtures/email-preview`. Storybook development middleware and the static
review server pass the request to the Go `cmd/email-preview-fixture` executable.
That helper calls `email.RenderDraftEmail`; its body, layout and variable pipeline
uses the same `RenderEmailHTML` boundary as delivery. It needs no database,
SMTP or running API service and sends no message.

## Pinned renderer and local review

CI pins the helper source to API commit
`7155b62b9be580753f2187ec85fb2b8eed9dcd94`. The workflow requires an immutable
40-character SHA, verifies the renderer checkout's HEAD, and records the revision
in `api-revision.txt` beside the Storybook build. It builds Linux/amd64 for browser
jobs and Darwin/arm64 for local review from that same source using the API's
`go.mod` toolchain, with `CGO_ENABLED=0`. Updating the renderer pin requires
reviewing the shared rendering contract and rerunning parity checks.

Set `EMAIL_PREVIEW_FIXTURE_BINARY` to the absolute executable path before
`pnpm storybook` or `pnpm storybook:preview`. A downloaded helper needs its
executable bit restored (`chmod +x <path>`). Browser jobs reuse the built Linux
helper; local Mac review can use the artifact's Darwin/arm64 helper without a
Go build. The fixture route is part of these review servers. A missing or
unavailable executable produces a preview error; there is no local TypeScript
rendering fallback.

The pin establishes which production rendering code the fixture runs. It does
not establish that this revision has been deployed or that a live mail client
has displayed the output. Release and deployment remain on hold at the user's
request; the fixture and CI artifact do not send mail or publish an image.

## Request and process lifetime

The adapter accepts one JSON object with `locale`, `subject`, optional `document`
(protobuf JSON), optional `contentHtml`, optional `layoutHtml` and optional
string-valued `variables`. Use `document` for canonical template/campaign content
or `contentHtml` for layout sample content; the helper rejects both together.
Its response is `{ subject, html, text }`.

Request bodies and process output are bounded at 32 MiB. Each request has a
ten-second deadline including queue time, and client disconnect/replacement
cancels its child process. A bounded queue limits simultaneous renderer children
while queued bodies remain under stream backpressure. The default concurrency
is two; the isolated browser adapter passes its resolved worker limit. Renderer
stderr and process environment are not returned to the browser.

## Quote ownership and parity evidence

The shared Go `NormalizeEmailContentHTML` applies email-safe inline defaults to
rich-text `blockquote` elements: a 2px left border, 12px left inset, muted text
and 1.7 line height. Existing author styles follow those defaults and can override
them. Normalization applies to rich-text content before the raw layout wraps it;
layout source formatting, CSS and preformatted content keep their own meaning.
The same boundary also normalizes authored line breaks for delivery and preview.
The browser adds no quote-only CSS to make a preview look different from mail.

`TemplateRichFormatting` has the `email-rendering` browser-test tag. Its play
asserts a nonzero rendered quote border, heading/list/hard-break markup, exact
Go-response/iframe `srcdoc` equality for the same fixture input, and a preview
refresh after typing. These assertions cover the review server and iframe at
the pinned renderer revision; they are not an SMTP delivery or mail-client test.

The supplied screenshot identified the missing preview quote rule and was
inspected before implementation. The current snapshot's CI browser evidence and
implementation/production visual review are still to be recorded. Source
inspection and written assertions alone do not establish that those checks passed.
