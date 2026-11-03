# Shared action and confirmation contract

Ordinary actions default to neutral/medium. Dialog primary actions and all confirmation intents
use strong fill through the shared Core contract, as explicitly requested by the user. Core owns all color, geometry and states;
`features/confirmation` owns the product choice of confirmation intent.

## Expression

`tone` selects neutral, accent, positive, warning or danger. `emphasis` independently selects
transparent medium/low, a functional outline, or strong fill. Explicit semantic controls use the
existing status ink and new action fill/hover/pressed roles in both themes. Strong uses `text-on-action`;
normal, hover and pressed contrast are checked. Filled buttons have no border or inset pressed
outline; pressing changes their background. The outside keyboard focus ring remains available. Disabled controls override semantic ink, focus remains visible,
and pending confirmation locks dismissal and duplicate submission. Menus use semantic ink without
becoming filled commit buttons. Content/image overlay contrast keeps its existing Core contract.

| Feature intent            | Core treatment    | Typical command                                   |
| ------------------------- | ----------------- | ------------------------------------------------- |
| delete / discard / revoke | danger / strong   | Delete a record, discard changes, revoke a grant  |
| archive                   | warning / strong  | Archive Member criteria                           |
| restore                   | positive / strong | Restore a segment or document version             |
| regenerate                | warning / strong  | Replace a token, invalidating its previous secret |
| confirm                   | neutral / strong  | Change source locale or unsubscribe               |

`ConfirmationDialog` requires intent. It forwards the domain-owned command, message/impact summary,
pending state and disabled state to Core ConfirmModal. It does not infer risk from a label or
automatically execute commands. `confirmationDialogs.open` offers the same intent contract for
imperative use, backed by the existing Core host. Callers must return the real Promise; use
`mutateAsync` rather than a fire-and-forget `mutate` when the host owns pending/dismissal.

## Consumers

- Delete footers use the shared Feature: CommentItem,
  AdminFormSubmissionsPage, WorksPageView, PlaceEditor, LegalPolicyListClient and LegalPolicyEditor.
- Existing confirmations in administrator entity modals, map themes/places, email layouts/templates,
  mail adapters, event types, menus, release tracks, translation providers, user profiles, OAuth
  grants and personal access tokens select explicit intent.
- Artist/label impact previews and FileManager in-use blocking retain their domain details and
  revision/authorization checks while using the same confirmation surface.
- Both DataTable bulk deletion adapters share `useBulkDeletion`. It guards duplicate submission,
  waits for every item and preserves successful IDs when other items return domain errors or reject.
  Table selection, success notifications and refresh/invalidation remain caller-owned.
- The authoring EditorHeader composes the same Feature through a Core render slot. Post, page,
  form, work, release, event and event-series editors share that route. Core has no Feature import.
- Translation deletion and source-locale changes use the intent-aware imperative adapter and await
  their actual mutations. Version restoration and segment archive/restore keep separate intents.

## Domain flows retained

Account deletion sends an email and then displays a requested state, with recovery and anonymization
information. It retains its account-owned multi-step dialog. Deleting an attached reference, editing
a document block, removing a passkey, revoking a session and deleting a share link retain their
existing inline command flows; semantic tone is rendered consistently by Core. They are not
converted into record deletion or given an extra modal solely because their label says remove.

`Feature/Confirmation/Dialog` previews every intent, pending, blocked and an interactive localized
confirmation. Core's Button SemanticMatrix remains the source for every tone/emphasis combination.
