# Link presentation

A paragraph that holds only one link can present it as a link, a card or (for YouTube and Vimeo URLs) a video.
Post and Page documents allow cards and videos; other profiles render the link and reject a link thumbnail.

## Storage

The paragraph stays an ordinary paragraph link. `linkPresentation` (`auto`, `link`, `card`, `video`) records the
choice; `auto` keeps the earlier URL-based video detection, so existing documents need no migration. A card or
video also keeps `linkSiteName`, a translatable `linkDescription` and `linkCaption`, and two image Files: the
thumbnail (`paragraph.linkThumbnail`) and the site icon (`paragraph.linkIcon`). The link text is the title.
Markdown export writes every presentation as `[title](url)`.

## Card layout

The card follows Notion's bookmark: a one-line title (the host when there is no title), a two-line description
and the site icon with the full URL on one line, beside the thumbnail. Text and thumbnail start from the same basis
and share the rest 4:1; when the card is too narrow for both, the thumbnail wraps away and the text keeps the row,
without a breakpoint. While a preview is read, the title row shows a spinner and the loading label. The caption sits
under the card or video; in the editor the empty prompt appears only while the block is selected, and translation
editors may edit it like other localized text.

The editor projects these paragraphs into the `linkCard` and `externalVideo` atoms and writes them back to the same
paragraph. A thumbnail added after the block exists is written field by field through the block room payload object
operations in `geul-common`.

## Choosing a presentation

Pasting a single URL inserts it as a link, as Notion does, and offers the choices in Notion's order: video, card and
link for a video URL; link and card otherwise. The first choice is selected. Escape or any further edit keeps the
link. Choosing a card or video moves a link pasted into other text to its own paragraph below. The card and video
selection menus offer the same choices and a preview refresh.

## Previews

`LinkPreviewService.GetLinkPreview` reads the title, description, site name, image and site icon a page declares
through Open Graph, Twitter card or its head. The icon is a declared `icon` link, then the touch icon, then the site's
`/favicon.ico`. The API fetches the page itself through the remote File import guard: HTTPS only,
public addresses pinned at dial time, re-validated redirects, an 8 second limit and the first MiB of the body. No
third-party preview service is used and nothing is stored on the server. Only authors can call it. The editor writes
the result into the paragraph once, imports the image and icon as editor Files and keeps an authored link title. A preview
changes only when an author refreshes it.

A card that has no preview shows the host and a globe in place of the icon. Its thumbnail and icon, like a video
thumbnail, are delivered from our storage, so viewing a card never contacts the linked site. Videos follow the external media rule in
[the cookie consent contract](design-system/cookie-consent-contract.md).

## Stories

Review `Feature/Media/Link Card`, `Feature/Media/External Video` (`WaitingForConsent` variants) and
`Feature/Editor/Link Presentation Menu`. Story fixtures are local; they never fetch a preview or load a provider
player.
