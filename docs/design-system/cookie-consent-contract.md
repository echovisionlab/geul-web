# Cookie consent choice

The product has one optional consent category: analytics and external media. It covers Google Analytics
and embedded YouTube and Vimeo players. Essential cookies remain active for authentication and site operation.

## Interface and behavior

The [banner View](../../features/cookie-consent/ui/CookieConsentBannerView.tsx) names that single optional category
and exposes two decisions immediately: **Reject** and **Accept all**.
Reject persists analytics=false; Accept all persists analytics=true. Essential operation cookies remain active.
Neither reading the notice, scrolling, navigation nor inactivity enables optional analytics.
Renewal and explicit reopening require another explicit decision; old-version acceptance is not current consent.

Both decisions are real Core TextButtons with equal neutral/medium presentation, xs text and xs control targets.
Fine-pointer targets retain a 28px minimum height and the shared coarse-pointer minimum remains 44px.
They occupy the same action row; rejection is not hidden in the explanatory text or another panel.
The banner uses the shared compact LayoutContainer, sm SectionCard inset, xs text/gaps and wrapping footer.
Privacy and Terms links remain distinct from the decision buttons. The notice stays on screen until a decision.
Account settings retains its draft Analytics Switch and explicit Save preferences, with compact text actions.

The design follows the first-layer refusal, clear purpose, explicit consent and non-misleading choices discussed in the
[EDPB Cookie Banner Taskforce report](https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf).
That report does not prescribe our exact labels, dimensions or typography and does not certify this implementation.
Only one optional category exists, so a second customization layer adds no category choice.

## Integration and persistence

The [banner controller](../../features/cookie-consent/CookieConsentBanner.tsx) still writes
`geul_cookie_consent` and emits `geul:cookie-consent-change` only after an explicit decision.
The schema remains `{ version, essential: true, analytics, updatedAt }`; current version and cookie lifetime are unchanged.
Signed-in users still synchronize through `/api/cookie-consent` with source `banner`.
A failed account sync does not undo the browser cookie; the banner's existing best-effort behavior remains.

[Account settings](../../features/my/CookieConsentSettings.tsx) provides a draft optional Switch with rejection and explicit Save preferences.
Its essential-only context replaces a redundant disabled essential Switch.
The existing persistence action, pending restrictions, account/browser success feedback and sync error notification remain.
Browser consent remains effective even if account synchronization fails.

The [Google Analytics loader](../../features/analytics/GoogleAnalyticsLoader.tsx) still requires a configured provider
and analytics=true at the current consent version. A previous-version choice alone does not enable it.
Rejection still disables the provider and clears its analytics cookies through the existing integration.
No tracker, consent category, service, cookie schema or version was added.

## External media

[ExternalVideoView](../../features/media/ExternalVideoView.tsx) reads the same consent through
[useOptionalCookieConsent](../../features/cookie-consent/useOptionalCookieConsent.ts). With current consent the
provider player loads with the page, without autoplay permission. Without it, including before a decision and
during server rendering, the stored thumbnail File, the title, a Core IconButton play control and a notice that
playing loads the provider stand in. Pressing play loads and starts that one player with autoplay permission; it
does not record consent. The thumbnail is delivered from our storage, so nothing reaches the provider before consent
or a play press. Public documents, Page sections and the editor pass localized playback labels; a caller without
them gets the player directly.

The category kept consent version 1. Visitors who accepted analytics before the category included external media
see players load directly.

Explicit `geul:cookie-consent-open` reopening focuses rejection and returns focus to the invoking control after a decision.
The banner remains excluded from account/login/verification routes and `/my/settings`.

## Stories and review boundaries

[Banner stories](../../stories/features/CookieConsent.stories.tsx) use the production View with local callbacks.
They never write cookies, call account services or mount analytics.
Initial, Preferences (explicit reopening), Renewal and Phone IDs remain available.
AcceptAnalytics, RejectAnalytics and RejectPreviousConsent exercise the decisions with local fixture callbacks.
The result identifies a local fixture choice, never real tracking or persistence.

Review 390/834/1440px, short/long translations, themes and coarse-pointer behavior.
Check that the category and purpose are visible, both decisions remain accessible without ellipsis, targets do not overlap,
and Privacy/Terms and renewal text retain their relationships.
Browser checks must use the local View fixture; do not change real consent during review.
Controller/settings tests use isolated DOM cookies and mocked account calls.
Actual server persistence, provider transport and assistive technology acceptance are separate integration checks.

## Local API migration

The banner View no longer exposes an analytics draft, `analyticsEnabled`, `onAnalyticsChange` or `onSavePreferences`.
Its explicit `onAcceptAll` callback commits the single optional category, and `onRejectNonEssential` commits false.
The category context, renewal notice and rejection ID/focus restoration remain.
The controller, tests and local stories migrated together. Account settings retains its draft/save contract.
The supported-locale `rejectNonEssential` label is now the concise Reject equivalent; essential cookies remain active.
Cookie schema/version, Google Analytics gating and account synchronization are unchanged.
