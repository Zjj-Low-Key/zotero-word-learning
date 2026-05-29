# Changelog

## 0.10.1

- Changed speech style option loading to refresh asynchronously after the settings panel appears.
- Reads available voices immediately, then retries after 250ms, 800ms, 1600ms, and 3000ms in case Zotero/Firefox loads system voices late.
- Refreshes again when `speechSynthesis` fires `voiceschanged`.
- Uses `speechSynthesis.addEventListener('voiceschanged', fill)` instead of overwriting `speechSynthesis.onvoiceschanged`.
- Cleans up the speech listener and retry timers through the existing panel lifecycle disposal path.
- Preserves the current selected voice during list refresh whenever that voice is still available.

## 0.10.0

- Removed `setTimeout(addControl, 0)` from the Reader selection popup integration.
- Restored synchronous `append(btn)` so the Word Learning button is added during Zotero's popup render lifecycle.
- Kept the 0.9.9 non-invasive Reader popup design: no large wrapper container, no status row, no modification of other plugin DOM, and only one compact action button.
- Retained the compact blue button style to reduce the risk of covering Translate and LLM-for-Zotero actions.

## 0.9.8

- Fixed a native Zotero ItemPane layout regression introduced by the 0.9.7 architecture upgrade.
- Added `normalizeNativeItemPaneLayout(win, panel)` to remove the plugin's fallback header in native ItemPane mode.
- Prevented `rebuildPanelUI()` from restoring the internal `Word Learning ... loaded` header after saving settings.
- Removed the plugin-owned `maxHeight: 560px` and internal scrolling from the native ItemPane body.
- Ensured first render and later rebuilds use the same native ItemPane layout normalization path.

## 0.9.7

- Added render generation tracking with `renderGenerationByWindow`, `beginRender(...)`, `currentGeneration(...)`, and `isRenderCurrent(...)`.
- Added lifecycle-managed panel cleanup through `panelLifecycleByBody`, `createPanelLifecycle(...)`, and `disposePanelBody(...)`.
- Switched the panel to synchronous UI construction followed by a unified delegated handler controller through `setupPanelHandlers(...)` and `handlePanelClick(...)`.
- Promoted delegated event handling from idle rescue fallback to the primary click controller for tabs, theme toggle, add-word, wordbook, all-words, review, and settings controls.
- Added generation guards to key async flows including term refresh, LLM completion, connection testing, and LLM review distractor generation.
- Kept `installIdleRescueHandlers(...)` as a compatibility no-op.
- Connected the fallback panel path to render generation, active panel tracking, delegated handlers, and lifecycle cleanup.

## 0.9.4

- Restored safe shutdown unregistration for the native Zotero ItemPane section.
- Safely attempts multiple possible section IDs, catches unknown-option errors, and clears `activePanelByWindow` after unregistering.
- Changed native header decoration to a no-op to avoid mutating adjacent Zotero or third-party plugin section headers.
- Cleaned historical theme CSS leftovers, including duplicate dark-theme blocks and an isolated brace.
- Kept plugin styles scoped under `#wl-panel-v026` to reduce CSS parsing and style-leak risks.
- Reworked the Reader selected-text popup `Add to Wordbook` action into an independent `data-role="wl-reader-selection-box"` container.
- Avoids duplicate Reader popup insertion and no longer modifies other plugin DOM.
- Restyled the Reader popup action as a blue rounded primary button with localized status feedback.

## 0.9.3

- Fixed settings and vocabulary disappearing after closing a PDF and opening another PDF in Zotero.
- Added per-window active panel tracking so settings and vocabulary refreshes target the currently rendered ItemPane panel instead of stale hidden DOM.
- Rebound the active panel during native `onRender` and `onAsyncRender`.
- Added unified preference helpers, `prefGet(...)` and `prefSet(...)`, for more robust settings persistence.
- Fixed stale edit-form content after adding a new word and immediately opening Edit Word.
- Added current selected-term lookup and edit-draft synchronization before entering edit mode.
- Refreshed card, word list, and all-words list state immediately after saving a newly added word.

## 0.9.1

- Stabilized native Zotero right-side Item Pane integration through `Zotero.ItemPaneManager.registerSection(...)`.
- Kept the right-side `WL` toolbar entry while allowing Word Learning to live inside Zotero's native plugin pane area.
- Fixed Item Pane header, expand/collapse, and content-area layout issues.
- Added plugin-controlled light/dark theme mode with `extensions.wordlearning.themeMode`.
- Added an independent theme toggle button on the right side of the top tab bar.
- Added bundled sun and moon icons loaded as data URIs with text fallback.
- Restored semantic review colors for Unknown, Blurred, Known, correct choices, wrong choices, selected choices, and status messages.
- Added per-character spelling feedback through `data-wl-spell-state="correct"` and `data-wl-spell-state="wrong"`.
- Updated All Words list, cards, inputs, textareas, selects, chips, and review hints for light and dark themes.

## 0.5.6

- Changed speech style selection to use locally exposed English voices from `speechSynthesis.getVoices()`.
- If Zotero/Windows exposes only one English voice, Settings now shows only that one voice option.
- Preview voice now uses the exact selected local voice.
- Existing legacy speech style values remain compatible.

## 0.5.5

- Added speech style selection in Settings.
- Added local speech preview button.
- Added Auto female, Auto male, Natural clear, Slow clear, and System default voice styles.

## 0.5.4

- Fixed pronunciation button in spelling review mode.
- Changed Show Answer behavior:
  - spelling mode now shows the correct spelling;
  - multiple-choice modes now show and highlight the correct option.

## 0.5.3

- Added automatic database migration when users set a new data path.
- If the new path has no database, the old `vocabulary.json` is copied automatically.
- Existing databases at the new path are never overwritten.

## 0.5.2

- Added editable custom database path in Settings.
- Added default database path display.

## 0.5.1

- Added long-term wrong-answer weighting.
- Added persistent review statistics per word and per question type.

## 0.5.0

- Added spelling review mode.
- Added per-letter green/red spelling feedback.
- Added phrase-aware spelling slots with spaces.

## 0.4.x

- Added mixed review task pool.
- Added word-level progress.
- Added LLM-generated distractors.
- Added DeepSeek thinking intensity support.
- Added card/list/review/settings UI refinements.

## 0.3.x

- Rebuilt the plugin into a stable minimal Zotero bootstrap plugin.
- Added global wordbook persistence.
- Added LLM completion and connection testing.
- Added independent Add Word, Word Card, All Words, Review, and Settings pages.
