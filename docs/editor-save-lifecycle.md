# Editor save and navigation lifecycle

Delayed field updates belong to one canonical document and one mounted room or
configuration queue. A queue merges pending fields and serializes writes until
each acknowledgement arrives. New edits during a write are drained by explicit
flush; failed writes retain their fields for retry. An in-flight batch counts as
pending from the instant autosave starts, including before its Promise is stored.

App links use the Core NavigationLink adapter. It preserves Next Link props,
anchor refs, and the caller's onNavigate cancellation before sending a generic
navigation intent. EditorNavigationProvider owns the application policy: if any
registered editor save is pending, prevent navigation, drain all current and
newer queued edits, then push or replace with the original scroll option. A
failed save keeps the current screen and shows the existing save-failure message.
Normal links without pending saves retain Next's navigation behavior. Next owns
modified clicks, new tabs, downloads, and external navigation.

Explicit Page/Post Back actions use the same scoped save boundary. A single
global beforeunload hook warns while any registered editor save is pending and
removes the listener after acknowledgement or unmount. Native browser history
and abrupt process termination cannot await an asynchronous server write.

Every serializable pending patch has an independent queue ID and recovery copy.
Room metadata uses the bootstrap document name, including locale; Post entity
configuration has its own stable scope. Opaque room identities without a known
canonical scope do not persist a copy. Teardown archives pending and in-flight
fields before canceling the original writer; it never writes through a new room.

Recovery copies use sessionStorage plus an in-memory fallback. If storage is
denied or full, the copy remains available during the current app session; that
fallback cannot survive a browser reload. Page/Post show all archived scopes
for their current document and allow explicit download or dismissal. Mounted
queues are excluded so dismissal cannot discard a live pending save. Copies
are never automatically applied to a replacement room.

Page title and summary initialize from canonical metadata once per provider and
locale. Revision-only ACKs preserve both accepted fields and newer local drafts.
A replacement provider or locale starts a new canonical scope. Regression tests
exercise the actual room connection ACK, deferred writes, newer edits during
flush, stale-room teardown, failed writes, storage denial, and the autosave
in-flight unload window.

See the [Post configuration and room recovery contract](post-editor-save-recovery.md)
for entity-wide ordering and the separate cross-client concurrency limitation.
