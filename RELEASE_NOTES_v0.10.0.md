# Zotero Word Learning v0.10.0

Version 0.10.0 fixes the Reader selected-text popup regression while keeping the compact non-invasive button design introduced in the 0.9.9 line.

## Changes

- Removed `setTimeout(addControl, 0)`.
- Restored synchronous `append(btn)`.
- Keeps the non-invasive Reader popup strategy:
  - no large wrapper `div`
  - no status hint row
  - no DOM changes to other plugin controls
  - only one compact appended button
- Keeps the compact blue button style to reduce the chance of covering Translate and LLM-for-Zotero actions.

## Result

The Word Learning action is added during Zotero's popup render lifecycle again, while the popup stays compact and avoids interfering with neighboring plugin buttons.
