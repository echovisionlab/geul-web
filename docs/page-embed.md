# Page embed blocks

Pages can embed independently served HTTPS tools. The Page stores the URL and
selected permissions; the Web renderer has no tool-specific route or server
registry. Once this block is released, changing its URL or permissions uses the
existing Page save and collaboration flow and requires no Web configuration
change or redeployment.

## Stored settings

`embed` is a Page section and can also be placed inside a column. `title` is
localized. The URL, height and permissions belong to the shared Page structure;
translation-only editors can change the title but cannot change those settings.
A valid HTTPS URL is required before insertion at both the Page root and inside
columns; cancelling the dialog or entering an invalid URL creates no section.
Settings use the existing canonical Page/Yjs flow, including shared permission
updates and peer propagation.

| Setting                 | Default  | Meaning                                                       |
| ----------------------- | -------- | ------------------------------------------------------------- |
| `uri`                   | Required | HTTPS URL without embedded username or password               |
| `title`                 | Empty    | Accessible frame title, with a localized fallback             |
| `heightMode`            | `fixed`  | `fixed`, `auto` or `viewport`                                 |
| `height`                | 640      | Fixed or initial automatic height, 180–2160 px                |
| `allowScripts`          | true     | Run the tool's scripts                                        |
| `allowSameOrigin`       | true     | Preserve the tool's own origin for storage and authentication |
| `allowForms`            | false    | Submit forms                                                  |
| `allowDownloads`        | false    | Download files                                                |
| `allowPopups`           | false    | Open windows that inherit the frame's sandbox restrictions    |
| `allowMicrophone`       | false    | Request microphone access, subject to browser permission      |
| `allowSpeakerSelection` | false    | Request output device selection where supported               |
| `allowFullscreen`       | false    | Request full screen after user interaction                    |

All permission controls are checkboxes with individual descriptions. Invalid URL
drafts display an error without replacing the saved URL. Permissions changes
remount the frame so the new sandbox applies to a fresh document.

The renderer always supplies a sandbox and explicitly denies camera,
geolocation, screen capture and automatic media playback. Device and full-screen
grants are limited to the frame's `src` origin. It never grants top-level
navigation or popup sandbox escape. Scripts plus origin preservation are rejected
when the tool has the same origin as Web, because that combination could let the
frame remove its sandbox. See [the iframe reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).

## Tool server boundary

The four tools now live in `geul-tools`, with one Vite/React app, Node process,
container image and independent HTTPS origin per tool. They share the Web theme,
20 locales, client bootstrap, dependency versions and static HTTP implementation.

| Page URL               | Tool origin                           |
| ---------------------- | ------------------------------------- |
| `/tools/transcode`     | `https://tools-transcode.dsub.io`     |
| `/tools/youtube-audio` | `https://tools-youtube-audio.dsub.io` |
| `/tools/hwp`           | `https://tools-hwp.dsub.io`           |
| `/tools/portadj`       | `https://tools-portadj.dsub.io`       |

These Web URLs are available to CMS Pages containing generic Embed blocks; the
four tool-specific Web routes and bundled implementations have been removed.
The p5 runner remains app-owned at `/tools/p5-runner`. Publishing the CMS Pages
and switching production traffic remain explicit rollout operations.

Transcode, HWP and PortaDJ process files in the browser. YouTube Audio also has a
server extension for authenticated URL resolution and audio range delivery. It does not
import Web's router, editor or layout. Authentication and API authorization remain
the tool server's responsibility; an iframe permission does not grant a Web
session. Browser restrictions on third-party cookies and storage still apply.

The tool's HTML response must permit the intended parent with an HTTP header,
for example:

```http
Content-Security-Policy: frame-ancestors 'self' https://www.dsub.io
```

