# Zotero Word Learning v0.9.3

This release fixes two state synchronization bugs in the Zotero native ItemPane integration.

## Fixed

### 1. Settings and Vocabulary No Longer Disappear After Reopening PDFs

Previously, after closing the current PDF in Zotero and opening another PDF, Word Learning could appear to lose settings and vocabulary data.

The root cause was Zotero destroying and recreating the native ItemPane section body when switching reader tabs or reopening papers. Some internal functions still used a stale panel reference resolved by `document.getElementById(...)`, so `loadSettings()` and `refreshTerms()` could update an old hidden or disconnected panel instead of the newly rendered Word Learning panel.

This update fixes the issue by:

- Adding per-window active panel tracking with `activePanelByWindow`.
- Updating `panel(win)` to prefer the currently connected and visible panel.
- Rebinding the current panel during native `onRender` and `onAsyncRender`.
- Avoiding stale ItemPane DOM references after switching PDFs.
- Making Zotero preference read/write more robust through unified helpers:
  - `prefGet(...)`
  - `prefSet(...)`

After this fix, the following data should persist correctly when closing and reopening PDFs:

- vocabulary database;
- API settings;
- API key;
- model settings;
- speech style;
- custom database path;
- language setting;
- plugin theme mode.

### 2. Edit Word Now Opens the Newly Added Word

Previously, after adding a new word and immediately switching to the Word Card view, the newest word could be shown correctly on the card, but clicking `Edit Word` could still open the previous word's edit content. The edit form only refreshed after manually navigating away and back with the card navigation buttons.

The root cause was that the edit form reused hidden or stale draft state and was not synchronized with the currently selected card when entering edit mode.

This update fixes the issue by:

- Adding `getSelectedTerm(win)` to reliably retrieve the current selected word.
- Adding `syncEditDraftFromSelected(win)` to refresh the edit draft from the active card before entering edit mode.
- Forcing the edit form to synchronize with the current card when clicking `Edit Word`.
- Updating selection state immediately after saving a newly added word.
- Refreshing the card view, word list, and all-words list after saving.

After this fix, adding a new word and immediately clicking `Edit Word` correctly shows the newly added word without requiring manual card navigation.

## Changed

- Improved internal state synchronization between:
  - Add Word view;
  - Word Card view;
  - Edit Word mode;
  - All Words list;
  - Zotero native ItemPane render lifecycle.

## Assets

- `zotero-word-learning-0.9.3.xpi`
- `Word Learning 0.9.3 source no README.zip`
