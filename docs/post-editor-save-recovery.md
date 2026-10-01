# Post editor config saves and recovery

Comments, content layout, and map location are entity-wide Post configuration. The editor sends them through one debounced queue registered to `post:<id>`. It merges pending fields, keeps the newest value for a repeated field, and waits for each server acknowledgement before sending the next patch. Selecting a map location flushes the queued configuration immediately. A failed action result rejects the queued write so the fields remain available to the next edit or explicit navigation flush.

This ordering applies within one Post editor session. The API does not compare configuration revisions across separate clients, so concurrent editors still use the last accepted server update. Locale title and summary remain room-scoped metadata and do not join the entity-wide config patch.

When a Post room is replaced after a reload-required interruption, the editor exposes the recovery snapshot only for the current Post and locale. The downloadable JSON keeps the canonical document, the local Yjs document and update, and resident title, summary, comments, layout, and map-location values together. It is a portable recovery copy for manual use; it does not apply local data to the replacement room or overwrite the saved Post.