Use the actual parent origin, including the scheme and port. Include other site
origins only when they really serve the parent Page. Nested tool frames must
allow every ancestor, which is why `'self'` is useful when a tool embeds its own
document. `frame-ancestors` must be an HTTP response header; a meta tag does not
enforce it. See [the directive reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

Remove conflicting `X-Frame-Options: DENY` or `SAMEORIGIN` rules from the tool's
embedding response, including rules added by its reverse proxy. CORS is not
needed just to display an iframe.

YouTube Audio deliberately sends credentialed requests from its tool origin to
`https://www.dsub.io/api/tools/youtube-audio`. The WWW Ingress routes that prefix
directly to the YouTube Node server. The browser's existing host-only WWW session
cookie is validated on every request through Oathkeeper's authenticated
`MemberService/GetCurrentSession` RPC. Only an active, onboarded member is
authorized. The tool receives no shared signing key or broader cookie domain.

The common server accepts exact configured tool and parent origins for this API,
returns credentialed CORS headers, and exposes the range/download response
headers needed by the audio client. Disallowed origins are rejected before
authentication; matching preflight requests do not authenticate. The tool's
public `/runtime-config.js` supplies its ID, allowed parent origins, font CDN
and `PUBLIC_API_ORIGIN`; it contains no secrets.

Web currently has no global `frame-src` or `Permissions-Policy` response header
that blocks these frame grants. The block uses its saved URL and permissions at
render time. If a parent policy is introduced later, it must permit the intended
frame origins and capabilities; an iframe cannot override a parent denial. A
tool list in Next's `headers()` configuration is unnecessary here. See
[Next.js response headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).

## Optional tool messages

For automatic height, the tool reports its content height to the exact parent
origin. Web accepts only messages from this frame's window and exact URL origin,
then rounds a finite positive height up with a 180 px minimum and no maximum.
With origin preservation disabled, the sandbox uses an opaque origin, so automatic
height and initialization are unavailable; use a fixed or viewport height.

```js
const siteOrigin = 'https://www.dsub.io';
const content = document.querySelector('main');

new ResizeObserver(() => {
  parent.postMessage(
    { type: 'geul:embed:resize', height: Math.ceil(content.getBoundingClientRect().height) },
    siteOrigin,
  );
}).observe(content);

window.addEventListener('message', (event) => {
  if (event.source !== parent || event.origin !== siteOrigin) return;
  if (event.data?.type === 'geul:embed:init') {
    // Apply the supplied locale and colorScheme in the tool's own UI.
  }
});
// Announce readiness after registering the initialization listener.
parent.postMessage({ type: 'geul:embed:ready' }, siteOrigin);
```

Web sends `{ type: 'geul:embed:init', locale, colorScheme }` after load, when
locale or theme changes, and when the current frame sends `geul:embed:ready`
from its exact URL origin. Tools send readiness once after registering their
initialization listener, to each exact allowed parent origin, without `*`.
Readiness works in every height mode; resize messages affect only automatic height.
A tool may ignore these messages. It must validate both
the sender window and origin before handling them. See
[postMessage security guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage).

## Page audience settings

Page audience controls apply to the whole Page and its protected document/media
reads. They are separate from iframe capabilities and the YouTube API's member
authorization. Existing Pages with an empty policy remain public.

- With Member unchecked and no conditions selected, the Page is public.
- Member alone requires an active authenticated account. Checking it clears
  narrower conditions; unchecking it resets the audience to public.
- Selecting Author, Admin, subscriber status or user tags switches to conditions
  mode and also requires authentication. Removing the last condition returns to
  authenticated access.
- Any selected role matches the role group; any selected tag matches the tag
  group. When multiple groups are enabled, the Any/All selector combines those
  groups. Page managers retain access to content they administer.

Audience edits remain a draft until saved; discard restores the saved policy.
An inaccessible Page does not expose its document or protected media to an
unauthorized viewer.

## Release and rollout gates

1. Release `geul-event-contracts` with the canonical Embed and Page audience
   messages/catalog, then release `geul-common` against that Contracts version.
   Update the published dependency pins and rebuild API, editor Collab and Web
   against compatible releases. Local workspace validation does not replace
   publishing these dependencies.
2. Apply the forward-only `page-access-policy-v1` SQL operation before the API
   reads `page.access_policy`. It adds the non-null JSONB object column and
   constraint, preserving the public empty-policy default. Apply
   `tools-page-routes-v1` before assigning CMS Pages to tool URLs: it relaxes
   `chk_page_slug_route_namespace` for generic tools descendants while retaining
   the `/tools/p5-runner` reservation. Flux `application-runtime` depends on both
   operations becoming Ready. These database/schema gates are required even
   though adding the Embed section itself needs no content-row migration.
3. Release the four `geul-tools` images, configure their HTTPS origins and
   framing policy, and route the WWW YouTube API prefix to its Node server with
   the existing Oathkeeper/session-cookie configuration. Activate reviewed
   immutable image digests through GitOps. Verify each tool and authenticated
   resolve/range/download behavior at the browser boundary before publishing
   its CMS Page.
4. Deploy compatible API, Collab and Web consumers together. The changed block
   catalog fingerprint requires older connected editor rooms to reload or
   bootstrap against the new catalog. Create/publish the four Pages with the
   corresponding tool origins, saved height/permissions and intended audience.

The Embed renderer remains generic: future tool URL and permission changes use
the saved Page configuration without adding a Web tool registry or rebuilding
Web. Rollout readiness, CMS Page creation and production activation must be
verified separately from source builds and tests.
