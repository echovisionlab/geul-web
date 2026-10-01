# Post editor configuration saves

The Post configuration queue owns the entity-wide slug, comments setting, map
place, and document-layout fields (content height, page chrome, and footer).
Localized title, summary, and body data use the separate locale and block-room
save paths.

Configuration edits are sparse patches in one debounced queue per Post. The
queue sends each update against its resident `configurationRevision` and waits
for the response before sending the next patch. It adopts the returned
canonical snapshot while retaining later local intent. Layout updates merge
only the changed layout fields over the current snapshot. A hint from another
editor triggers an authorized configuration read; pending local fields remain
overlaid on that result. If a peer snapshot arrives during a write, the hook
reads again before adopting the acknowledgement so an older response cannot
regress the resident revision.

When the server rejects an update with `Aborted` or `FailedPrecondition`, the
hook reads the latest configuration. If the patch already matches that
snapshot, it does not send a redundant update. Otherwise, it retries the sparse
patch once against the fetched revision. This preserves disjoint peer changes;
when both editors change the same scalar, the last accepted server update
wins. A second conflict or another save failure leaves the patch in the queue
and reports the error. This queue has automatic retry enabled, so it retries
with exponential backoff (up to eight scheduled retries, capped at 30 seconds)
and retains the patch for recovery if the retry budget is exhausted.

The queue uses document `post:<id>` and the exact recovery scope
`post:<id>:configuration` with recovery key `post-configuration`. A matching
Post editor automatically claims an inactive recovery patch and submits it
through the current writer. It does not show a recovery download, reload
dialog, or manual apply/dismiss action for configuration conflicts. App-link
navigation and the Post Back action flush registered saves first; a failed
flush keeps the editor open. Browser unload shows the shared pending-save
warning but cannot await the server.

This contract covers entity-wide Post configuration only. It does not describe
locale metadata, collaborative body durability, lifecycle actions, or other
Post mutations.
