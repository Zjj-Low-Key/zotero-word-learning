# Zotero Word Learning v0.9.7

Version 0.9.7 is an architecture upgrade focused on Zotero panel stability during long-running async work and repeated ItemPane rebuilds.

## Panel Lifecycle

- Adds render generation tracking per Zotero window.
- Guards stale async callbacks before they write to the current panel.
- Adds lifecycle-managed cleanup for panel event handlers and active panel references.
- Uses a `MutationObserver` to dispose panel resources when Zotero removes a panel body from the DOM.

## Event Handling

- Builds the panel synchronously, then installs a unified delegated controller.
- Moves tabs, theme switching, add-word controls, wordbook actions, all-words sorting, review controls, and settings controls under the shared controller.
- Keeps the older idle rescue entry point only as a compatibility no-op.

## Async Guarding

Generation checks now cover vocabulary refresh, LLM completion, connection testing, and LLM-generated review distractors. This prevents old PDF panels, stale forms, or outdated vocabulary refreshes from overwriting the active UI after Zotero rebuilds the panel.

## Fallback Panel

The fallback panel path now uses the same generation tracking, active panel tracking, delegated handlers, and lifecycle cleanup as the native Zotero ItemPane path.
