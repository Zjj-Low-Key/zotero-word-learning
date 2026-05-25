# Zotero Word Learning v0.9.8

Version 0.9.8 fixes a layout regression introduced by the 0.9.7 architecture upgrade in Zotero's native ItemPane mode.

## Root Cause

After clicking Save Settings, `rebuildPanelUI()` rebuilt the plugin's internal UI but did not reapply the native ItemPane layout cleanup path. That caused the plugin fallback header to reappear and restored an internal fixed-height scrolling container inside Zotero's own ItemPane scroll area.

## Fixes

- Added `normalizeNativeItemPaneLayout(win, panel)`.
- Removes the plugin fallback header in native Zotero ItemPane mode.
- Keeps the Zotero native header and lets Zotero control the panel height.
- Clears the internal `maxHeight: 560px` behavior.
- Switches the native ItemPane body to `overflow: visible`, empty `maxHeight`, and `flex: 0 0 auto`.
- Calls the same normalization path during initial render and after `rebuildPanelUI()`.

## Result

Saving settings no longer adds an extra `Word Learning ... loaded` navigation bar, and native ItemPane mode no longer falls back to a nested internal scroll area.
