# Editor save and navigation lifecycle

Each debounced save queue owns one pending patch for a document and serializes
its writes. A batch counts as pending once autosave starts. A flush sends
pending work, including edits made while an earlier write was in flight, and
succeeds only after registered queues acknowledge their work. The save barrier
also checks keyed recovery entries matching those registered queues. A failed
write remains pending. Timed retries are enabled per queue; where enabled, the
queue schedules up to eight retries with exponential backoff starting at one
second and capped at 30 seconds. A later edit resets that retry count.

Queues configured with both a stable recovery scope and recovery key copy
serializable pending and in-flight patches to `sessionStorage`, with an
in-memory fallback. A matching queue can claim an inactive recovery entry only
for the same document and recovery key, then submits the patch through its
current writer. A successful acknowledgement removes the recovered copy when
no newer patch remains. Failed work stays queued and recoverable. If
`sessionStorage` is unavailable, the in-memory copy can support recovery only
while that app session remains alive. This is automatic patch recovery; there
is no manual recovery download or dismissal flow.

App-link navigation uses the Core `NavigationLink` and
`EditorNavigationProvider`. When no editor save is pending, Next handles the
navigation normally. Otherwise, the provider prevents that navigation and
flushes registered editor queues; it proceeds only after acknowledgement. A
failed flush keeps the current screen open and shows the existing save-failure
notification. Explicit editor actions such as Post Back use the same barrier
scoped to that document.

The global `beforeunload` listener warns while any registered editor save is
pending and is removed when the pending set clears. Browser unload warnings
cannot wait for an asynchronous server acknowledgement, and native history or
process termination may end the page before a write is acknowledged.

Block-room body durability and semantic replay have separate persisted
acknowledgement rules; see [Editor automatic synchronization](editor-automatic-sync.md).
Post entity-configuration revision handling is described in [Post editor
configuration saves](post-editor-save-recovery.md).
