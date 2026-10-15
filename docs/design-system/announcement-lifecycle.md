# Live announcement lifecycle

Pending actions keep their accessible action name and keyboard focus while preventing
repeat activation. Their progress announcement must also remain named if navigation,
a completed operation or a closed dialog removes the control and its labels.

## Dependency correction

React Aria 3.53.1 creates a live-region image with `aria-labelledby` references to the
original control and progress indicator. The image remains in the document for seven
seconds. Unmounting those sources leaves an unnamed image and dangling references.
The first browser announcement also waits 100 ms, so its labels can disappear before
it enters the live region.

`patches/react-aria@3.53.1.patch` resolves the referenced accessible name at the public
`announce()` boundary while the sources are mounted. It uses
`dom-accessibility-api@0.6.3`, declared for that exact React Aria version in
`pnpm-workspace.yaml`. The name calculation retains nested labels, external ID
references, hidden-name rules and duplicate-reference handling. It is not a copy of
visible `textContent`.

A temporary probe sits outside the live logs and is removed immediately. The actual
announcement keeps its computed name through `aria-label`. Plain string announcements,
assertive/polite urgency, the initial browser delay and the seven-second cleanup are
unchanged. Core action APIs, pending state, focus and duplicate-activation guards are
unchanged. A missing or empty source name still produces an empty name; this correction
does not supply a fallback that hides invalid semantics.

The patch covers the package's CommonJS and both ESM implementations. pnpm records
its content hash in the lockfile and applies it during installation. Recheck this
correction when upgrading React Aria; remove it when the installed upstream version
retains equivalent semantics without dangling references.

## Verification scope

`components/core/Button/PendingAnnouncement.test.tsx` exercises the installed React
Aria implementation through Button and IconButton, external and nested labels,
focused pending state, owner unmount, the initial delay, urgency and timed cleanup.
The regular Button and IconButton tests continue to cover their action behavior.

The current React Aria toast implementation uses mounted alert content rather than
this global pending announcer. `components/core/Notification/Notification.test.tsx`
checks title and description references through dismiss, replacement and queue cleanup.
No Notification production change is required by that regression.

Run these tests after dependency installation:

```sh
node node_modules/vitest/vitest.mjs run \
  components/core/Button/PendingAnnouncement.test.tsx \
  components/core/Button/Button.test.tsx \
  components/core/IconButton/IconButton.test.tsx \
  components/core/Notification/Notification.test.tsx
```

DOM regressions establish name and lifecycle behavior. Browser accessibility checks
and assistive technology review remain separate evidence.
