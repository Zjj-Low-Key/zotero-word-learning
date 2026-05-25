# Zotero Word Learning v0.9.4

This release focuses on the stability risks around Zotero native ItemPane cleanup, native header handling, scoped CSS, and the Reader selected-text popup action.

## Fixed

### 1. Restored Safe ItemPane Section Unregistration

Earlier versions skipped native section unregistration during shutdown to avoid development hot-reload errors such as:

```text
Can't remove unknown option
```

That avoided one error but left a stability risk: after repeated install or update cycles, old ItemPane callbacks could remain and affect other right-side panel plugins such as translation tools or LLM-for-Zotero.

Version 0.9.4 restores shutdown cleanup with:

```js
this.unregisterNativeItemPaneSection();
```

The unregistration is now defensive:

- It tries multiple possible section IDs.
- It catches `unknown option` and similar exceptions.
- It prevents cleanup failures from affecting Zotero or other plugins.
- It clears `activePanelByWindow` after unregistration.

### 2. Removed Aggressive Native Header DOM Mutation

The previous `decorateNativeSectionHeader()` implementation guessed Zotero's native ItemPane header from DOM geometry and inserted the Word Learning title. That could accidentally affect neighboring plugin headers.

Version 0.9.4 changes it to a no-op:

```js
decorateNativeSectionHeader(body) {
  return;
}
```

Word Learning no longer guesses or rewrites Zotero native headers, reducing the risk of affecting other plugin title bars, expand buttons, or panel state.

### 3. Cleaned Historical CSS Leftovers

The theme CSS has been cleaned to reduce parsing and style pollution risks:

- Removed duplicate dark-theme blocks.
- Removed an isolated `}`.
- Kept styles scoped under `#wl-panel-v026`.
- Reduced the chance of CSS parser recovery issues or cross-plugin style leakage.

### 4. Improved the Reader Selected-Text Popup Button

The Reader selected-text popup action is now inserted into an independent container:

```html
data-role="wl-reader-selection-box"
```

The updated popup behavior:

- Avoids duplicate insertion.
- Does not modify DOM owned by Zotero or other plugins.
- Uses a blue rounded primary-button style.
- Shows status feedback after clicking:
  - `Draft opened`
  - `已打开添加面板`

The action now behaves more like an independent primary action instead of a plain text button.

## Assets

- `zotero-word-learning-0.9.4.xpi`
- `Word Learning 0.9.4 source no README.zip`
