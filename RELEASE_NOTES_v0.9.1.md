# Zotero Word Learning v0.9.1

## Highlights

- Stabilized native Zotero Item Pane integration.
- Kept the right-side `WL` entry while embedding Word Learning in Zotero's native right-side plugin area.
- Added plugin-controlled light/dark theme mode.
- Added a dedicated theme toggle button on the top tab bar.
- Bundled sun and moon theme icons and load them as data URIs for Item Pane compatibility.
- Restored red/orange/green semantic review feedback.
- Added green/red per-character spelling feedback.
- Improved dark-mode styling for cards, lists, inputs, textareas, selects, chips, review prompts, and status boxes.

## Details

### Zotero Native Sidebar

- Uses `Zotero.ItemPaneManager.registerSection(...)` for native Item Pane embedding.
- Fixes title bar, expand/collapse, and content-area layout behavior.
- Keeps the floating/right-side `WL` plugin entry for quick access.

### Theme System

- Adds the `extensions.wordlearning.themeMode` preference.
- Supports `light` and `dark` modes controlled inside the plugin.
- Stops relying on unstable Zotero/macOS theme detection.
- Places the theme switch at the far right of the top tab bar, separate from normal tabs.
- Uses bundled sun/moon icons with image, background-image, and text fallbacks.

### Review Feedback

- Preserves semantic colors:
  - Unknown: red.
  - Blurred: orange.
  - Known: green.
- Restores correct/wrong/selected colors for multiple-choice review.
- Keeps correct, wrong, and neutral status boxes visually distinct.

### Spelling Practice

- Adds per-character state attributes:
  - `data-wl-spell-state="correct"`
  - `data-wl-spell-state="wrong"`
- Correct characters show green feedback.
- Wrong characters show red feedback.
- Empty characters keep the default input style.

### All Words List

- Adds light/dark theme styling for the full vocabulary list.
- Fixes white list backgrounds in dark mode.
- Makes selected entries, titles, meaning summaries, and borders follow the active theme.

## Assets

- `zotero-word-learning-0.9.1.xpi`
- `Word Learning 0.9.1 source.zip`
