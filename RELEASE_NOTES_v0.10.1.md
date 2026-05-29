# Zotero Word Learning v0.10.1

Version 0.10.1 fixes speech style list loading in the settings panel.

## Changes

- Speech style options now refresh asynchronously after panel creation.
- Reads voices once immediately, then retries after 250ms, 800ms, 1600ms, and 3000ms.
- Refreshes again when `speechSynthesis` fires `voiceschanged`.
- Uses `speechSynthesis.addEventListener('voiceschanged', fill)` instead of replacing `speechSynthesis.onvoiceschanged`.
- The extra listener and retry timers are cleaned up through the existing panel lifecycle disposal path.
- Keeps the current selected voice whenever it still exists after a refresh.

## Result

If Zotero or Firefox exposes system voices late, the settings panel can now pick them up automatically instead of staying stuck on `System Default`.
