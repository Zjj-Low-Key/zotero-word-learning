/* global Zotero, Services, PathUtils, IOUtils, Ci */

var WordLearningPlugin = {
  id: null,
  version: null,
  rootURI: null,
  nativePanelRegistered: false,
  nativePaneID: 'word-learning-item-pane',
  readerSelectionHandler: null,
  lastSelectionPayload: null,
  activePanelByWindow: new WeakMap(),
  panelLifecycleByBody: new WeakMap(),
  renderGenerationByWindow: new WeakMap(),
  panelLastInteractionByWindow: new WeakMap(),
  selectedIdByWindow: new WeakMap(),
  reviewIndexByWindow: new WeakMap(),
  reviewSessionByWindow: new WeakMap(),
  allWordsSortByWindow: new WeakMap(),
  ids: {
    button: 'wl-floating-button-v026',
    panel: 'wl-panel-v026',
    menu: 'wl-tools-menu-v026'
  },

  startup(data, reason) {
    this.id = data && data.id;
    this.version = data && data.version;
    this.rootURI = data && data.rootURI;
    var plugin = this;
    Promise.all([
      Zotero.initializationPromise || Promise.resolve(),
      Zotero.unlockPromise || Promise.resolve(),
      Zotero.uiReadyPromise || Promise.resolve()
    ]).then(function () {
      plugin.registerNativeItemPaneSection();
      plugin.addToAllWindows();
      plugin.registerReaderSelectionPopup();
      plugin.debug('startup ' + plugin.version);
    }).catch(function (e) {
      plugin.debug('startup readiness failed: ' + e);
      plugin.nativePanelRegistered = false;
      plugin.addToAllWindows();
      plugin.registerReaderSelectionPopup();
    });
  },

  shutdown(data, reason) {
    this.unregisterReaderSelectionPopup();

    // Always try to unregister the native ItemPane section.  Leaving old
    // ItemPaneManager callbacks registered after dev reloads can interfere with
    // other ItemPane plugins.  The unregister helper is intentionally tolerant:
    // it swallows Zotero's "unknown option" errors and still resets our state.
    this.unregisterNativeItemPaneSection();

    this.removeFromAllWindows();
    this.debug('shutdown');
  },

  install() {},
  uninstall() {},

  onMainWindowLoad(data) {
    if (data && data.window) {
      this.loadNativeLocale(data.window);
      this.registerNativeItemPaneSection();
      this.addToWindow(data.window);
    }
  },

  onMainWindowUnload(data) {
    if (data && data.window) {
      this.removeFromWindow(data.window);
    }
  },

  debug(message) {
    try {
      Zotero.debug('[WordLearning] ' + message);
    } catch (e) {}
  },



  loadNativeLocale(win) {
    try {
      if (win && win.MozXULElement && win.MozXULElement.insertFTLIfNeeded) {
        win.MozXULElement.insertFTLIfNeeded('word-learning.ftl');
      }
    } catch (e) {
      this.debug('loadNativeLocale failed: ' + e);
    }
  },


  isDarkMode(win, panel) {
    function avgRGB(bg) {
      try {
        var nums = String(bg || '').match(/\d+/g) || [];
        if (nums.length >= 3) {
          return (parseInt(nums[0], 10) + parseInt(nums[1], 10) + parseInt(nums[2], 10)) / 3;
        }
      } catch (e) {}
      return null;
    }

    try {
      var doc = win && win.document;
      var root = doc && doc.documentElement;
      var body = doc && doc.body;

      // Prefer explicit Zotero/Firefox theme signals.
      var attr = [
        root && root.getAttribute('data-theme'),
        body && body.getAttribute('data-theme'),
        root && root.getAttribute('color-scheme'),
        body && body.getAttribute('color-scheme'),
        root && root.getAttribute('lwtheme'),
        body && body.getAttribute('lwtheme'),
        root && root.className,
        body && body.className
      ].join(' ');
      if (/\blight\b/i.test(attr)) return false;
      if (/\bdark\b|\bnight\b/i.test(attr)) return true;

      // Sample stable Zotero UI containers, excluding Word Learning itself.
      // Previous builds sampled the WL panel's own ancestors and got stuck dark
      // after switching Zotero back to light mode.
      var selectors = [
        '#zotero-tb',
        '#zotero-pane',
        '#zotero-item-pane',
        '#zotero-context-pane',
        '.zotero-context-pane',
        '.item-pane',
        '.reader-sidebar',
        '.context-pane',
        'body'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var el = doc.querySelector(selectors[i]);
        if (!el) continue;
        if (panel && (el === panel || el.contains(panel))) continue;
        var cs = win.getComputedStyle ? win.getComputedStyle(el) : null;
        var avg = cs ? avgRGB(cs.backgroundColor) : null;
        if (avg !== null) {
          if (avg > 170) return false;
          if (avg < 95) return true;
        }
      }

      // As a last DOM fallback, sample document/body only.
      var bg = win.getComputedStyle ? win.getComputedStyle(body || root).backgroundColor : '';
      var avg2 = avgRGB(bg);
      if (avg2 !== null) {
        if (avg2 > 170) return false;
        if (avg2 < 95) return true;
      }
    } catch (e) {}

    // Final fallback only.
    try {
      return !!(win && win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) {}
    return false;
  },

  installThemeStyles(win, panel) {
    try {
      if (!win || !win.document || !panel) return;
      var doc = win.document;
      var styleID = 'wl-system-theme-style-v080';
      if (!doc.getElementById(styleID)) {
        var st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
        st.id = styleID;
        st.textContent = `
/* Word Learning 0.8.1: explicit Zotero-aware light/dark palette + semantic review colors. */
#wl-panel-v026 {
  --wl-bg: #f6f7f9;
  --wl-surface: #ffffff;
  --wl-surface-2: #f8fafc;
  --wl-text: #111827;
  --wl-text-muted: #4b5563;
  --wl-border: #d1d5db;
  --wl-input-bg: #ffffff;
  --wl-button-bg: #ffffff;
  --wl-button-hover: #f3f4f6;
  --wl-chip-bg: #f3f4f6;
  --wl-chip-text: #374151;
  --wl-blue: #2d7ff9;
  --wl-red-bg: #fef2f2;
  --wl-red-border: #fecaca;
  --wl-red-text: #991b1b;
  --wl-orange-bg: #fff7ed;
  --wl-orange-border: #fed7aa;
  --wl-orange-text: #c2410c;
  --wl-green-bg: #f0fdf4;
  --wl-green-border: #bbf7d0;
  --wl-green-text: #166534;
  color-scheme: light;
}
#wl-panel-v026[data-wl-theme="dark"] {
  --wl-bg: #2b2b2b;
  --wl-surface: #242424;
  --wl-surface-2: #303030;
  --wl-text: #f3f4f6;
  --wl-text-muted: #d1d5db;
  --wl-border: #555555;
  --wl-input-bg: #1f1f1f;
  --wl-button-bg: #3a3a3a;
  --wl-button-hover: #464646;
  --wl-chip-bg: #4a4a4a;
  --wl-chip-text: #f3f4f6;
  --wl-blue: #3b82f6;
  --wl-red-bg: #3a1f22;
  --wl-red-border: #ef4444;
  --wl-red-text: #fecaca;
  --wl-orange-bg: #3b2a18;
  --wl-orange-border: #f59e0b;
  --wl-orange-text: #fed7aa;
  --wl-green-bg: #153520;
  --wl-green-border: #22c55e;
  --wl-green-text: #bbf7d0;
  color-scheme: dark;
}

#wl-panel-v026[data-wl-theme="light"] {
  --wl-bg: #f6f7f9;
  --wl-surface: #ffffff;
  --wl-surface-2: #f8fafc;
  --wl-text: #111827;
  --wl-text-muted: #4b5563;
  --wl-border: #d1d5db;
  --wl-input-bg: #ffffff;
  --wl-button-bg: #ffffff;
  --wl-button-hover: #f3f4f6;
  --wl-chip-bg: #f3f4f6;
  --wl-chip-text: #374151;
  --wl-blue: #2d7ff9;
  --wl-red-bg: #fef2f2;
  --wl-red-border: #fecaca;
  --wl-red-text: #991b1b;
  --wl-orange-bg: #fff7ed;
  --wl-orange-border: #fed7aa;
  --wl-orange-text: #c2410c;
  --wl-green-bg: #f0fdf4;
  --wl-green-border: #bbf7d0;
  --wl-green-text: #166534;
  color-scheme: light;
}
#wl-panel-v026,
#wl-panel-v026 [data-role="wl-root"],
#wl-panel-v026 [data-role="wl-body"],
#wl-panel-v026 [data-view],
#wl-panel-v026 [data-wl-page],
#wl-panel-v026 [data-role="wl-tabs"] {
  background: var(--wl-bg) !important;
  color: var(--wl-text) !important;
}
#wl-panel-v026 * {
  box-sizing: border-box;
}
#wl-panel-v026 div,
#wl-panel-v026 span,
#wl-panel-v026 label,
#wl-panel-v026 p,
#wl-panel-v026 h1,
#wl-panel-v026 h2,
#wl-panel-v026 h3,
#wl-panel-v026 strong,
#wl-panel-v026 b {
  color: var(--wl-text) !important;
}
#wl-panel-v026 [style*="color: #111827"],
#wl-panel-v026 [style*="color:#111827"],
#wl-panel-v026 [style*="color: rgb(17, 24, 39)"],
#wl-panel-v026 [style*="color: #374151"],
#wl-panel-v026 [style*="color:#374151"],
#wl-panel-v026 [style*="color: rgb(55, 65, 81)"],
#wl-panel-v026 [style*="color: #4b5563"],
#wl-panel-v026 [style*="color:#4b5563"],
#wl-panel-v026 [style*="color: #6b7280"],
#wl-panel-v026 [style*="color:#6b7280"],
#wl-panel-v026 [style*="color: #9ca3af"],
#wl-panel-v026 [style*="color:#9ca3af"] {
  color: var(--wl-text-muted) !important;
}
#wl-panel-v026 input,
#wl-panel-v026 textarea,
#wl-panel-v026 select {
  background: var(--wl-input-bg) !important;
  color: var(--wl-text) !important;
  border: 1px solid var(--wl-border) !important;
  caret-color: var(--wl-text) !important;
}
#wl-panel-v026 input::placeholder,
#wl-panel-v026 textarea::placeholder {
  color: var(--wl-text-muted) !important;
  opacity: .75 !important;
}
#wl-panel-v026 button {
  background: var(--wl-button-bg) !important;
  color: var(--wl-text) !important;
  border: 1px solid var(--wl-border) !important;
  box-shadow: none !important;
}
#wl-panel-v026 button:hover {
  background: var(--wl-button-hover) !important;
}
#wl-panel-v026 button.wl-active,
#wl-panel-v026 button[data-wl-active="1"],
#wl-panel-v026 button[data-primary="1"],
#wl-panel-v026 .wl-primary {
  background: var(--wl-blue) !important;
  color: white !important;
  border-color: var(--wl-blue) !important;
}
#wl-panel-v026 [style*="background: #fff"],
#wl-panel-v026 [style*="background:#fff"],
#wl-panel-v026 [style*="background: #ffffff"],
#wl-panel-v026 [style*="background:#ffffff"],
#wl-panel-v026 [style*="background: white"],
#wl-panel-v026 [style*="background:white"],
#wl-panel-v026 [style*="background: rgb(255, 255, 255)"],
#wl-panel-v026 [style*="background-color: rgb(255, 255, 255)"],
#wl-panel-v026 [style*="#f8fafc"],
#wl-panel-v026 [style*="#f3f4f6"],
#wl-panel-v026 [style*="#eff6ff"] {
  background: var(--wl-surface) !important;
  color: var(--wl-text) !important;
}
#wl-panel-v026 [data-role="review-card"],
#wl-panel-v026 [data-role="card-display"],
#wl-panel-v026 [data-role="allwords-list"],
#wl-panel-v026 [data-view="addword"] > div,
#wl-panel-v026 [data-view="settings"] > div,
#wl-panel-v026 [data-view="review"] > div,
#wl-panel-v026 [data-view="allwords"] > div {
  background: var(--wl-surface) !important;
  color: var(--wl-text) !important;
  border-color: var(--wl-border) !important;
  box-shadow: none !important;
}
#wl-panel-v026 [data-role="allwords-list"] > div {
  background: var(--wl-surface) !important;
  color: var(--wl-text) !important;
  border-bottom-color: var(--wl-border) !important;
}
#wl-panel-v026 [data-role="allwords-list"] > div:hover {
  background: var(--wl-surface-2) !important;
}
#wl-panel-v026 [data-role="allwords-list"] > div[aria-selected="true"],
#wl-panel-v026 [data-role="allwords-list"] > div[data-selected="1"] {
  background: color-mix(in srgb, var(--wl-blue) 22%, var(--wl-surface)) !important;
}
#wl-panel-v026 [data-role="phrase-pill"],
#wl-panel-v026 [data-role="related-phrase"],
#wl-panel-v026 [data-role="term-phrase"],
#wl-panel-v026 .wl-phrase-pill,
#wl-panel-v026 span[style*="#f3f4f6"],
#wl-panel-v026 span[style*="rgb(243, 244, 246)"] {
  background: var(--wl-chip-bg) !important;
  color: var(--wl-chip-text) !important;
  border-color: var(--wl-border) !important;
  opacity: 1 !important;
}
#wl-panel-v026 [data-role="review-choices"] button {
  background: var(--wl-surface) !important;
  color: var(--wl-text) !important;
  border-color: var(--wl-border) !important;
}
#wl-panel-v026 [data-role="review-choices"] button[data-wl-review-state="correct"] {
  background: var(--wl-green-bg) !important;
  color: var(--wl-green-text) !important;
  border-color: var(--wl-green-border) !important;
}
#wl-panel-v026 [data-role="review-choices"] button[data-wl-review-state="wrong"] {
  background: var(--wl-red-bg) !important;
  color: var(--wl-red-text) !important;
  border-color: var(--wl-red-border) !important;
}
#wl-panel-v026 [data-role="review-choices"] button[data-wl-review-state="selected"] {
  background: var(--wl-surface-2) !important;
  color: var(--wl-text) !important;
  border-color: var(--wl-border) !important;
}
#wl-panel-v026 [data-role="review-grade-again"],
#wl-panel-v026 [data-review-grade="again"] {
  background: var(--wl-red-bg) !important;
  color: var(--wl-red-text) !important;
  border-color: var(--wl-red-border) !important;
}
#wl-panel-v026 [data-role="review-grade-hard"],
#wl-panel-v026 [data-review-grade="hard"] {
  background: var(--wl-orange-bg) !important;
  color: var(--wl-orange-text) !important;
  border-color: var(--wl-orange-border) !important;
}
#wl-panel-v026 [data-role="review-grade-known"],
#wl-panel-v026 [data-review-grade="known"] {
  background: var(--wl-green-bg) !important;
  color: var(--wl-green-text) !important;
  border-color: var(--wl-green-border) !important;
}
#wl-panel-v026 [data-role$="status"],
#wl-panel-v026 [data-role*="status"],
#wl-panel-v026 [data-review="answer"] {
  background: var(--wl-surface-2) !important;
  color: var(--wl-text) !important;
  border-color: var(--wl-border) !important;
}
#wl-panel-v026 [data-wl-status-state="ok"] {
  background: var(--wl-green-bg) !important;
  color: var(--wl-green-text) !important;
}
#wl-panel-v026 [data-wl-status-state="err"] {
  background: var(--wl-red-bg) !important;
  color: var(--wl-red-text) !important;
}
#wl-panel-v026 a,
#wl-panel-v026 svg {
  color: var(--wl-blue) !important;
  stroke: currentColor !important;
}

#wl-panel-v026 input[data-role="review-spell-char"] {
  background: var(--wl-input-bg) !important;
  color: var(--wl-text) !important;
  border-color: var(--wl-border) !important;
  border-bottom-color: var(--wl-border) !important;
}
#wl-panel-v026 input[data-role="review-spell-char"][data-wl-spell-state="correct"] {
  background: var(--wl-green-bg) !important;
  color: var(--wl-green-text) !important;
  border-color: var(--wl-green-border) !important;
  border-bottom-color: var(--wl-green-border) !important;
}
#wl-panel-v026 input[data-role="review-spell-char"][data-wl-spell-state="wrong"] {
  background: var(--wl-red-bg) !important;
  color: var(--wl-red-text) !important;
  border-color: var(--wl-red-border) !important;
  border-bottom-color: var(--wl-red-border) !important;
}


#wl-panel-v026 [data-role="wl-tab-actions"] {
  margin-left: auto !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 6px !important;
  flex: 0 0 auto !important;
}
#wl-panel-v026 [data-role="theme-toggle"] {
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  padding: 0 !important;
  border-radius: 999px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-left: 0 !important;
  position: relative !important;
  z-index: 2 !important;
  opacity: 1 !important;
  overflow: hidden !important;
}

#wl-panel-v026 [data-role="theme-toggle"] img {
  width: 22px !important;
  height: 22px !important;
  display: block !important;
  object-fit: contain !important;
  pointer-events: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  filter: none !important;
}
#wl-panel-v026[data-wl-theme="light"] [data-role="theme-toggle"] {
  background: #ffffff !important;
  color: #f59e0b !important;
  border-color: #d1d5db !important;
}
#wl-panel-v026[data-wl-theme="dark"] [data-role="theme-toggle"] {
  background: #3a3a3a !important;
  color: #f8fafc !important;
  border-color: #555555 !important;
}

#wl-panel-v026 input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
`;
        (doc.head || doc.documentElement).appendChild(st);
      }
      panel.classList.remove('wl-dark');
      panel.classList.remove('wl-light');
      panel.classList.remove('wl-zotero-dark');
      panel.classList.remove('wl-zotero-light');
      panel.classList.add('wl-system');
      this.applyManualTheme(win, panel);
    } catch (e) {
      this.debug('installThemeStyles failed: ' + e);
    }
  },

  restoreThemeInlineOverrides(panel) {
    try {
      if (!panel) return;
      var nodes = Array.prototype.slice.call(panel.querySelectorAll('[data-wl-dark-props]'));
      if (panel.dataset && panel.dataset.wlDarkProps) nodes.unshift(panel);
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var props = (el.dataset.wlDarkProps || '').split(',').filter(Boolean);
        for (var p = 0; p < props.length; p++) {
          try { el.style.removeProperty(props[p]); } catch (e) {}
        }
        try { delete el.dataset.wlDarkProps; } catch (e) { el.removeAttribute('data-wl-dark-props'); }
      }
    } catch (e) {}
  },

  markDarkStyle(el, prop, value) { return; },

  markDarkStyle(el, prop, value) {
    try {
      if (!el || !el.style) return;
      if (!el.dataset.wlDarkProps) el.dataset.wlDarkProps = '';
      var props = el.dataset.wlDarkProps ? el.dataset.wlDarkProps.split(',') : [];
      if (props.indexOf(prop) < 0) {
        props.push(prop);
        el.dataset.wlDarkProps = props.join(',');
      }
      el.style.setProperty(prop, value, 'important');
    } catch (e) {}
  },

  restoreLightElements(panel) { this.restoreThemeInlineOverrides(panel); },


  normalizeDarkElements(win, panel) { this.restoreThemeInlineOverrides(panel); },


  refreshTheme(win) {
    try {
      var p = this.panel(win);
      if (!p) return;
      this.installThemeStyles(win, p);
    } catch (e) {}
  },


  setupThemeWatcher(win, panel) { return; },


  normalizeDarkSpecificWidgets(win, panel) { this.restoreThemeInlineOverrides(panel); },


  themePrefKey: 'extensions.wordlearning.themeMode',

  getThemeMode(win) {
    try {
      var value = Zotero.Prefs.get(this.themePrefKey, true);
      if (value === 'dark' || value === 'light') return value;
    } catch (e) {}
    return 'light';
  },

  setThemeMode(win, mode) {
    try {
      Zotero.Prefs.set(this.themePrefKey, mode === 'dark' ? 'dark' : 'light', true);
    } catch (e) {}
    try {
      var panel = this.panel(win);
      if (panel) {
        this.applyManualTheme(win, panel);
        this.renderThemeToggle(win);
      }
    } catch (e) {}
  },

  applyManualTheme(win, panel) {
    try {
      if (!panel) return;
      var mode = this.getThemeMode(win);
      panel.setAttribute('data-wl-theme', mode === 'dark' ? 'dark' : 'light');
      panel.classList.remove('wl-dark');
      panel.classList.remove('wl-light');
      panel.classList.remove('wl-zotero-dark');
      panel.classList.remove('wl-zotero-light');
      panel.classList.add('wl-system');
      this.restoreThemeInlineOverrides(panel);
    } catch (e) {}
  },

  syncZoteroThemeAttribute(win, panel) {
    // Kept for compatibility with older calls. From 0.8.6 onward the palette is
    // controlled by Word Learning's own sun/moon toggle, not Zotero/macOS detection.
    this.applyManualTheme(win, panel);
  },

  themeSunIconURL() {
    return 'data:image/png;base64,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';
  },

  themeMoonIconURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAQAElEQVR4AeydC5BdRZnHM3fuxJCYnSGGmUlmkKwor11WMLvgg13cpCA8XHkYQgwiwsIitbWy8rJQIg9TKiAPn6hIQSGIPCJSIiURDSIgBSWKKCiIgmYyd2aYTKLkMTOZib9O3QvXm8mde+7tPqf7nH+qv/R5dH/f1//u//m6zz3nTG6K/gkBIbBTBESQnUKjE0JgyhQRRKNACFRBQASpAo5OCQERRGNACFRBwCFBqljVKSEQCAIiSCAdJTeTQUAESQZ3WQ0EAREkkI6Sm8kgIIIkg7usBoJAmAQJBFy5GT4CIkj4fagWOERABHEIrlSHj4AIEn4fqgUOERBBHIIr1eEjIIJU9KF2hUA5AiJIORraFgIVCIggFYBoVwiUIyCClKOhbSFQgYAIUgGIdoVAOQIiSDkabrelPUAERJAAOy2Ky4VCYUZ/f//ro9RR2dcQEEFewyKVWx0dHWOjo6MDa9eu/X5PT8/p5LNT2VBHjRJBHAHri9qmpqYt+PIUchTb15MbsvwUopwzMDAwl32lKgiIIFXAScspiPFwRVsOYf8qIstLEGUl07CF7CtNgIAIMgEo4R2a1ONKgpQq5Nk4fnx8/AGmX7+DLB8dGhpq45hSEQERpAhEmjMI8NPJ2keU2YsyV2/evHkIolyn6RdokEQQQEh76u7uHty2bVtPhHZ+eGRk5AWIcjWS6UW9CBJh1IRclAjxmyj+U34a5T+KvAhJPp3VqZcIwgjISIpEkDJMZrB9IVOvF3t7e89nO1NJBMlIdzPFeqaupr5WqRUdV7CYf467XgteO5zuLREk3f37auvy+Xy9EeRVHWaDqddbWPT/iGnXd5E9zLE0iwiS5t4taxtX/xfKdm1sHoMSM+1aTp7aJIKktmv/vmGdnZ39HNmGWE0Q7zIiyYNIKu92iSBWh4v3ygqOPDwUvU/39fW9gzxVSQRJVXdO2pjeSUvUX6BzbGzsIe50nVerihDKiSAh9JI9H10SxHiZZ8p1JdOtu5Hp5kDoIoKE3oMR/Gfw9kUo3kjRY7H1cH9/f2cjSnyoK4L40Asx+ZDL5TbGZGoKt4MPHB0dfYIp135x2XRhRwRxgaqnOvn9YnOcrkGSbiLJY0y3/iNOuzZtiSA20fRcV5wRpAyKmWz/hEjyQfK4kjU7Iog1KP1XRAQxbxcm4iiR5CZIcmoixhswKoI0AF6AVTcl6HMTJLkhNJKIIAmOmLhNM8Uaj9tmhb3tJGFN8uGK497uiiDedo19x7iCT7WvNbLGJmpcFwpJRBB6KyvJE4KU4L6O6dYppR1f8x0J4qun8qthBJhimbcEG9ZjSwGEvb6vr++dtvS50COCuEDVU50MyF08c61lbGzsHqZb3r5XIoJ4NmIcu+PjI+nGp/sKhYJ5tddx86OrF0GiYxZyDTMYffR/P36jWemjYyKIj73izidfCWJavIhF+8VmwyeJlSA+NTyLvrAG6fC53fh3SU9Pz7t88lEE8ak3HPvS1NT0JscmbKi/bWBgwDy/ZUNXwzpEkIYhDEMBV+bd8bQZ8TpB4t1HR0dv8MVJEcSXnnDsBwPvHx2bsKn+BG79nmxTYb26RJB6kQusHgTZMzCXv1yMeom6nRaCJApiCMZZAL81BD/LfJwJqT9ftp/IpgiSCOyJGP2XRKw2ZvQ4fkBM9DOnIkhjHRhMbSLIgcE4W+YoPyBej++JPYUsgpR1Rlo3BwcHu5muhPqXo95EFLkwqb4RQZJCPka73Db16se3qE0nilxoSB61no3yIsikKIZfgAHm9SPlkyFM9Hvd8PDw5ZOVc3FeBHGBqn86gyZIEc6l/DYS+2PxIkgR/bRmTE3+gbb9KxJ6MmP1orgbYYzGbVP2YkRgZGTk8BjNuTb1oYGBgTmujZTrF0HK0UjhNuuPo1LUrPzWrVtjvaMlgiQ5emKwzQL3v2IwE5sJCH8ma5HY3msRQWLr2vgNFT+IENtgiqOFEH4q8r9x2DI2RBCDQkqFq+3SNDaNX9bPRMz3tZw3TwRxDnFyBhhES5Kz7tTyHKLj0U4tFJWLIEUg0pb19va+mzZ5/Yot/tWdxsbG/qfuyhEqiiARwAqpKNEjuC+pR8GXdcjRcfwFKxEkSq8EUpa7PNMhyImBuFuvm7nR0VHnH8EWQertHr/rncwV9nV+u2jFu/db0VJFiQhSBZxQTxE9zgrV9yh+cxHYq1AoOP1SiwgSpUcCKMvi/D8ZOKG9Xls3stzKdvpDqAhSd9f4WZHo8THHnvmm3untXhHEt+5uwB+ixz9RfRGSpbTA3JRw1WARxBWyCeglelyagNmkTZqP4Tl7YlkESbp7Ldlnsbo/qt6HZDEd4arRIogrZGPWy2L1UzGb9MYckdPZG5MiiDfdXL8jzMHNG4PH1K/Bl5r1+cFdu/2JoE7+AI8IUl+f+FbrOt8citsfosi/ubApgrhANUadRA/z0J6JIDFa9c8UU8yDXHglgrhANSad69ev35Ur52djMue1GaZZIojXPZSAc5s2bbqcgbFrAqa9M8mF4u0unFIEcYFqDDqZWs3HzOmIEghwoeiCJDv/O/CUqSeJIPWg5kEdBsONuBHLa6fYCSL19/fvbdtREcQ2ojHoI3qcwxXT/DAYg7VwTHDReKNtb0UQ24g61gc5zB2rRL5T67hpDavnTpb1R99FkIa7JT4F69ata+Uq+V0s5hGlHRGYt+Ohxo6III3hF2vtLVu2fIupVVesRsMylsgUKyyIUuotU6vLaFqaPiNKc6wnRRDrkAagEHKYp1WXB+Bqoi4y/bT+mSNNsRLt0smNFwoFc7fqrslLqgTTz1bbKIggthG1qG/NmjVvGBsbuw+VTp5URW/a0uuJIlZ/GxJBPB0idPS0XC73A66K3Z666KVbRFyrH+tOmCBeYuyFU6w7bscR85sHmVKtCOTzeavPpokgtSIfUzkiR66np+ceIsd7YzKZKjNMSUWQVPVoRWN6e3tvFjkqQImwC0HM32SMUKN6UUWQ6vjEdrYYOW7D4EmIUp0IcHGxOqatKquzTZmvZshB5LiLzk3lH7yJs4PBcNimvfQSxCZKjnVBDrMgP86xmUyohyBbbDZUBLGJZkRdQ0NDbSzIH6HaYkTJAgLj4+OjFtS8qkIEeRWKeDe4jbvH5s2bf8EVz9k3neJtkR/WWlpa/mrTExHEJpo16uLHrAWsO35JcesP16Ez0wmCDNgEQASxiWYNuogcZzMNWEXkaKuhuIpEQ2BbW1vbULQq1UuLINXxmfBsvQdZb9xA3WsR88FlMiXLCFiNHsY3EcSg4FiIGvsgzxA1TnNsKtPqmbautQ2ACGIb0Qp9EOMcOs6sN/atOKVdywhwAfqjZZVTRBDbiBb1QYx9mVKZW7hX0XFZ+IOaxZYnmokgicJfg3GIMR35HEV/BTF0Cxcg4kpEahEkLrDrsQMxTqKTnqfuuUg9Xx6hmlIDCPyugboTVtUUa0JYoh3s7e3dj+nUY9S6hagxl1wpAQTy+fyvbJsVQRpAFFLsTdS4lajxNMQ4uAFVqtogAvTB+o6Ojr4G1exQXQTZAZLJD0CKfSDHbZDit5RehghHQEgy0RdPuLCvjq0RVa5QzRDjOIjxAFWepUP0aDpAeJR+7sIXEWQSVPv7+zshxieQFyn6HYixkDzAlG6Xc7mcuaVuvZEiyE4gJVIcBinu2rp1ay9FVkAMfV0EIHxN9NPPXPgmghRRNVOoQqGwEFJ8FemHEKs49T5EyXME6Lvnuru7B1246YQg5ivkg4ODVl+ed9F4o5NbtEcSLW6AFAPj4+NmfXEmx3dDlMJBwPSbE2+dEKSZf8PDwxsYeE8y8K5lEC7esGHDLCctiKD05Zdf7iJKvAd/luPX3cgGrj73ES1OQ6x+LiaCWyraIAKsP8zXJxvUMnF1JwRpbW1dh7nVDLoDyc9mEN65cePGQQZkAXkI4txI/gkG6hIG7MFs70E5a8mQERtvQ+8y8ivI70cGRkZG1hAlvoc/5kvpx2IwiCiHn36nhL3r7Oz8kSsXnBDEOAs5Jvrgsvn69r9z7kOUWcFAvZ0Ba36BfpEBvI3BPET+LPIgci/730bM9Ofz7H+K7Usq5EqOX4/cgaxCnkb+YsiIDXPb71by87F1OGL1k5ToU/IDge/Tx1Y/1FDeLGcEYZb1nXJDtWzTUPOW3T6UPRQ5mv0TEfMOxUfYv4jtiyvkPI6fjpyAHIb8MzITUcoIAlxkI4+zKNA4I0h7e3sBR5z8uoleJSFgEBhtaWm5w2y4EmcEKTp8dzFXJgSsI0D0uJ8L8SvWFZcpdEoQGnBLmS1tCoHICExS4VuTnG/4tFOCdHV1/RkP70eUhIBtBDbMnTt3pW2llfqcEqRo7OvFXJkQsIYAsxNzh3LEmsKdKHJOkDlz5ph1yMs7sa/DQqBeBMwnlOqtW3M95wThtuw2vFEUAQQlawg8wfT9SWvaqihyTpCi7a+RG6KQKQmBhhG4vGENU6bUpCIWgrCY+hNzxntr8kiFhEAVBBhHzzGenC/OSy7EQhBjjB90PmlyiRBoEIErGqwfqXpsBOEHHfN1QaePBURquQoHhwDR489EjxvjdDw2ghQbdRG51iKAoFQXApdy02e8rpp1VoqVILD/Wfz8NqIkBCIhkET0MA7WRxBTs07J5/MX11lV1bKNwAVxRw8Dd+wEYS3yPA39ojEuEQK1IED0eJTfPRKZecROEANIc3Pzx8nN4/BkSkKgKgJjU6dOPbVqCYcnEyEIUeQVosjZDtsl1SlBgOhxzW677fZcUs1JhCCmsXPmzDEvuqw22xIhsBMECtzYWb6Tc7EcTowgpnW5XO6/uUIMm+2SKBcCJQQYH//PTMPZ++YlO9XyRAnS2dn5RwC4tJqDOpdZBFYzPm5PuvWJEsQ0nqnWZ8kfQpSEwHYEmFWsb2lp+cD2nYT/S5wgRJBt3NVaAihDCWMh854gwJhYysLc+l+srad5iRPEOG3+8AnzTS+uGMYfSaIIXMvC3JvXtL0giOkOplr3EUW+YrYdidT6j8DjjINzfXLTG4IYULhyGHB+bbYlmUOgl6nVe5BYH0acDGWvCAI4W/jV9Aic1jvsgJCVxMxhOJ/PH0X0GPCtzV4RxIAze/bsHvIjDGjkShlAgAvjsvb2dvO+kHet9Y4gBiGmWj83oJltSboR4EJ4Gf3t7Yt0XhLEDIkiaCvMtv8iD+tEYGVXV5fXrz94SxADOCRZzhXGPLNldiXpQuAH9O9i35vkNUEMeIC4jNx8fI5MKSUIPMyC3PwBI++b4z1BWIuMQZLjiSSJvDDjfQ+G5+DDuLyIfg3iIVXvCQKY2xMkOUkk2Q5FsP/Rf48SOQ6jLzeF0ohgCMIVZ5wF3fsB9mYkOyk9LX0QYiykHxN9fD0qnMEQpNQwQD6F7WsQpUAQIHLcS+Q4MjRyGHiDI4hxGpKcA+hnsO3VYwn4o7QjAl+gv44JkRymKUESxDjOdOsb5EciwcxnXrOTtQAABBZJREFU8TVLaQxSnAo5ziYP9kIWLEHMSAP8Vblc7u1s9yFKniBAdF+PK+9mWnUTedApaIIY5Ds7O5+eOnXqfLYfR5QiIOCo6DNEjAO4eJnbuY5MxKc2eIIYqMwDjnTIwWzr0RRASDCtJKIfRF+8lKAPVk2ngiAlROgY82jKIYR488dDS4eVu0dgI5ifAf6Liegb3ZuLz0KqCGJgY/H+yC677LI/HZb4FzGMPxmQx5ubm98K7uamSeqamzqCmB6aNWvWBjpsKeF+KUQx75eYwxK7CGxA3VlEjYM7OjpeYDuVKZUEKfUU4f52OvDNkOSy0jHlVhD4JlreDLZfJZ8opeZYqglieok7KluIJuadg3ns34Uo1YkAF5qnkPkQ44NIJl6LTj1BSmOBDn0JOQHCLODYk4hS7QiYd8XP4kJzAJIp7DJDkNJY4Mer1RBlPlfCY5GnSseVT4jAABeUCzgzD8xSP52inTukzBGkhABXwnuQA4oL+cQ+r1/yx6ecC8caiHE+Ps3jgnIl5Mjs4zyZJQidvz2ZhTxE2ZsBcQoD45HtB7P73w9p+mLw2B1ifM5PYuBhjCnzBClhzYC4mYFxCPvzIIr54vwf2E59oq2DNPKqfD6/F4Q4HFnJvlIRARGkCEQpY4C8BFEuId+TY4ci32AQmYfv2ExV+qGJmrR1Nm09r729/flUtc5SY0SQKkAycB5Czujq6tqVtcpCiPIlJOTHWAwpTp0+ffos2nW4iZpVmq9TICCCAEItibXKjyHK/yFv5Mp7EHU+g3h/yxNCfw8/T542bVpbkRQ3tbW16U9NAEotSQSpBaWKMlx5n2CwfRyZz9x9JoPwMMSsW1ZR9BUk9oT9zchjGDa3Y880JMa/Jgj9XvJbzOM3nFOqhsAE50SQCUCJcoi5+ysMwgcQs25ZxGCc2dzcfAADdAl6zKvBV5LfyeD9GbKG7YYSOtYij6LkNmQFdk4k3xf705F3YP8s5OuGxBxXahABEaRBACeq3tHR8RQD9E4G6jUM2gvIl5C/E9md7aYZM2a8gcjzFga3eYdlETo+wKD/CPly5FyOn0Z+PPkCjr+N9c+epo6piw6T3sX2MmQ5du4g/y3llRwgIII4AHUyla2treuIPL9ncD/O4F6F3Mqo/yL5CuRqjt9Ifjf5ao7/gvXPH0ydyfTqvH0ERBD7mEpjihAQQVLUmWqKfQRsEcS+Z9IoBDxAQATxoBPkgr8IiCD+9o088wABEcSDTpAL/iIggvjbN/LMAwQCIIgHKMmFzCIggmS269XwWhAQQWpBSWUyi4AIktmuV8NrQUAEqQUllcksAtkmSGa7XQ2vFQERpFakVC6TCIggmex2NbpWBESQWpFSuUwiIIJkstvV6FoREEFqRSpiORVPBwJ/AwAA//9UbyspAAAABklEQVQDANDOcdyyRr/1AAAAAElFTkSuQmCC';
  },

  fillThemeToggleButton(doc, btn, mode) {
    try {
      if (!btn) return;
      var iconURL = mode === 'dark' ? this.themeMoonIconURL() : this.themeSunIconURL();
      btn.textContent = '';
      btn.innerHTML = '';
      var img = doc.createElementNS('http://www.w3.org/1999/xhtml', 'img');
      img.setAttribute('alt', mode === 'dark' ? 'dark' : 'light');
      img.setAttribute('src', iconURL);
      img.style.width = '22px';
      img.style.height = '22px';
      img.style.display = 'block';
      img.style.objectFit = 'contain';
      img.style.opacity = '1';
      img.addEventListener('error', function () {
        try { btn.textContent = mode === 'dark' ? '☾' : '☀'; } catch (e) {}
      });
      btn.appendChild(img);
      btn.style.backgroundImage = 'url(' + iconURL + ')';
      btn.style.backgroundRepeat = 'no-repeat';
      btn.style.backgroundPosition = 'center';
      btn.style.backgroundSize = '22px 22px';
      btn.setAttribute('aria-label', mode === 'dark' ? 'Dark mode' : 'Light mode');
      btn.title = mode === 'dark'
        ? (this.isChineseUI() ? '当前：夜间模式，点击切换日间模式' : 'Dark mode. Click for light mode.')
        : (this.isChineseUI() ? '当前：日间模式，点击切换夜间模式' : 'Light mode. Click for dark mode.');
    } catch (e) {
      try { btn.textContent = mode === 'dark' ? '☾' : '☀'; } catch (_) {}
    }
  },

  renderThemeToggle(win) {
    try {
      var ids = this.ids;
      var p = this.panel(win);
      if (!p) return;
      var doc = p.ownerDocument;
      var root = doc.getElementById(ids.root) || p.querySelector('[data-role="wl-root"]') || p;
      var tabs = root.querySelector('[data-role="wl-tabs"]');
      if (!tabs) return;

      var actions = root.querySelector('[data-role="wl-tab-actions"]');
      if (!actions) {
        actions = this.html(doc, 'div', { dataset: { role: 'wl-tab-actions' } });
        tabs.appendChild(actions);
      }

      var btn = root.querySelector('[data-role="theme-toggle"]');
      if (!btn) {
        btn = this.smallButton(doc, '');
        btn.dataset.role = 'theme-toggle';
        btn.addEventListener('click', (event) => {
          try {
            event.preventDefault();
            event.stopPropagation();
          } catch (e) {}
          var current = this.getThemeMode(win);
          this.setThemeMode(win, current === 'dark' ? 'light' : 'dark');
        });
        actions.appendChild(btn);
      } else if (btn.parentElement !== actions) {
        actions.appendChild(btn);
      }

      var mode = this.getThemeMode(win);
      var buttons = root.querySelectorAll('[data-role="theme-toggle"]');
      for (var i = 0; i < buttons.length; i++) {
        this.fillThemeToggleButton(doc, buttons[i], mode);
      }
    } catch (e) {
      this.debug('renderThemeToggle failed: ' + e);
    }
  },

  nativeIconURL() {
    return 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
      '<rect x="2" y="2" width="20" height="20" rx="5" fill="#2d7ff9"/>' +
      '<text x="12" y="15.7" text-anchor="middle" font-size="9.5" font-family="Arial, Helvetica, sans-serif" font-weight="800" fill="white">WL</text>' +
      '</svg>'
    );
  },

  decorateNativeSectionHeader(body) {
    // Zotero's native ItemPaneManager already owns the section header.
    // Previous builds used DOM geometry guesses to inject an extra label near the
    // native WL icon.  That can accidentally touch neighboring plugin headers
    // (Translate, LLM-for-Zotero, etc.) when Zotero changes its layout, so this
    // function is intentionally kept as a no-op for plugin stability.
    return;
  },


  beginRender(win, body, reason) {
    try {
      if (!win) return 0;
      var next = (this.renderGenerationByWindow.get(win) || 0) + 1;
      this.renderGenerationByWindow.set(win, next);
      if (body) {
        body.__wlRenderGeneration = next;
        body.__wlRenderReason = reason || '';
      }
      return next;
    } catch (e) {
      return 0;
    }
  },

  currentGeneration(win) {
    try { return this.renderGenerationByWindow.get(win) || 0; } catch (e) { return 0; }
  },

  isRenderCurrent(win, generation) {
    try {
      if (!generation) return true;
      return (this.renderGenerationByWindow.get(win) || 0) === generation;
    } catch (e) {
      return true;
    }
  },

  setActivePanel(win, body, panel) {
    try {
      if (win && panel) this.activePanelByWindow.set(win, panel);
      if (body && panel) {
        body.__wordLearningPanel = panel;
        panel.__wordLearningBody = body;
      }
    } catch (e) {}
  },

  disposePanelBody(body) {
    try {
      var lifecycle = this.panelLifecycleByBody.get(body);
      if (lifecycle && typeof lifecycle.dispose === 'function') {
        lifecycle.dispose();
      }
      this.panelLifecycleByBody.delete(body);
    } catch (e) {}
  },

  createPanelLifecycle(body, panel, win) {
    var plugin = this;
    this.disposePanelBody(body);
    var disposables = [];
    var disposed = false;
    var lifecycle = {
      add: function (fn) {
        if (disposed) {
          try { fn(); } catch (e) {}
          return function () {};
        }
        disposables.push(fn);
        return function () {
          var idx = disposables.indexOf(fn);
          if (idx >= 0) disposables.splice(idx, 1);
          try { fn(); } catch (e) {}
        };
      },
      dispose: function () {
        if (disposed) return;
        disposed = true;
        var pending = disposables.splice(0).reverse();
        for (var i = 0; i < pending.length; i++) {
          try { pending[i](); } catch (e) {}
        }
        try {
          if (plugin.activePanelByWindow.get(win) === panel) {
            plugin.activePanelByWindow.delete(win);
          }
        } catch (e) {}
      }
    };
    try { this.panelLifecycleByBody.set(body, lifecycle); } catch (e) {}

    try {
      var MutationObserverCtor = win.MutationObserver || MutationObserver;
      var observer = new MutationObserverCtor(function () {
        try {
          if (!body.isConnected || !panel.isConnected) {
            observer.disconnect();
            lifecycle.dispose();
          }
        } catch (e) {}
      });
      observer.observe(body.ownerDocument, { childList: true, subtree: true });
      lifecycle.add(function () { try { observer.disconnect(); } catch (e) {} });
    } catch (e) {}

    return lifecycle;
  },

  setupPanelHandlers(win, body, panel) {
    try {
      if (!win || !body || !panel) return;
      var lifecycle = this.createPanelLifecycle(body, panel, win);
      var plugin = this;

      var clickHandler = function (event) {
        try {
          // One delegated, lifecycle-managed click controller for all dynamic
          // controls. This mirrors LLM-for-Zotero's "build UI synchronously,
          // then setupHandlers synchronously" pattern, and avoids stale
          // per-button closures after Zotero rebuilds the ItemPane.
          if (plugin.handlePanelClick(win, panel, event)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            try { plugin.panelLastInteractionByWindow.set(win, Date.now()); } catch (e) {}
          }
        } catch (e) {
          plugin.debug('delegated panel click failed: ' + e);
        }
      };
      panel.addEventListener('click', clickHandler, true);
      lifecycle.add(function () {
        try { panel.removeEventListener('click', clickHandler, true); } catch (e) {}
      });

      var inputHandler = function () {
        try { plugin.panelLastInteractionByWindow.set(win, Date.now()); } catch (e) {}
      };
      panel.addEventListener('input', inputHandler, true);
      panel.addEventListener('change', inputHandler, true);
      lifecycle.add(function () {
        try { panel.removeEventListener('input', inputHandler, true); } catch (e) {}
        try { panel.removeEventListener('change', inputHandler, true); } catch (e) {}
      });

      this.panelLastInteractionByWindow.set(win, Date.now());
    } catch (e) {
      this.debug('setupPanelHandlers failed: ' + e);
    }
  },

  handlePanelClick(win, panel, event) {
    var target = event.target;
    if (!target || !target.closest) return false;
    var button = target.closest('button');
    var termItem = target.closest('[data-term-id]');

    if (button && !panel.contains(button)) return false;
    if (termItem && !panel.contains(termItem)) return false;

    var view = this.currentViewName(panel);

    if (button) {
      if (button.dataset && button.dataset.tab) {
        this.switchTab(panel, button.dataset.tab);
        return true;
      }

      if (button.dataset && button.dataset.role === 'theme-toggle') {
        var current = this.getThemeMode(win);
        var next = current === 'dark' ? 'light' : 'dark';
        this.setThemeMode(win, next);
        this.fillThemeToggleButton(win.document, button, next);
        return true;
      }

      if (button.dataset && button.dataset.wlSubtab) {
        this.switchWordbookMode(win, button.dataset.wlSubtab);
        return true;
      }

      if (button.dataset && button.dataset.reviewCountPreset) {
        var input = panel.querySelector('[data-role="review-count"]');
        if (input) input.value = button.dataset.reviewCountPreset;
        var presets = panel.querySelectorAll('[data-review-count-preset]');
        for (var pi = 0; pi < presets.length; pi++) {
          this.activatePresetStyle(presets[pi], presets[pi] === button);
        }
        return true;
      }

      if (button.dataset && button.dataset.reviewChoice !== undefined) {
        this.answerMeaningChoice(win, button);
        return true;
      }

      if (button.dataset && button.dataset.reviewGrade) {
        this.markReview(win, button.dataset.reviewGrade);
        return true;
      }

      if (button.dataset && button.dataset.role === 'review-spelling-next') {
        this.markReview(win, 'known');
        return true;
      }

      if (button.dataset && button.dataset.role === 'allwords-sort') {
        var currentSort = this.allWordsSortByWindow.get(win) || 'az';
        this.allWordsSortByWindow.set(win, currentSort === 'az' ? 'za' : 'az');
        this.renderAllWordsList(win);
        return true;
      }

      if (button.dataset && button.dataset.role === 'wl-collapse-toggle') {
        this.setPanelCollapsed(panel, panel.dataset.collapsed !== '1');
        return true;
      }

      var label = this.buttonText(button);

      if (label === '‹' || label === '←') {
        this.moveSelection(win, -1);
        return true;
      }
      if (label === '›' || label === '→') {
        this.moveSelection(win, 1);
        return true;
      }

      if (label.indexOf('开始复习') >= 0 || label.indexOf('start review') >= 0) {
        this.startReview(win);
        return true;
      }
      if (label.indexOf('显示答案') >= 0 || label.indexOf('show answer') >= 0) {
        this.showReviewAnswer(win);
        return true;
      }

      if (label.indexOf('保存设置') >= 0 || label.indexOf('save settings') >= 0) {
        this.saveSettings(win);
        return true;
      }
      if (label.indexOf('测试连接') >= 0 || label.indexOf('test connection') >= 0) {
        this.testConnection(win, button);
        return true;
      }
      if (label.indexOf('预览发音') >= 0 || label.indexOf('preview voice') >= 0) {
        this.previewSpeechStyle(win);
        return true;
      }

      if (view === 'addword') {
        if (label.indexOf('新词') >= 0 || label.indexOf('new word') >= 0) {
          this.clearAddDraft(win);
          return true;
        }
        if (label.indexOf('llm') >= 0) {
          this.llmCompleteAdd(win, button);
          return true;
        }
        if (label.indexOf('保存') >= 0 || label === 'save') {
          this.saveAddTerm(win);
          return true;
        }
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0 || button.querySelector('svg')) {
          this.speakAddDraft(win);
          return true;
        }
      }

      if (view === 'wordbook') {
        if (label.indexOf('llm') >= 0) {
          this.llmComplete(win, button);
          return true;
        }
        if (label.indexOf('保存') >= 0 || label === 'save') {
          this.saveTerm(win);
          return true;
        }
        if (label.indexOf('删除') >= 0 || label === 'delete') {
          this.deleteTerm(win);
          return true;
        }
        if (label.indexOf('新词') >= 0 || label.indexOf('new word') >= 0) {
          this.clearDraft(win);
          this.switchWordbookMode(win, 'edit');
          return true;
        }
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0 || button.querySelector('svg')) {
          var page = target.closest('[data-wl-page]');
          if (page && page.dataset.wlPage === 'edit') this.speakDraft(win);
          else this.speakSelectedTerm(win);
          return true;
        }
      }

      if (view === 'review') {
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0 || button.querySelector('svg')) {
          this.speakReviewTerm(win);
          return true;
        }
      }
    }

    if (termItem && termItem.dataset && termItem.dataset.termId) {
      var id = termItem.dataset.termId;
      var terms = (this.panel(win)?._wlTerms || []);
      var term = terms.find(function (x) { return x.id === id; });
      this.selectedIdByWindow.set(win, id);
      this.setDraft(win, term || {});
      this.renderCard(win);
      this.renderList(win);
      this.renderAllWordsList(win);
      if (view === 'allwords') {
        this.switchTab(this.panel(win), 'wordbook');
        this.switchWordbookMode(win, 'card');
      } else {
        this.switchWordbookMode(win, 'card');
      }
      return true;
    }

    return false;
  },

  registerNativeItemPaneSection() {
    if (this.nativePanelRegistered) return true;
    try {
      if (!Zotero || !Zotero.ItemPaneManager || !Zotero.ItemPaneManager.registerSection) {
        this.debug('ItemPaneManager.registerSection unavailable; using fallback UI');
        return false;
      }
      var plugin = this;
      Zotero.ItemPaneManager.registerSection({
        paneID: this.nativePaneID,
        pluginID: this.id || 'word-learning@zotero.local',
        header: {
          label: 'Word Learning',
          l10nID: 'word-learning-panel-head',
          icon: this.nativeIconURL()
        },
        sidenav: {
          label: 'Word Learning',
          l10nID: 'word-learning-panel-sidenav-tooltip',
          icon: this.nativeIconURL()
        },
        onItemChange: function (ctx) {
          try {
            if (ctx && typeof ctx.setEnabled === 'function') {
              ctx.setEnabled(ctx.tabType === 'reader' || ctx.tabType === 'library');
            }
          } catch (e) {}
          return true;
        },
        onRender: function (ctx) {
          var body = ctx && ctx.body;
          if (!body) return;
          var win = body.ownerDocument.defaultView;
          while (body.firstChild) body.removeChild(body.firstChild);
          var panel = plugin.html(body.ownerDocument, 'div', {
            id: plugin.ids.panel,
            dataset: { native: '1', embedded: '1' },
            styleObj: {
              position: 'relative',
              width: '100%',
              height: '100%',
              minHeight: '420px',
              overflow: 'hidden',
              background: 'Canvas',
              color: 'CanvasText',
              fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
              fontSize: '13px',
              lineHeight: '1.45'
            }
          });
          var generation = plugin.beginRender(win, body, 'native-onRender');
          body.appendChild(panel);
          plugin.setActivePanel(win, body, panel);
          plugin.installThemeStyles(win, panel);
          plugin.buildPanel(win, panel);
          plugin.setupPanelHandlers(win, body, panel);
          panel.__wlRenderGeneration = generation;
          plugin.renderThemeToggle(win);
          plugin.setupThemeWatcher(win, panel);
          plugin.decorateNativeSectionHeader(body);
          // Zotero already provides native header/collapse/sidenav. Remove our
          // internal header so the panel behaves like Translate/LLM-for-Zotero.
          var internalHeader = panel.querySelector('[data-role="wl-section-header"]');
          if (internalHeader && internalHeader.parentNode) {
            internalHeader.parentNode.removeChild(internalHeader);
          }
          var root = panel.querySelector('[data-role="wl-root"]');
          if (root) {
            root.style.height = '100%';
            root.style.background = 'Canvas';
          }
          var bodyNode = panel.querySelector('[data-role="wl-body"]');
          if (bodyNode) {
            bodyNode.style.flex = '1';
            bodyNode.style.maxHeight = '';
            bodyNode.style.overflow = 'auto';
          }
          plugin.loadSettings(win);
          plugin.normalizeDarkElements(win, panel);
          plugin.normalizeDarkSpecificWidgets(win, panel);
        },
        onAsyncRender: async function (ctx) {
          try {
            var body = ctx && ctx.body;
            var win = body && body.ownerDocument ? body.ownerDocument.defaultView : plugin.getMainWindow();
            if (!win || !body) return;

            var currentPanel = body.querySelector('#' + plugin.ids.panel);
            if (currentPanel) {
              plugin.setActivePanel(win, body, currentPanel);
              plugin.setupPanelHandlers(win, body, currentPanel);
            }

            var generation = body.__wlRenderGeneration || plugin.currentGeneration(win);
            await plugin.refreshTerms(win, generation);
            if (!plugin.isRenderCurrent(win, generation)) return;

            if (plugin.lastSelectionPayload && win) {
              var p = plugin.panel(win);
              if (p) plugin.switchTab(p, 'addword');
              plugin.setAddDraft(win, { text: plugin.lastSelectionPayload.text, example: plugin.lastSelectionPayload.text });
            }
          } catch (e) {
            plugin.debug('native onAsyncRender failed: ' + e);
          }
        }
      });
      this.nativePanelRegistered = true;
      try {
        var pluginRef = this;
        var winRef = this.getMainWindow();
        if (winRef) {
          winRef.setTimeout(function () {
            try {
              if (pluginRef.nativePanelRegistered && !winRef.document.getElementById(pluginRef.ids.panel)) {
                pluginRef.debug('native section registered but not rendered yet; keeping native mode without manual injection');
              }
            } catch (e) {}
          }, 2500);
        }
      } catch (e) {}
      this.debug('registered native ItemPaneManager section');
      return true;
    } catch (e) {
      this.nativePanelRegistered = false;
      this.debug('registerNativeItemPaneSection failed: ' + e);
      return false;
    }
  },

  unregisterNativeItemPaneSection() {
    var ids = [];
    try {
      if (this.nativePaneID) ids.push(this.nativePaneID);
      ids.push('word-learning-item-pane');
      ids.push('word-learning');
    } catch (e) {}

    try {
      if (Zotero && Zotero.ItemPaneManager) {
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          if (!id) continue;
          try {
            if (typeof Zotero.ItemPaneManager.unregisterSection === 'function') {
              Zotero.ItemPaneManager.unregisterSection(id);
            } else if (typeof Zotero.ItemPaneManager.unregister === 'function') {
              Zotero.ItemPaneManager.unregister(id);
            } else if (typeof Zotero.ItemPaneManager.removeSection === 'function') {
              Zotero.ItemPaneManager.removeSection(id);
            }
          } catch (e) {
            // Zotero may already have removed the section during extension reload.
            // Do not let this break shutdown or other plugins.
            this.debug('safe native ItemPane unregister ignored for ' + id + ': ' + e);
          }
        }
      }
    } catch (e2) {
      this.debug('safe native ItemPane unregister outer error: ' + e2);
    }

    this.nativePanelRegistered = false;
    try { this.activePanelByWindow = new WeakMap(); } catch (e3) {}
  },

  getMainWindow() {
    try {
      return Zotero && Zotero.getMainWindow ? Zotero.getMainWindow() : null;
    } catch (e) {
      return null;
    }
  },

  getWindows() {
    var wins = [];
    try {
      var enumerator = Services.wm.getEnumerator('navigator:browser');
      while (enumerator.hasMoreElements()) {
        var win = enumerator.getNext();
        if (win && win.document) {
          wins.push(win);
        }
      }
    } catch (e) {}
    var main = this.getMainWindow();
    if (main && wins.indexOf(main) < 0) {
      wins.push(main);
    }
    return wins;
  },

  addToAllWindows() {
    var wins = this.getWindows();
    for (var i = 0; i < wins.length; i++) {
      this.addToWindow(wins[i]);
    }
  },

  removeFromAllWindows() {
    var wins = this.getWindows();
    for (var i = 0; i < wins.length; i++) {
      this.removeFromWindow(wins[i]);
    }
  },

  addToWindow(win) {
    if (!win || !win.document) {
      return;
    }
    this.removeFromWindow(win);
    this.exposeHost(win);
    this.injectToolsMenu(win);
    if (!this.nativePanelRegistered) {
      // Fallback only. Normal Zotero 7+ path is ItemPaneManager.registerSection().
      this.injectButton(win);
      this.ensurePanel(win);
    }
  },

  removeFromWindow(win) {
    if (!win || !win.document) {
      return;
    }
    var doc = win.document;
    var ids = [this.ids.button, this.ids.panel, this.ids.menu];
    for (var i = 0; i < ids.length; i++) {
      var node = doc.getElementById(ids[i]);
      if (node && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    try {
      delete win.WordLearningPluginHost;
    } catch (e) {
      win.WordLearningPluginHost = null;
    }
  },

  html(doc, tag, props, text) {
    var el = doc.createElementNS('http://www.w3.org/1999/xhtml', tag);
    props = props || {};
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) {
        continue;
      }
      var v = props[k];
      if (k === 'className') {
        el.setAttribute('class', v);
      } else if (k === 'styleObj') {
        for (var sk in v) {
          if (Object.prototype.hasOwnProperty.call(v, sk)) {
            el.style[sk] = v[sk];
          }
        }
      } else if (k === 'dataset') {
        for (var dk in v) {
          if (Object.prototype.hasOwnProperty.call(v, dk)) {
            el.dataset[dk] = v[dk];
          }
        }
      } else if (k.substring(0, 2) === 'on' && typeof v === 'function') {
        el.addEventListener(k.substring(2), v);
      } else if (v !== null && v !== undefined) {
        el.setAttribute(k, String(v));
      }
    }
    if (text !== undefined && text !== null) {
      el.textContent = String(text);
    }
    return el;

  },

  isChineseUI() {
    try {
      var lang = Zotero.Prefs.get('extensions.word-learning.language') || 'zh-CN';
      return String(lang).toLowerCase().indexOf('zh') === 0;
    } catch (e) {
      return true;
    }
  },

  t(key) {
    var zh = this.isChineseUI();
    var dict = {
      wordbook: ['词库', 'Wordbook'],
      addWord: ['添加单词', 'Add Word'],
      review: ['复习', 'Review'],
      settings: ['设置', 'Settings'],
      allWords: ['全部词汇', 'All Words'],
      cardView: ['单词卡片', 'Word Card'],
      editWord: ['修改单词', 'Edit Word'],
      newWord: ['新词', 'New Word'],
      llmComplete: ['LLM 补全', 'LLM Complete'],
      save: ['保存', 'Save'],
      delete: ['删除', 'Delete'],
      speak: ['发音', 'Speak'],
      wordPhrase: ['单词/短语', 'Word/Phrase'],
      example: ['例句', 'Example'],
      pronunciation: ['音标', 'Pronunciation'],
      meaning: ['释义', 'Meaning'],
      context: ['上下文解释', 'Context'],
      phrases: ['相关短语', 'Phrases'],
      searchWords: ['搜索单词', 'Search words'],
      allWordsList: ['全部词汇列表', 'All Words List'],
      sortAZ: ['⇅ A-Z', '⇅ A-Z'],
      sortZA: ['⇅ Z-A', '⇅ Z-A'],
      ready: ['就绪。', 'Ready.'],
      addReady: ['添加新词：填写内容，可使用 LLM 补全，然后保存。', 'Add a new word: fill fields, LLM Complete if needed, then Save.'],
      editReady: ['修改当前词条：编辑后点击保存。', 'Edit current word: change fields, then Save.'],
      noWord: ['未选择单词', 'No word selected'],
      relatedPhrases: ['相关短语', 'Related phrases'],
      noPhrases: ['暂无相关短语。', 'No related phrases.'],
      chineseSimplified: ['中文（简）', 'Chinese (Simplified)'],
      english: ['English', 'English'],
      language: ['语言', 'Language'],
      provider: ['服务商', 'Provider'],
      saveSettings: ['保存设置', 'Save Settings'],
      testConnection: ['测试连接', 'Test connection'],
      thinkingIntensity: ['思考强度', 'Thinking intensity'],
      thinkingDefault: ['默认', 'Default'],
      thinkingLow: ['低', 'Low'],
      thinkingMedium: ['中', 'Medium'],
      thinkingHigh: ['高', 'High'],
      databasePath: ['数据库保存路径', 'Database path'],
      defaultDatabasePath: ['默认数据库路径', 'Default database path'],
      customDatabasePathHint: ['可自定义完整 JSON 文件路径；留空则使用默认路径。', 'Use a custom full JSON file path, or leave blank for the default path.'],
      speechStyle: ['发音风格', 'Speech style'],
      speechPreview: ['预览发音', 'Preview voice'],
      speechAutoFemale: ['自动优先女声', 'Auto female'],
      speechAutoMale: ['自动优先男声', 'Auto male'],
      speechNatural: ['自然清晰', 'Natural clear'],
      speechSlow: ['慢速清晰', 'Slow clear'],
      speechSystem: ['系统默认', 'System default']
    };
    var v = dict[key] || [key, key];
    return zh ? v[0] : v[1];
  },

  cssButton() {
    // Fallback flat launcher when no Zotero right icon rail is found.
    return {
      position: 'fixed',
      right: '7px',
      top: '170px',
      zIndex: '2147483646',
      width: '30px',
      height: '30px',
      minWidth: '30px',
      minHeight: '30px',
      padding: '0',
      borderRadius: '7px',
      border: '1px solid rgba(45,127,249,.28)',
      background: '#2d7ff9',
      color: '#fff',
      fontWeight: '700',
      boxShadow: 'none',
      cursor: 'pointer',
      pointerEvents: 'auto',
      fontSize: '11px',
      lineHeight: '30px',
      textAlign: 'center'
    };
  },

  cssRailButton() {
    // Icon-rail mode: behave like a compact right-toolbar button, not a floating tab.
    return {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      minWidth: '28px',
      minHeight: '28px',
      margin: '3px auto',
      padding: '0',
      borderRadius: '6px',
      border: '1px solid rgba(45,127,249,.26)',
      background: '#2d7ff9',
      color: '#fff',
      fontWeight: '700',
      boxShadow: 'none',
      cursor: 'pointer',
      pointerEvents: 'auto',
      fontSize: '10px',
      lineHeight: '28px',
      textAlign: 'center'
    };
  },

  findIconRail(win) {
    var doc = win.document;
    var width = 0, height = 0;
    try {
      width = win.innerWidth || doc.documentElement.clientWidth || 0;
      height = win.innerHeight || doc.documentElement.clientHeight || 0;
    } catch (e) {}

    function visibleRail(plugin, n) {
      if (!n || !n.appendChild || n.id === plugin.ids.button || n.id === plugin.ids.panel) return false;
      try {
        var r = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
        if (!r || r.width < 18 || r.width > 72 || r.height < 160) return false;
        if (width && r.left < width * 0.55) return false;
        var cs = win.getComputedStyle ? win.getComputedStyle(n) : null;
        if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
        return true;
      } catch (e) {
        return false;
      }
    }

    function scoreRail(n) {
      var score = 0;
      try {
        score += n.querySelectorAll('button, toolbarbutton, [role="button"], svg, img').length * 2;
        var txt = (n.textContent || '').trim();
        if (txt.length < 20) score += 4;
      } catch (e) {}
      try {
        var r = n.getBoundingClientRect();
        score += Math.max(0, r.left / 100);
      } catch (e) {}
      return score;
    }

    // First try point scanning around the exact right icon column. This is more
    // reliable than class names because Zotero and plugins use unstable DOM names.
    var pointCandidates = [];
    try {
      var xs = [width - 18, width - 28, width - 38, width - 48].filter(function (x) { return x > 0; });
      var ys = [];
      for (var y = 72; y < Math.max(120, height - 80); y += 32) ys.push(y);
      for (var xi = 0; xi < xs.length; xi++) {
        for (var yi = 0; yi < ys.length; yi++) {
          var stack = doc.elementsFromPoint ? doc.elementsFromPoint(xs[xi], ys[yi]) : [];
          for (var si = 0; si < stack.length; si++) {
            var el = stack[si];
            var cur = el;
            for (var depth = 0; cur && depth < 7; depth++, cur = cur.parentElement) {
              if (visibleRail(this, cur)) pointCandidates.push(cur);
            }
          }
        }
      }
    } catch (e) {}

    var best = null, bestScore = -1;
    for (var p = 0; p < pointCandidates.length; p++) {
      var sc = scoreRail(pointCandidates[p]);
      if (sc > bestScore) {
        best = pointCandidates[p];
        bestScore = sc;
      }
    }
    if (best) return best;

    // Selector/geometry fallback.
    var nodes = [];
    try { nodes = Array.prototype.slice.call(doc.querySelectorAll('div, vbox, hbox, toolbar, section, aside')); } catch (e) { nodes = []; }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!visibleRail(this, n)) continue;
      var count = 0;
      try { count = n.querySelectorAll('button, toolbarbutton, [role="button"], svg, img').length; } catch (e) { count = 0; }
      if (count < 2) continue;
      var s = scoreRail(n);
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    }
    return best;
  },

  injectButton(win) {
    var doc = win.document;
    var rail = this.findIconRail(win);
    var button = this.html(doc, 'button', {
      id: this.ids.button,
      type: 'button',
      title: 'Word Learning',
      styleObj: rail ? this.cssRailButton() : this.cssButton()
    }, 'WL');
    var plugin = this;
    var handler = function (event) {
      plugin.debug('WL button click');
      try {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
      } catch (e) {}
      plugin.togglePanel(win);
      return false;
    };
    button.addEventListener('click', handler, true);
    if (rail) {
      try {
        button.dataset.railButton = '1';
        rail.appendChild(button);
        return;
      } catch (e) {}
    }
    doc.documentElement.appendChild(button);
  },

  injectToolsMenu(win) {
    var doc = win.document;
    var toolsPopup = doc.getElementById('menu_ToolsPopup');
    if (!toolsPopup || !doc.createXULElement) {
      return;
    }
    var item = doc.createXULElement('menuitem');
    item.id = this.ids.menu;
    item.setAttribute('label', 'Word Learning');
    var plugin = this;
    item.addEventListener('command', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      plugin.showPanel(win);
    });
    toolsPopup.appendChild(item);
  },

  panelStyle(embedded) {
    if (embedded) {
      // Stackable right-sidebar section. This is intentionally NOT height:100%,
      // so it can coexist with Translate, LLM-for-Zotero, and Zotero's own sections.
      return {
        position: 'relative',
        width: '100%',
        minWidth: '0',
        maxWidth: 'none',
        maxHeight: '640px',
        zIndex: 'auto',
        background: '#ffffff',
        color: '#111827',
        border: '0',
        borderTop: '1px solid #e5e7eb',
        borderRadius: '0',
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'none',
        margin: '0',
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        fontSize: '13px',
        lineHeight: '1.45'
      };
    }
    // Fallback: docked-sidebar visual mode when Zotero sidebar host is not found.
    return {
      position: 'fixed',
      right: '44px',
      top: '70px',
      bottom: '0px',
      width: '420px',
      maxWidth: '34vw',
      minWidth: '360px',
      zIndex: '2147483645',
      background: '#ffffff',
      color: '#111827',
      border: '1px solid rgba(0,0,0,.14)',
      borderRight: '0',
      borderRadius: '10px 0 0 10px',
      boxShadow: '-2px 0 10px rgba(0,0,0,.12)',
      overflow: 'hidden',
      display: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontSize: '13px',
      lineHeight: '1.45'
    };
  },

  sidebarHostCandidates(win) {
    var doc = win.document;
    return [
      // Zotero 7 Reader/context pane candidates. These names vary across builds,
      // so we try several conservative selectors and verify geometry below.
      '#zotero-context-pane',
      '#context-pane',
      '#item-pane',
      '#zotero-item-pane',
      '#zotero-reader-sidebar',
      '#reader-sidebar',
      '.context-pane',
      '.zotero-context-pane',
      '.reader-sidebar',
      '.sidebar-pane',
      '[data-pane="context"]',
      '[data-l10n-id="context-pane"]'
    ].map(function (sel) {
      try { return doc.querySelector(sel); } catch (e) { return null; }
    }).filter(Boolean);
  },

  findSidebarHost(win) {
    var doc = win.document;
    var candidates = this.sidebarHostCandidates(win);
    var width = 0;
    try { width = win.innerWidth || doc.documentElement.clientWidth || 0; } catch (e) {}

    var plugin = this;
    function rect(n) {
      try { return n && n.getBoundingClientRect ? n.getBoundingClientRect() : null; } catch (e) { return null; }
    }
    function visible(n) {
      try {
        var cs = win.getComputedStyle ? win.getComputedStyle(n) : null;
        return !(cs && (cs.display === 'none' || cs.visibility === 'hidden'));
      } catch (e) { return true; }
    }
    function usable(n) {
      if (!n || !n.appendChild || n.id === plugin.ids.panel || n.id === plugin.ids.button) return false;
      var r = rect(n);
      if (!r || r.width < 260 || r.width > 620 || r.height < 260) return false;
      if (width && r.left < width * 0.48) return false;
      if (!visible(n)) return false;
      return true;
    }
    function normalizeContainer(n) {
      // Do not mount inside another plugin's content area. Climb to the
      // scroll/content container that owns multiple right-pane sections.
      if (!n) return null;
      var current = n;
      for (var depth = 0; current && current.parentElement && depth < 8; depth++) {
        var r = rect(current);
        var p = current.parentElement;
        var pr = rect(p);
        if (!r || !pr) break;
        var parentUsable = p.appendChild && pr.width >= 260 && pr.width <= 660 &&
          (!width || pr.left > width * 0.45) && pr.height >= r.height * 0.75 && visible(p);
        if (!parentUsable) break;

        var pluginish = false;
        try {
          var text = (current.textContent || '').slice(0, 120).toLowerCase();
          pluginish = /llm-for-zotero|translate|翻译|word learning/.test(text);
        } catch (e) {}
        var widthSimilar = Math.abs(pr.width - r.width) < 80;
        var parentHasSections = false;
        try {
          var childCount = Array.prototype.slice.call(p.children || []).filter(function (ch) {
            var cr = rect(ch);
            return cr && cr.width > 220 && cr.height > 22 && visible(ch);
          }).length;
          parentHasSections = childCount >= 2;
        } catch (e) {}

        if (widthSimilar && (pluginish || parentHasSections || depth < 2)) {
          current = p;
          continue;
        }
        break;
      }
      return current;
    }

    // Prefer known context pane candidates, but normalize upward so Word Learning
    // is appended as a sibling section rather than inside Translate/LLM-for-Zotero.
    for (var i = 0; i < candidates.length; i++) {
      if (usable(candidates[i])) {
        return normalizeContainer(candidates[i]);
      }
    }

    // Geometry fallback: choose the rightmost visible content pane; normalize upward.
    var all = [];
    try { all = Array.prototype.slice.call(doc.querySelectorAll('div, section, aside, vbox, hbox')); } catch (e) { all = []; }
    var best = null;
    var bestScore = -Infinity;
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      if (!usable(el)) continue;
      try {
        var rr = rect(el);
        var score = rr.left * 2 + Math.min(rr.height, 900) - Math.abs(rr.width - 360);
        var text = (el.textContent || '').slice(0, 160).toLowerCase();
        // Penalize selecting a plugin's inner body.
        if (/llm-for-zotero|translate|翻译/.test(text)) score -= 100;
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      } catch (e) {}
    }
    return normalizeContainer(best);
  },

  ensurePanel(win) {
    var doc = win.document;
    var panel = doc.getElementById(this.ids.panel);
    if (panel) {
      return panel;
    }

    var host = this.findSidebarHost(win);
    var embedded = !!host;
    panel = this.html(doc, 'div', { id: this.ids.panel, styleObj: this.panelStyle(embedded) });
    panel.dataset.embedded = embedded ? '1' : '0';
    var generation = this.beginRender(win, panel, 'fallback-ensurePanel');
    this.buildPanel(win, panel);
    panel.__wlRenderGeneration = generation;

    if (embedded) {
      try {
        panel.style.height = 'auto';
        panel.style.maxHeight = Math.max(420, Math.min(720, Math.floor((host.getBoundingClientRect().height || 620) - 24))) + 'px';
      } catch (e) {
        panel.style.maxHeight = '640px';
      }
      // Append as a sibling-like section in the right pane, not inside another
      // plugin's body. findSidebarHost() normalizes to the shared section container.
      host.appendChild(panel);
    } else {
      doc.documentElement.appendChild(panel);
    }

    this.setActivePanel(win, panel, panel);
    this.setupPanelHandlers(win, panel, panel);
    this.installThemeStyles(win, panel);
    this.normalizeDarkElements(win, panel);
    this.normalizeDarkSpecificWidgets(win, panel);
    this.setupThemeWatcher(win, panel);
    this.loadSettings(win);
    this.refreshTerms(win, generation);
    return panel;
  },

  buildPanel(win, panel) {
    var doc = win.document;
    var plugin = this;
    var embedded = panel.dataset.embedded === '1';
    var root = this.html(doc, 'div', {
      dataset: { role: 'wl-root' },
      styleObj: {
        height: embedded ? 'auto' : '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'Canvas'
      }
    });
    panel.appendChild(root);
    // Event handlers are installed by setupPanelHandlers() immediately after buildPanel().

    var header = this.html(doc, 'div', {
      dataset: { role: 'wl-section-header' },
      styleObj: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: embedded ? '6px 8px' : '10px 12px',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        minHeight: embedded ? '30px' : '42px',
        cursor: embedded ? 'pointer' : 'default'
      }
    });

    var arrow = this.html(doc, 'button', {
      type: 'button',
      title: embedded ? (this.isChineseUI() ? '展开/收起' : 'Expand/Collapse') : '',
      dataset: { role: 'wl-collapse-toggle' },
      styleObj: {
        width: '22px',
        height: '22px',
        minWidth: '22px',
        padding: '0',
        border: '0',
        background: 'transparent',
        color: '#6b7280',
        cursor: 'pointer',
        fontSize: '14px',
        lineHeight: '22px',
        display: embedded ? 'inline-flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, '⌄');
    header.appendChild(arrow);
    header.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', fontSize: embedded ? '13px' : '14px' } }, 'Word Learning'));
    header.appendChild(this.html(doc, 'div', { styleObj: { flex: '1' } }));
    var status = this.html(doc, 'div', { dataset: { role: 'top-status' }, styleObj: { color: '#6b7280', fontSize: '12px' } }, (this.version || '0.9.7') + ' loaded');
    header.appendChild(status);
    var close = this.smallButton(doc, 'x');
    close.textContent = embedded ? '−' : '×';
    close.title = embedded ? (this.isChineseUI() ? '收起此栏' : 'Collapse section') : (this.isChineseUI() ? '关闭' : 'Close');
    close.style.width = embedded ? '24px' : close.style.width;
    close.style.minWidth = embedded ? '24px' : close.style.minWidth;
    close.style.height = embedded ? '24px' : close.style.height;
    close.style.minHeight = embedded ? '24px' : close.style.minHeight;
    close.style.padding = embedded ? '0' : close.style.padding;
    close.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      if (panel.dataset.embedded === '1') plugin.setPanelCollapsed(panel, true);
      else plugin.hidePanel(win);
    });
    header.appendChild(close);
    root.appendChild(header);

    var tabs = this.html(doc, 'div', { dataset: { role: 'wl-tabs' }, styleObj: { display: 'flex', gap: '6px', padding: '8px 10px', background: '#fff', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' } });
    var names = [['addword', this.t('addWord')], ['wordbook', this.t('cardView')], ['allwords', this.t('allWords')], ['review', this.t('review')], ['settings', this.t('settings')]];
    for (var i = 0; i < names.length; i++) {
      var tab = this.smallButton(doc, names[i][1]);
      tab.dataset.tab = names[i][0];
      if (i === 0) this.activateTabStyle(tab, true);
      tab.addEventListener('click', function (event) {
        try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
        plugin.switchTab(panel, event.currentTarget.dataset.tab);
      });
      tabs.appendChild(tab);
    }

    var tabActions = this.html(doc, 'div', { dataset: { role: 'wl-tab-actions' } });
    var themeToggle = this.smallButton(doc, '');
    themeToggle.dataset.role = 'theme-toggle';
    themeToggle.title = this.isChineseUI() ? '切换日间/夜间模式' : 'Toggle light/dark mode';
    themeToggle.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      var current = plugin.getThemeMode(win);
      var next = current === 'dark' ? 'light' : 'dark';
      plugin.setThemeMode(win, next);
      plugin.fillThemeToggleButton(doc, themeToggle, next);
    });
    tabActions.appendChild(themeToggle);
    tabs.appendChild(tabActions);
    this.fillThemeToggleButton(doc, themeToggle, this.getThemeMode(win));

    root.appendChild(tabs);
    this.renderThemeToggle(win);

    var body = this.html(doc, 'div', { dataset: { role: 'wl-body' }, styleObj: { flex: embedded ? '0 1 auto' : '1', overflow: 'auto', padding: embedded ? '10px' : '12px', maxHeight: embedded ? '560px' : '' } });
    root.appendChild(body);
    body.appendChild(this.wordbookView(win));
    body.appendChild(this.addWordView(win));
    body.appendChild(this.allWordsView(win));
    body.appendChild(this.reviewView(win));
    body.appendChild(this.settingsView(win));

    var toggle = function (event) {
      if (!embedded) return;
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      plugin.setPanelCollapsed(panel, panel.dataset.collapsed !== '1');
    };
    arrow.addEventListener('click', toggle);
    header.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      toggle(event);
    });
    if (embedded) this.setPanelCollapsed(panel, false);
  },


  installIdleRescueHandlers(win, panel) {
    // Deprecated in 0.9.7. Kept for compatibility with older call sites.
    // The plugin now uses setupPanelHandlers(), a lifecycle-managed delegated
    // event controller installed synchronously on every ItemPane render.
    try { if (win) this.panelLastInteractionByWindow.set(win, Date.now()); } catch (e) {}
  },

  currentViewName(panel) {
    try {
      var views = panel.querySelectorAll('[data-view]');
      for (var i = 0; i < views.length; i++) {
        if (views[i].style.display !== 'none') return views[i].dataset.view || '';
      }
    } catch (e) {}
    return this.currentView || 'addword';
  },

  buttonText(button) {
    try {
      return String(button && button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    } catch (e) {}
    return '';
  },

  handleRescueClick(win, panel, event) {
    var target = event.target;
    if (!target || !target.closest) return false;
    var button = target.closest('button');
    var termItem = target.closest('[data-term-id]');
    var view = this.currentViewName(panel);

    if (button) {
      if (button.dataset && button.dataset.tab) {
        this.switchTab(panel, button.dataset.tab);
        return true;
      }

      if (button.dataset && button.dataset.role === 'theme-toggle') {
        var current = this.getThemeMode(win);
        var next = current === 'dark' ? 'light' : 'dark';
        this.setThemeMode(win, next);
        this.fillThemeToggleButton(win.document, button, next);
        return true;
      }

      if (button.dataset && button.dataset.wlSubtab) {
        this.switchWordbookMode(win, button.dataset.wlSubtab);
        return true;
      }

      if (button.dataset && button.dataset.reviewCountPreset) {
        var input = panel.querySelector('[data-role="review-count"]');
        if (input) input.value = button.dataset.reviewCountPreset;
        var presets = panel.querySelectorAll('[data-review-count-preset]');
        for (var pi = 0; pi < presets.length; pi++) {
          this.activatePresetStyle(presets[pi], presets[pi] === button);
        }
        return true;
      }

      if (button.dataset && button.dataset.reviewChoice !== undefined) {
        this.answerMeaningChoice(win, button);
        return true;
      }

      if (button.dataset && button.dataset.reviewGrade) {
        this.markReview(win, button.dataset.reviewGrade);
        return true;
      }

      if (button.dataset && button.dataset.role === 'review-spelling-next') {
        this.markReview(win, 'known');
        return true;
      }

      if (button.dataset && button.dataset.role === 'allwords-sort') {
        var currentSort = this.allWordsSortByWindow.get(win) || 'az';
        this.allWordsSortByWindow.set(win, currentSort === 'az' ? 'za' : 'az');
        this.renderAllWordsList(win);
        return true;
      }

      var label = this.buttonText(button);

      if (label === '‹' || label === '←') {
        this.moveSelection(win, -1);
        return true;
      }
      if (label === '›' || label === '→') {
        this.moveSelection(win, 1);
        return true;
      }

      if (label.indexOf('开始复习') >= 0 || label.indexOf('start review') >= 0) {
        this.startReview(win);
        return true;
      }
      if (label.indexOf('显示答案') >= 0 || label.indexOf('show answer') >= 0) {
        this.showReviewAnswer(win);
        return true;
      }

      if (label.indexOf('保存设置') >= 0 || label.indexOf('save settings') >= 0) {
        this.saveSettings(win);
        return true;
      }
      if (label.indexOf('测试连接') >= 0 || label.indexOf('test connection') >= 0) {
        this.testConnection(win, button);
        return true;
      }
      if (label.indexOf('预览发音') >= 0 || label.indexOf('preview voice') >= 0) {
        this.previewSpeechStyle(win);
        return true;
      }

      if (view === 'addword') {
        if (label.indexOf('新词') >= 0 || label.indexOf('new word') >= 0) {
          this.clearAddDraft(win);
          return true;
        }
        if (label.indexOf('llm') >= 0) {
          this.llmCompleteAdd(win, button);
          return true;
        }
        if (label.indexOf('保存') >= 0 || label === 'save') {
          this.saveAddTerm(win);
          return true;
        }
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0) {
          this.speakAddDraft(win);
          return true;
        }
      }

      if (view === 'wordbook') {
        if (label.indexOf('llm') >= 0) {
          this.llmComplete(win, button);
          return true;
        }
        if (label.indexOf('保存') >= 0 || label === 'save') {
          this.saveTerm(win);
          return true;
        }
        if (label.indexOf('删除') >= 0 || label === 'delete') {
          this.deleteTerm(win);
          return true;
        }
        if (label.indexOf('新词') >= 0 || label.indexOf('new word') >= 0) {
          this.clearDraft(win);
          this.switchWordbookMode(win, 'edit');
          return true;
        }
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0 || button.querySelector('svg')) {
          var page = target.closest('[data-wl-page]');
          if (page && page.dataset.wlPage === 'edit') this.speakDraft(win);
          else this.speakSelectedTerm(win);
          return true;
        }
      }

      if (view === 'review') {
        if (label.indexOf('发音') >= 0 || label.indexOf('speak') >= 0 || label.indexOf('🔊') >= 0 || button.querySelector('svg')) {
          this.speakReviewTerm(win);
          return true;
        }
      }
    }

    if (termItem && termItem.dataset && termItem.dataset.termId) {
      var id = termItem.dataset.termId;
      var term = (this.panel(win)._wlTerms || []).find(function (x) { return x.id === id; });
      this.selectedIdByWindow.set(win, id);
      this.setDraft(win, term || {});
      this.renderCard(win);
      this.renderList(win);
      this.renderAllWordsList(win);
      if (view === 'allwords') {
        this.switchTab(this.panel(win), 'wordbook');
        this.switchWordbookMode(win, 'card');
      } else {
        this.switchWordbookMode(win, 'card');
      }
      return true;
    }

    return false;
  },

  setPanelCollapsed(panel, collapsed) {
    if (!panel) return;
    panel.dataset.collapsed = collapsed ? '1' : '0';
    var tabs = panel.querySelector('[data-role="wl-tabs"]');
    var body = panel.querySelector('[data-role="wl-body"]');
    var arrow = panel.querySelector('[data-role="wl-collapse-toggle"]');
    if (tabs) tabs.style.display = collapsed ? 'none' : 'flex';
    if (body) body.style.display = collapsed ? 'none' : 'block';
    if (arrow) arrow.textContent = collapsed ? '›' : '⌄';
  },

  controlBaseStyle() {
    return {
      boxSizing: 'border-box',
      minHeight: '34px',
      height: '34px',
      fontSize: '13px',
      lineHeight: '18px',
      verticalAlign: 'middle'
    };
  },

  smallButton(doc, text) {
    return this.html(doc, 'button', {
      type: 'button',
      styleObj: {
        border: '1px solid #d1d5db',
        background: '#fff',
        borderRadius: '8px',
        padding: '0 12px',
        cursor: 'pointer',
        fontSize: '13px',
        lineHeight: '18px',
        height: '34px',
        minHeight: '34px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        appearance: 'none',
        WebkitAppearance: 'none',
        verticalAlign: 'middle'
      }
    }, text);
  },

  primaryButton(doc, text) {
    var b = this.smallButton(doc, text);
    b.dataset.primary = '1';
    b.classList.add('wl-primary');
    b.style.background = '#2d7ff9';
    b.style.borderColor = '#2d7ff9';
    b.style.color = '#fff';
    return b;
  },

  dangerButton(doc, text) {
    var b = this.smallButton(doc, text);
    b.style.color = '#b91c1c';
    b.style.borderColor = '#fecaca';
    return b;
  },

  iconButton(doc, title) {
    var b = this.html(doc, 'button', {
      type: 'button',
      title: title || '',
      styleObj: {
        width: '28px',
        height: '28px',
        minWidth: '28px',
        minHeight: '28px',
        padding: '0',
        border: '0',
        borderRadius: '999px',
        background: 'transparent',
        color: '#2563eb',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        appearance: 'none',
        WebkitAppearance: 'none',
        verticalAlign: 'middle'
      }
    });
    b.addEventListener('mouseenter', function () { b.style.background = '#eff6ff'; });
    b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
    return b;
  },

  speakerButton(doc, title) {
    var b = this.iconButton(doc, title || 'Read aloud');
    var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var p1 = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute('d', 'M11 5 6 9H3v6h3l5 4V5Z');
    var p2 = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M15.5 8.5a5 5 0 0 1 0 7');
    var p3 = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    p3.setAttribute('d', 'M18.5 5.5a9 9 0 0 1 0 13');
    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    b.appendChild(svg);
    return b;
  },

  activateTabStyle(tab, active) {
    // Keep active/inactive tab geometry identical; only colors change.
    // This avoids the visual issue where Wordbook / Review / Settings look
    // like differently shaped buttons after switching states.
    tab.style.borderRadius = '999px';
    tab.style.height = '34px';
    tab.style.minHeight = '34px';
    tab.style.minWidth = '72px';
    tab.style.padding = '0 14px';
    tab.style.display = 'inline-flex';
    tab.style.alignItems = 'center';
    tab.style.justifyContent = 'center';
    tab.style.boxSizing = 'border-box';
    tab.style.lineHeight = '18px';
    tab.style.fontSize = '13px';
    tab.style.fontWeight = '600';
    tab.style.borderWidth = '1px';
    tab.style.borderStyle = 'solid';
    tab.style.appearance = 'none';
    tab.style.WebkitAppearance = 'none';
    tab.dataset.wlActive = active ? '1' : '0';
    tab.classList.toggle('wl-active', !!active);
    if (active) {
      tab.style.background = '#2d7ff9';
      tab.style.borderColor = '#2d7ff9';
      tab.style.color = '#fff';
    } else {
      tab.style.background = '#fff';
      tab.style.borderColor = '#d1d5db';
      tab.style.color = '#111827';
    }
  },


  activatePresetStyle(btn, active) {
    btn.dataset.wlActive = active ? '1' : '0';
    btn.classList.toggle('wl-active', !!active);
    btn.style.borderRadius = '8px';
    btn.style.height = '34px';
    btn.style.minHeight = '34px';
    btn.style.minWidth = '42px';
    btn.style.padding = '0 12px';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.boxSizing = 'border-box';
    btn.style.fontWeight = '700';
    if (active) {
      btn.style.background = '#eff6ff';
      btn.style.borderColor = '#2d7ff9';
      btn.style.color = '#2563eb';
    } else {
      btn.style.background = '#f9fafb';
      btn.style.borderColor = '#e5e7eb';
      btn.style.color = '#6b7280';
    }
  },

  box(doc) {
    return this.html(doc, 'div', {
      styleObj: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '10px 12px',
        marginBottom: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,.04)'
      }
    });
  },

  row(doc) {
    return this.html(doc, 'div', {
      styleObj: {
        display: 'grid',
        gridTemplateColumns: '96px minmax(0, 1fr)',
        gap: '8px',
        alignItems: 'start',
        margin: '9px 0',
        width: '100%',
        boxSizing: 'border-box'
      }
    });
  },

  actionRow(doc) {
    return this.html(doc, 'div', {
      styleObj: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        margin: '8px 0 12px 96px',
        flexWrap: 'wrap'
      }
    });
  },

  flexRow(doc) {
    return this.html(doc, 'div', {
      styleObj: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        margin: '8px 0',
        flexWrap: 'wrap'
      }
    });
  },

  label(doc, text) {
    return this.html(doc, 'label', {
      styleObj: {
        color: '#374151',
        fontWeight: '600',
        paddingTop: '7px',
        boxSizing: 'border-box',
        lineHeight: '18px'
      }
    }, text);
  },

  input(doc, field, placeholder, type) {
    var el = this.html(doc, 'input', {
      type: type || 'text',
      placeholder: placeholder || '',
      dataset: { field: field },
      styleObj: {
        width: '100%',
        minWidth: '0',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '0 10px',
        fontSize: '13px',
        lineHeight: '18px',
        boxSizing: 'border-box',
        minHeight: '34px',
        height: '34px',
        verticalAlign: 'middle'
      }
    });
    return el;
  },

  textarea(doc, field, placeholder) {
    return this.html(doc, 'textarea', {
      placeholder: placeholder || '',
      dataset: { field: field },
      styleObj: {
        width: '100%',
        minWidth: '0',
        minHeight: '58px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '13px',
        lineHeight: '18px',
        resize: 'vertical',
        boxSizing: 'border-box'
      }
    });
  },

  statusBox(doc, role, text) {
    return this.html(doc, 'div', { dataset: { role: role }, styleObj: { whiteSpace: 'pre-wrap', minHeight: '20px', padding: '8px', background: '#f3f4f6', borderRadius: '8px', color: '#374151' } }, text || 'Ready.');
  },

  wordbookView(win) {
    var doc = win.document;
    var plugin = this;
    var view = this.html(doc, 'div', { dataset: { view: 'wordbook' }, styleObj: { display: 'none' } });

    var modeBar = this.html(doc, 'div', {
      styleObj: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        margin: '0 0 12px 0'
      }
    });
    var cardBtn = this.smallButton(doc, this.t('cardView'));
    cardBtn.dataset.wlSubtab = 'card';
    var addBtn = this.smallButton(doc, this.t('editWord'));
    addBtn.dataset.wlSubtab = 'edit';
    cardBtn.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      plugin.switchWordbookMode(win, 'card');
    });
    addBtn.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      plugin.switchWordbookMode(win, 'edit');
    });
    this.activateTabStyle(cardBtn, true);
    this.activateTabStyle(addBtn, false);
    modeBar.appendChild(cardBtn);
    modeBar.appendChild(addBtn);
    view.appendChild(modeBar);

    var cardPage = this.html(doc, 'div', { dataset: { wlPage: 'card' } });
    var editPage = this.html(doc, 'div', { dataset: { wlPage: 'edit' }, styleObj: { display: 'none' } });
    view.appendChild(cardPage);
    view.appendChild(editPage);

    var cardShell = this.html(doc, 'div', {
      styleObj: {
        position: 'relative',
        minHeight: '420px',
        padding: '0 54px',
        boxSizing: 'border-box'
      }
    });
    cardPage.appendChild(cardShell);

    var left = this.smallButton(doc, '‹');
    left.style.position = 'absolute';
    left.style.left = '0';
    left.style.top = '180px';
    left.style.width = '42px';
    left.style.height = '42px';
    left.style.borderRadius = '999px';
    left.style.fontSize = '22px';
    left.style.zIndex = '2';
    left.addEventListener('click', function () { plugin.moveSelection(win, -1); });

    var right = this.smallButton(doc, '›');
    right.style.position = 'absolute';
    right.style.right = '0';
    right.style.top = '180px';
    right.style.width = '42px';
    right.style.height = '42px';
    right.style.borderRadius = '999px';
    right.style.fontSize = '22px';
    right.style.zIndex = '2';
    right.addEventListener('click', function () { plugin.moveSelection(win, 1); });
    cardShell.appendChild(left);

    var card = this.html(doc, 'div', {
      styleObj: {
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '14px',
        padding: '26px 30px',
        boxShadow: '0 2px 10px rgba(15,23,42,.08)',
        maxWidth: '560px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }
    });
    cardShell.appendChild(card);
    cardShell.appendChild(right);

    card.appendChild(this.html(doc, 'div', { dataset: { role: 'card-pos' }, styleObj: { color: '#6b7280', fontSize: '12px', marginBottom: '10px' } }, '0 / 0'));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'text' }, styleObj: { fontSize: '25px', lineHeight: '32px', fontWeight: '800', color: '#111827', marginBottom: '6px' } }, this.t('noWord')));
    var pronRow = this.html(doc, 'div', { styleObj: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px', marginBottom: '18px' } });
    pronRow.appendChild(this.html(doc, 'span', { dataset: { card: 'pronunciation' }, styleObj: { color: '#6b7280', fontSize: '14px' } }, ''));
    var cardSpeak = this.speakerButton(doc, 'Read selected word aloud');
    cardSpeak.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.speakSelectedTerm(win); });
    pronRow.appendChild(cardSpeak);
    card.appendChild(pronRow);

    card.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', margin: '0 0 6px 0' } }, this.t('meaning')));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'meaning' }, styleObj: { marginBottom: '18px', whiteSpace: 'pre-wrap', color: '#111827' } }, ''));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'phrases-title' }, styleObj: { fontWeight: '700', margin: '0 0 8px 0' } }, this.t('relatedPhrases')));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'phrases' }, styleObj: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' } }));
    card.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', margin: '0 0 6px 0' } }, this.t('context')));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'context' }, styleObj: { marginBottom: '18px', whiteSpace: 'pre-wrap', color: '#111827', lineHeight: '1.65' } }, ''));
    card.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', margin: '0 0 6px 0' } }, this.t('example')));
    card.appendChild(this.html(doc, 'div', { dataset: { card: 'examples' }, styleObj: { whiteSpace: 'pre-wrap', color: '#374151', lineHeight: '1.6' } }, ''));

    // All words list moved to the top-level All Words page in 0.3.5.

    var formBox = this.box(doc);
    formBox.style.padding = '18px 20px';
    editPage.appendChild(formBox);
    var actions = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start', margin: '0 0 14px 112px', flexWrap: 'wrap' } });
    var fresh = this.smallButton(doc, this.t('newWord'));
    fresh.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.clearDraft(win); plugin.switchWordbookMode(win, 'edit'); });
    var llm = this.smallButton(doc, this.t('llmComplete'));
    llm.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.llmComplete(win, llm); });
    var save = this.primaryButton(doc, this.t('save'));
    save.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.saveTerm(win); });
    var del = this.dangerButton(doc, this.t('delete'));
    del.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.deleteTerm(win); });
    actions.appendChild(llm); actions.appendChild(save); actions.appendChild(del);
    formBox.appendChild(actions);

    var fields = [
      ['text', this.t('wordPhrase'), 'word or phrase', false, 0],
      ['example', this.t('example'), 'sentence from current paper', true, 100],
      ['pronunciation', this.t('pronunciation'), '/.../', false, 0],
      ['chineseMeaning', this.t('meaning'), '中文释义', true, 100],
      ['contextExplanation', this.t('context'), '结合论文语境的解释', true, 150],
      ['phrases', this.t('phrases'), 'related phrases, one per line', true, 130]
    ];
    for (var i = 0; i < fields.length; i++) {
      var r = this.row(doc);
      r.style.gridTemplateColumns = '112px minmax(0, 1fr)';
      r.style.gap = '10px';
      r.appendChild(this.label(doc, fields[i][1]));
      if (fields[i][0] === 'pronunciation') {
        var pronWrap = this.html(doc, 'div', { styleObj: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', width: '100%', alignItems: 'center', boxSizing: 'border-box' } });
        pronWrap.appendChild(this.input(doc, fields[i][0], fields[i][2]));
        var speakDraft = this.smallButton(doc, this.t('speak'));
        speakDraft.style.minWidth = '70px';
        speakDraft.insertBefore(doc.createTextNode('🔊 '), speakDraft.firstChild);
        speakDraft.setAttribute('title', 'Read the current word or phrase aloud');
        speakDraft.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.speakDraft(win); });
        pronWrap.appendChild(speakDraft);
        r.appendChild(pronWrap);
      } else {
        var control = fields[i][3] ? this.textarea(doc, fields[i][0], fields[i][2]) : this.input(doc, fields[i][0], fields[i][2]);
        if (fields[i][4]) control.style.minHeight = fields[i][4] + 'px';
        r.appendChild(control);
      }
      formBox.appendChild(r);
    }
    formBox.appendChild(this.statusBox(doc, 'wordbook-status', this.t('editReady')));

    return view;
  },

  switchWordbookMode(win, mode) {
    var p = this.panel(win); if (!p) return;

    // The edit form is persistent DOM. After adding a new word from the Add
    // Word tab, the card can already point to the new selected term, while the
    // hidden edit form may still contain the previous term's fields. Always
    // hydrate the edit form from the current selected card before showing it.
    if (mode === 'edit') {
      this.syncEditDraftFromSelected(win);
    }

    var pages = p.querySelectorAll('[data-wl-page]');
    for (var i = 0; i < pages.length; i++) pages[i].style.display = pages[i].dataset.wlPage === mode ? '' : 'none';
    var tabs = p.querySelectorAll('[data-wl-subtab]');
    for (var j = 0; j < tabs.length; j++) this.activateTabStyle(tabs[j], tabs[j].dataset.wlSubtab === mode);
    this.debug('Wordbook view mode -> ' + mode);
  },


  addWordView(win) {
    var doc = win.document;
    var plugin = this;
    var view = this.html(doc, 'div', { dataset: { view: 'addword' } });
    var formBox = this.box(doc);
    formBox.style.padding = '22px 24px';
    view.appendChild(formBox);

    var intro = this.html(doc, 'div', {
      styleObj: {
        fontWeight: '700',
        fontSize: '15px',
        margin: '0 0 14px 112px',
        color: '#111827'
      }
    }, this.t('addWord'));
    formBox.appendChild(intro);

    var actions = this.html(doc, 'div', {
      styleObj: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        justifyContent: 'flex-start',
        margin: '0 0 16px 112px',
        flexWrap: 'wrap'
      }
    });
    var newBtn = this.smallButton(doc, this.t('newWord'));
    newBtn.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.clearAddDraft(win); });
    var llm = this.smallButton(doc, this.t('llmComplete'));
    llm.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.llmCompleteAdd(win, llm); });
    var save = this.primaryButton(doc, this.t('save'));
    save.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.saveAddTerm(win); });
    actions.appendChild(newBtn);
    actions.appendChild(llm);
    actions.appendChild(save);
    formBox.appendChild(actions);

    var fields = [
      ['text', this.t('wordPhrase'), 'word or phrase', false, 0],
      ['example', this.t('example'), 'sentence from current paper', true, 110],
      ['pronunciation', this.t('pronunciation'), '/.../', false, 0],
      ['chineseMeaning', this.t('meaning'), '中文释义', true, 110],
      ['contextExplanation', this.t('context'), '结合论文语境的解释', true, 170],
      ['phrases', this.t('phrases'), 'related phrases, one per line', true, 145]
    ];

    for (var i = 0; i < fields.length; i++) {
      var r = this.row(doc);
      r.style.gridTemplateColumns = '112px minmax(0, 1fr)';
      r.style.gap = '10px';
      r.appendChild(this.label(doc, fields[i][1]));
      if (fields[i][0] === 'pronunciation') {
        var pronWrap = this.html(doc, 'div', { styleObj: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px', width: '100%', alignItems: 'center', boxSizing: 'border-box' } });
        pronWrap.appendChild(this.addInput(doc, fields[i][0], fields[i][2]));
        var speak = this.smallButton(doc, this.t('speak'));
        speak.style.minWidth = '70px';
        speak.setAttribute('title', 'Read the current word or phrase aloud');
        speak.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.speakAddDraft(win); });
        pronWrap.appendChild(speak);
        r.appendChild(pronWrap);
      } else {
        var control = fields[i][3] ? this.addTextarea(doc, fields[i][0], fields[i][2]) : this.addInput(doc, fields[i][0], fields[i][2]);
        if (fields[i][4]) control.style.minHeight = fields[i][4] + 'px';
        r.appendChild(control);
      }
      formBox.appendChild(r);
    }
    formBox.appendChild(this.statusBox(doc, 'addword-status', this.t('addReady')));
    return view;
  },

  addField(win, name) {
    var p = this.panel(win);
    return p ? p.querySelector('[data-add-field="' + name + '"]') : null;
  },

  addInput(doc, field, placeholder, type) {
    var el = this.input(doc, field, placeholder, type);
    el.removeAttribute('data-field');
    el.dataset.addField = field;
    return el;
  },

  addTextarea(doc, field, placeholder) {
    var el = this.textarea(doc, field, placeholder);
    el.removeAttribute('data-field');
    el.dataset.addField = field;
    return el;
  },

  getAddDraft(win) {
    var phrases = (this.addField(win, 'phrases')?.value || '').split(/\r?\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
    return {
      id: '',
      text: this.addField(win, 'text')?.value.trim() || '',
      example: this.addField(win, 'example')?.value.trim() || '',
      pronunciation: this.addField(win, 'pronunciation')?.value.trim() || '',
      chineseMeaning: this.addField(win, 'chineseMeaning')?.value.trim() || '',
      contextExplanation: this.addField(win, 'contextExplanation')?.value.trim() || '',
      phrases: phrases
    };
  },

  setAddDraft(win, term) {
    term = term || {};
    var textField = this.addField(win, 'text');
    var exampleField = this.addField(win, 'example');
    var pronunciationField = this.addField(win, 'pronunciation');
    var meaningField = this.addField(win, 'chineseMeaning');
    var contextField = this.addField(win, 'contextExplanation');
    var phrasesField = this.addField(win, 'phrases');
    if (textField) textField.value = term.text || '';
    if (exampleField) exampleField.value = term.example || (term.examples && term.examples[0] && term.examples[0].sentence) || '';
    if (pronunciationField) pronunciationField.value = term.pronunciation || '';
    if (meaningField) meaningField.value = term.chineseMeaning || '';
    if (contextField) contextField.value = term.contextExplanation || '';
    if (phrasesField) phrasesField.value = Array.isArray(term.phrases) ? term.phrases.join('\n') : '';
  },

  clearAddDraft(win) {
    this.setAddDraft(win, { text: '', example: '', pronunciation: '', chineseMeaning: '', contextExplanation: '', phrases: [] });
    this.status(win, 'addword-status', this.t('addReady'), 'ok');
    var textField = this.addField(win, 'text');
    if (textField && textField.focus) {
      try { textField.focus(); } catch (e) {}
    }
  },

  speakAddDraft(win) {
    var text = this.addField(win, 'text')?.value.trim() || '';
    if (!text) {
      this.status(win, 'addword-status', 'No word or phrase to read.', 'err');
      return;
    }
    this.speakText(win, text, 'addword-status');
  },


  allWordsView(win) {
    var doc = win.document;
    var plugin = this;
    var view = this.html(doc, 'div', { dataset: { view: 'allwords' }, styleObj: { display: 'none' } });

    var box = this.box(doc);
    box.style.padding = '16px 18px';
    view.appendChild(box);

    var header = this.html(doc, 'div', {
      styleObj: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '10px',
        alignItems: 'center',
        marginBottom: '12px'
      }
    });

    var title = this.html(doc, 'div', {
      styleObj: {
        fontWeight: '800',
        fontSize: '16px',
        color: '#111827'
      }
    }, this.t('allWordsList'));
    header.appendChild(title);

    var sortBtn = this.smallButton(doc, this.t('sortAZ'));
    sortBtn.dataset.role = 'allwords-sort';
    sortBtn.style.background = '#f3f4f6';
    sortBtn.style.borderColor = '#e5e7eb';
    sortBtn.style.color = '#6b7280';
    sortBtn.style.fontWeight = '700';
    sortBtn.style.minWidth = '72px';
    sortBtn.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      var current = plugin.allWordsSortByWindow.get(win) || 'az';
      plugin.allWordsSortByWindow.set(win, current === 'az' ? 'za' : 'az');
      plugin.renderAllWordsList(win);
    });
    header.appendChild(sortBtn);
    box.appendChild(header);

    var search = this.input(doc, 'allwords-search', this.t('searchWords'));
    search.removeAttribute('data-field');
    search.dataset.role = 'allwords-search';
    search.addEventListener('input', function () { plugin.renderAllWordsList(win); });
    box.appendChild(search);

    var list = this.html(doc, 'div', {
      dataset: { role: 'allwords-list' },
      styleObj: {
        marginTop: '12px',
        maxHeight: '520px',
        overflow: 'auto',
        border: '1px solid ' + ('var(--wl-border)'),
        borderRadius: '12px',
        background: 'var(--wl-surface)'
      }
    });
    box.appendChild(list);

    return view;
  },

  renderAllWordsList(win) {
    var p = this.panel(win);
    if (!p) return;
    var list = p.querySelector('[data-role="allwords-list"]');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);

    var sort = this.allWordsSortByWindow.get(win) || 'az';
    var sortBtn = p.querySelector('[data-role="allwords-sort"]');
    if (sortBtn) sortBtn.textContent = sort === 'az' ? this.t('sortAZ') : this.t('sortZA');

    var queryNode = p.querySelector('[data-role="allwords-search"]');
    var query = this.normalize(queryNode ? queryNode.value : '');

    var terms = (p._wlTerms || []).slice();
    if (query) {
      terms = terms.filter((t) => {
        var hay = this.normalize([
          t.text || '',
          t.chineseMeaning || '',
          t.contextExplanation || '',
          (t.phrases || []).join(' ')
        ].join(' '));
        return hay.indexOf(query) >= 0;
      });
    }

    terms.sort((a, b) => {
      var aa = this.normalize(a.text || '');
      var bb = this.normalize(b.text || '');
      return sort === 'az' ? aa.localeCompare(bb) : bb.localeCompare(aa);
    });

    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var item = this.html(win.document, 'div', {
        styleObj: {
          padding: '10px 12px',
          borderBottom: '1px solid color-mix(in srgb, CanvasText 18%, transparent)',
          cursor: 'pointer',
          background: t.id === this.selectedIdByWindow.get(win) ? 'color-mix(in srgb, #2d7ff9 22%, Canvas)' : 'color-mix(in srgb, Canvas 96%, CanvasText 4%)'
        }
      });
      item._termId = t.id;
      item.dataset.termId = t.id;
      item.appendChild(this.html(win.document, 'div', {
        styleObj: {
          fontWeight: '800',
          color: 'CanvasText',
          marginBottom: '4px'
        }
      }, t.text || '(Untitled)'));
      item.appendChild(this.html(win.document, 'div', {
        styleObj: {
          color: 'color-mix(in srgb, CanvasText 70%, transparent)',
          fontSize: '12px',
          lineHeight: '18px',
          whiteSpace: 'pre-wrap'
        }
      }, t.chineseMeaning || ''));
      item.addEventListener('click', (event) => {
        var id = event.currentTarget._termId;
        var term = (this.panel(win)._wlTerms || []).find(function (x) { return x.id === id; });
        this.selectedIdByWindow.set(win, id);
        this.setDraft(win, term || {});
        this.renderCard(win);
        this.renderList(win);
        this.renderAllWordsList(win);
        this.switchTab(this.panel(win), 'wordbook');
        this.switchWordbookMode(win, 'card');
      });
      list.appendChild(item);
    }

    if (!terms.length) {
      list.appendChild(this.html(win.document, 'div', {
        styleObj: { padding: '12px', color: '#9ca3af' }
      }, this.isChineseUI() ? '暂无词条。' : 'No words yet.'));
    }
  },

  reviewView(win) {
    var doc = win.document;
    var plugin = this;
    var view = this.html(doc, 'div', { dataset: { view: 'review' }, styleObj: { display: 'none' } });
    var box = this.box(doc);
    box.style.padding = '18px 20px';
    view.appendChild(box);

    var row = this.flexRow(doc);
    row.style.alignItems = 'center';

    row.appendChild(this.html(doc, 'span', {
      styleObj: { color: '#374151', fontWeight: '700', fontSize: '13px' }
    }, this.isChineseUI() ? '本次词数' : 'Words'));

    var preset10 = this.smallButton(doc, '10');
    preset10.dataset.reviewCountPreset = '10';
    var preset20 = this.smallButton(doc, '20');
    preset20.dataset.reviewCountPreset = '20';
    var preset30 = this.smallButton(doc, '30');
    preset30.dataset.reviewCountPreset = '30';

    var countInput = this.html(doc, 'input', {
      type: 'number',
      min: '1',
      step: '1',
      value: '10',
      dataset: { role: 'review-count' },
      styleObj: {
        width: '72px',
        height: '34px',
        minHeight: '34px',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '0 8px',
        boxSizing: 'border-box',
        fontSize: '13px'
      }
    });

    function setPresetButton(active) {
      var buttons = [preset10, preset20, preset30];
      for (var i = 0; i < buttons.length; i++) {
        plugin.activatePresetStyle(buttons[i], buttons[i] === active);
      }
    }
    preset10.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} countInput.value = '10'; setPresetButton(preset10); });
    preset20.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} countInput.value = '20'; setPresetButton(preset20); });
    preset30.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} countInput.value = '30'; setPresetButton(preset30); });
    countInput.addEventListener('input', function () { setPresetButton(null); });
    setPresetButton(preset10);

    var start = this.primaryButton(doc, this.isChineseUI() ? '开始复习' : 'Start Review');
    start.addEventListener('click', function () { plugin.startReview(win); });
    var show = this.smallButton(doc, this.isChineseUI() ? '显示答案' : 'Show Answer');
    show.addEventListener('click', function () { plugin.showReviewAnswer(win); });

    row.appendChild(preset10);
    row.appendChild(preset20);
    row.appendChild(preset30);
    row.appendChild(countInput);
    row.appendChild(start);
    row.appendChild(show);
    row.appendChild(this.html(doc, 'span', { dataset: { role: 'review-pos' }, styleObj: { color: '#6b7280', fontWeight: '700' } }, '0 / 0'));
    box.appendChild(row);

    var progressTrack = this.html(doc, 'div', {
      styleObj: {
        width: '100%',
        height: '8px',
        background: '#e5e7eb',
        borderRadius: '999px',
        overflow: 'hidden',
        margin: '4px 0 18px 0'
      }
    });
    progressTrack.appendChild(this.html(doc, 'div', {
      dataset: { role: 'review-progress' },
      styleObj: {
        width: '0%',
        height: '100%',
        background: '#2d7ff9',
        borderRadius: '999px'
      }
    }));
    box.appendChild(progressTrack);

    var reviewTitleRow = this.html(doc, 'div', { styleObj: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' } });
    reviewTitleRow.appendChild(this.html(doc, 'div', { dataset: { review: 'text' }, styleObj: { fontSize: '24px', lineHeight: '32px', fontWeight: '800', minWidth: '0', flex: '1' } }, this.isChineseUI() ? '暂无复习词条' : 'No review item'));
    box.appendChild(reviewTitleRow);

    var pronRow = this.html(doc, 'div', { styleObj: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '28px', margin: '4px 0 14px 0' } });
    pronRow.appendChild(this.html(doc, 'span', { dataset: { review: 'pronunciation' }, styleObj: { color: '#6b7280', fontSize: '14px' } }));
    var reviewSpeak = this.speakerButton(doc, 'Read review word aloud');
    reviewSpeak.addEventListener('click', function (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch (e) {}
      plugin.speakReviewTerm(win);
    });
    pronRow.appendChild(reviewSpeak);
    box.appendChild(pronRow);

    var exampleWrap = this.html(doc, 'div', { dataset: { role: 'review-example-wrap' }, styleObj: { display: 'none', margin: '0 0 14px 0' } });
    exampleWrap.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', margin: '0 0 6px 0' } }, this.isChineseUI() ? '例句' : 'Example'));
    exampleWrap.appendChild(this.html(doc, 'div', { dataset: { review: 'example' }, styleObj: { marginTop: '0', color: '#374151', lineHeight: '1.55' } }));
    box.appendChild(exampleWrap);

    var spellingWrap = this.html(doc, 'div', { dataset: { role: 'review-spelling-wrap' }, styleObj: { display: 'none', margin: '0 0 14px 0' } });
    spellingWrap.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', margin: '0 0 6px 0' } }, this.isChineseUI() ? '释义' : 'Meaning'));
    spellingWrap.appendChild(this.html(doc, 'div', { dataset: { review: 'spelling-meaning' }, styleObj: { margin: '0 0 12px 0', color: '#374151', lineHeight: '1.55' } }));
    spellingWrap.appendChild(this.html(doc, 'div', { dataset: { role: 'review-spelling-slots' }, styleObj: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', margin: '8px 0 10px 0' } }));
    var nextSpelling = this.primaryButton(doc, this.isChineseUI() ? '下一题' : 'Next');
    nextSpelling.dataset.role = 'review-spelling-next';
    nextSpelling.style.display = 'none';
    nextSpelling.addEventListener('click', function () { plugin.markReview(win, 'known'); });
    spellingWrap.appendChild(nextSpelling);
    box.appendChild(spellingWrap);

    box.appendChild(this.html(doc, 'div', { dataset: { review: 'prompt' }, styleObj: { fontWeight: '700', margin: '0 0 8px 0' } }, this.isChineseUI() ? '请选择最合适的中文释义' : 'Choose the best Chinese meaning'));
    var choices = this.html(doc, 'div', {
      dataset: { role: 'review-choices' },
      styleObj: {
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '8px',
        marginBottom: '12px'
      }
    });
    box.appendChild(choices);

    var answer = this.html(doc, 'div', { dataset: { review: 'answer' }, styleObj: { display: 'none', marginTop: '12px', padding: '12px', background: '#f3f4f6', borderRadius: '10px', whiteSpace: 'pre-wrap', lineHeight: '1.55' } });
    box.appendChild(answer);

    var r2 = this.html(doc, 'div', {
      dataset: { role: 'review-grade-buttons' },
      styleObj: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '10px',
        margin: '14px 0 12px 0',
        width: '100%'
      }
    });
    var again = this.dangerButton(doc, this.isChineseUI() ? '不认识' : 'Unknown');
    again.dataset.reviewGrade = 'again';
    again.dataset.role = 'review-grade-again';
    again.style.width = '100%';
    again.style.height = '40px';
    again.addEventListener('click', function () { plugin.markReview(win, 'again'); });
    var hard = this.smallButton(doc, this.isChineseUI() ? '模糊' : 'Blurred');
    hard.dataset.reviewGrade = 'hard';
    hard.dataset.role = 'review-grade-hard';
    hard.style.width = '100%';
    hard.style.height = '40px';
    hard.style.color = '#c2410c';
    hard.style.borderColor = '#fed7aa';
    hard.style.background = '#fff7ed';
    hard.addEventListener('click', function () { plugin.markReview(win, 'hard'); });
    var known = this.smallButton(doc, this.isChineseUI() ? '认识' : 'Known');
    known.dataset.reviewGrade = 'known';
    known.dataset.role = 'review-grade-known';
    known.style.width = '100%';
    known.style.height = '40px';
    known.style.color = '#166534';
    known.style.borderColor = '#bbf7d0';
    known.style.background = '#f0fdf4';
    known.addEventListener('click', function () { plugin.markReview(win, 'known'); });
    r2.appendChild(again); r2.appendChild(hard); r2.appendChild(known);
    box.appendChild(r2);
    box.appendChild(this.statusBox(doc, 'review-status', this.t('ready')));
    return view;
  },

  settingsView(win) {
    var doc = win.document;
    var plugin = this;
    var view = this.html(doc, 'div', { dataset: { view: 'settings' }, styleObj: { display: 'none' } });
    var box = this.box(doc);
    view.appendChild(box);
    this.addSettingSelect(doc, box, this.t('language'), 'language', [['zh-CN', this.t('chineseSimplified')], ['en', this.t('english')]]);
    var providerSelect = this.addSettingSelect(doc, box, this.t('provider'), 'llmProvider', [['openai', 'OpenAI'], ['deepseek', 'DeepSeek'], ['gemini', 'Gemini'], ['anthropic', 'Anthropic'], ['minimax', 'MiniMax'], ['glm', 'GLM'], ['grok', 'Grok'], ['qwen', 'Qwen'], ['kimi', 'Kimi'], ['custom', 'Custom OpenAI-compatible']]);
    this.addSettingInput(doc, box, 'API URL', 'apiUrl', 'https://api.deepseek.com');
    this.addSettingInput(doc, box, 'Model', 'modelName', 'deepseek-v4-flash');
    var reasoningSelect = this.addSettingSelect(doc, box, this.t('thinkingIntensity'), 'reasoningEffort', [['default', this.t('thinkingDefault')], ['low', this.t('thinkingLow')], ['medium', this.t('thinkingMedium')], ['high', this.t('thinkingHigh')]]);
    this.addSpeechVoiceSelect(doc, box, win);
    this.addSettingInput(doc, box, 'API Key', 'apiKey', 'sk-...', 'password');
    this.addSettingInput(doc, box, this.t('databasePath'), 'dataPath', this.getDefaultDataPath());
    this.addReadonlyPathRow(doc, box, this.t('defaultDatabasePath'), this.getDefaultDataPath());
    box.appendChild(this.html(doc, 'div', { styleObj: { margin: '-4px 0 10px 112px', color: '#9ca3af', fontSize: '12px', lineHeight: '18px' } }, this.t('customDatabasePathHint')));
    var row = this.actionRow(doc);
    var save = this.primaryButton(doc, this.t('saveSettings')); save.addEventListener('click', function () { plugin.saveSettings(win); });
    var test = this.smallButton(doc, this.t('testConnection')); test.addEventListener('click', function () { plugin.testConnection(win, test); });
    var preview = this.smallButton(doc, this.t('speechPreview')); preview.addEventListener('click', function () { plugin.previewSpeechStyle(win); });
    row.appendChild(save); row.appendChild(test); row.appendChild(preview); box.appendChild(row);
    box.appendChild(this.html(doc, 'div', { styleObj: { marginTop: '6px', color: '#6b7280', fontSize: '12px', lineHeight: '18px' } }, 'Tip: For DeepSeek, use API URL https://api.deepseek.com. The /anthropic path is only for Anthropic-compatible mode.'));
    box.appendChild(this.statusBox(doc, 'settings-status', this.t('ready')));
    var modelInput = box.querySelector('[data-setting="modelName"]');
    if (providerSelect) {
      providerSelect.addEventListener('change', function () { plugin.applyProviderDefaults(win, true); plugin.updateReasoningControl(win); });
    }
    if (modelInput) {
      modelInput.addEventListener('input', function () { plugin.updateReasoningControl(win); });
      modelInput.addEventListener('change', function () { plugin.updateReasoningControl(win); });
    }
    this.updateReasoningControl(win);
    return view;
  },



  getSpeechSynthesis(win) {
    return win.speechSynthesis || (win.window && win.window.speechSynthesis) || (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
  },

  getAvailableEnglishVoices(win) {
    var synth = this.getSpeechSynthesis(win);
    var voices = [];
    try { voices = synth && synth.getVoices ? synth.getVoices() : []; } catch (e) { voices = []; }
    var badVoiceName = /(whisper|novelty|bells|boing|bubbles|cellos|deranged|hysterical|pipe|trinoids|zarvox|bad news|good news|organ|superstar|jester)/i;
    voices = (voices || []).filter(function (v) {
      return /^en([-_]|$)/i.test(v.lang || '') && !badVoiceName.test(v.name || '');
    });
    var seen = {};
    var out = [];
    for (var i = 0; i < voices.length; i++) {
      var key = (voices[i].name || '') + '|' + (voices[i].lang || '');
      if (seen[key]) continue;
      seen[key] = true;
      out.push(voices[i]);
    }
    return out;
  },

  voiceId(voice) {
    if (!voice) return 'system';
    return 'voice:' + encodeURIComponent(voice.name || '') + '|' + encodeURIComponent(voice.lang || '');
  },

  parseVoiceId(id) {
    id = String(id || '');
    if (id.indexOf('voice:') !== 0) return null;
    var rest = id.slice(6);
    var parts = rest.split('|');
    return {
      name: decodeURIComponent(parts[0] || ''),
      lang: decodeURIComponent(parts[1] || '')
    };
  },

  addSpeechVoiceSelect(doc, box, win) {
    var voices = this.getAvailableEnglishVoices(win);
    var options = [];
    if (voices.length) {
      for (var i = 0; i < voices.length; i++) {
        var label = (voices[i].name || 'English Voice') + (voices[i].lang ? ' · ' + voices[i].lang : '');
        options.push([this.voiceId(voices[i]), label]);
      }
    } else {
      options.push(['system', this.t('speechSystem')]);
    }
    var sel = this.addSettingSelect(doc, box, this.t('speechStyle'), 'speechStyle', options);
    sel.dataset.dynamicVoiceSelect = '1';
    if (voices.length <= 1) {
      // With only one exposed voice, show only one option. Keep it editable as
      // a normal select, but there is nothing else to switch to.
      sel.title = this.isChineseUI() ? '当前 Zotero/系统只暴露了一个英文语音。' : 'Only one English voice is exposed by Zotero/the system.';
    }
    return sel;
  },

  addReadonlyPathRow(doc, box, label, value) {
    var r = this.row(doc);
    r.appendChild(this.label(doc, label));
    var input = this.html(doc, 'input', {
      type: 'text',
      value: value || '',
      readonly: 'readonly',
      styleObj: {
        width: '100%',
        minWidth: '0',
        border: '1px solid #d1d5db',
        borderRadius: '8px',
        padding: '0 10px',
        fontSize: '12px',
        lineHeight: '18px',
        boxSizing: 'border-box',
        height: '34px',
        minHeight: '34px',
        color: '#6b7280',
        background: '#f9fafb'
      }
    });
    input.addEventListener('focus', function () {
      try { input.select(); } catch (e) {}
    });
    r.appendChild(input);
    box.appendChild(r);
  },

  addSettingInput(doc, box, label, key, placeholder, type) {
    var r = this.row(doc);
    r.appendChild(this.label(doc, label));
    var input = this.input(doc, key, placeholder, type);
    input.removeAttribute('data-field');
    input.dataset.setting = key;
    r.appendChild(input);
    box.appendChild(r);
  },

  addSettingSelect(doc, box, label, key, options) {
    var r = this.row(doc);
    r.appendChild(this.label(doc, label));
    var sel = this.html(doc, 'select', { dataset: { setting: key }, styleObj: { width: '100%', minWidth: '0', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 10px', fontSize: '13px', lineHeight: '18px', boxSizing: 'border-box', minHeight: '34px', height: '34px', verticalAlign: 'middle' } });
    for (var i = 0; i < options.length; i++) {
      sel.appendChild(this.html(doc, 'option', { value: options[i][0] }, options[i][1]));
    }
    r.appendChild(sel); box.appendChild(r); return sel;
  },


  rebuildPanelUI(win, activeTab) {
    var p = this.panel(win);
    if (!p) return;
    while (p.firstChild) {
      p.removeChild(p.firstChild);
    }
    this.buildPanel(win, p);
    this.loadSettings(win);
    this.refreshTerms(win);
    this.switchTab(p, activeTab || 'wordbook');
  },

  switchTab(panel, name) {
    if (!panel) return;
    this.currentView = name;
    var tabs = panel.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) this.activateTabStyle(tabs[i], tabs[i].dataset.tab === name);
    var views = panel.querySelectorAll('[data-view]');
    for (var j = 0; j < views.length; j++) views[j].style.display = views[j].dataset.view === name ? '' : 'none';
    try {
      var win = panel.ownerDocument.defaultView;
      this.activePanelByWindow.set(win, panel);
      this.renderThemeToggle(win);
      // Do not clear the Add Word draft when the user switches away and back.
      // LLM completion can be expensive, so unsaved draft content should stay
      // in the form until the user explicitly clicks "New Word", saves, or Zotero
      // rebuilds the reader pane.
      if (name === 'allwords') {
        this.renderAllWordsList(win);
      }
      this.panelLastInteractionByWindow.set(win, Date.now());
    } catch (e) {}
  },

  togglePanel(win) {
    if (this.nativePanelRegistered) {
      var nativePanel = this.panel(win);
      if (nativePanel) {
        nativePanel.style.display = nativePanel.style.display === 'none' ? 'block' : 'none';
      }
      return;
    }
    var panel = this.ensurePanel(win);
    if (panel.dataset.embedded === '1') {
      if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        this.setPanelCollapsed(panel, false);
      } else {
        this.setPanelCollapsed(panel, panel.dataset.collapsed !== '1');
      }
    } else {
      panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
    }
    this.debug('togglePanel -> ' + panel.style.display + ', collapsed=' + panel.dataset.collapsed);
  },

  showPanel(win) {
    if (this.nativePanelRegistered) {
      try {
        // Zotero manages visibility for native ItemPaneManager sections. We do
        // not create or append a manual panel here, because that would interfere
        // with other plugins.
        var panel = this.panel(win);
        if (panel) {
          panel.style.display = 'block';
          this.refreshTerms(win);
          return;
        }
      } catch (e) {}
      return;
    }
    var panel = this.ensurePanel(win);
    if (panel && panel.dataset.embedded !== '1') {
      var host = this.findSidebarHost(win);
      if (host) {
        try {
          if (panel.parentNode) panel.parentNode.removeChild(panel);
          panel.style.cssText = '';
          this.applyStyle(panel, this.panelStyle(true));
          panel.dataset.embedded = '1';
          panel.style.height = 'auto';
          panel.style.maxHeight = Math.max(420, Math.min(720, Math.floor((host.getBoundingClientRect().height || 620) - 24))) + 'px';
          host.appendChild(panel);
        } catch (e) {}
      }
    }
    panel.style.display = 'block';
    this.refreshTerms(win);
  },

  hidePanel(win) {
    var panel = win.document.getElementById(this.ids.panel);
    if (panel) panel.style.display = 'none';
  },

  panel(win) {
    try {
      if (!win || !win.document) return null;

      // Native Zotero ItemPane can destroy/recreate the section body when the
      // user closes one PDF and opens another.  document.getElementById() may
      // then resolve a stale hidden/disconnected panel with the same id, so all
      // later loadSettings()/refreshTerms() calls update the wrong node.  Keep
      // the current panel per window and verify it is still connected.
      var active = this.activePanelByWindow && this.activePanelByWindow.get(win);
      if (active && active.ownerDocument === win.document && active.isConnected) {
        return active;
      }

      var nodes = Array.prototype.slice.call(win.document.querySelectorAll('#' + this.ids.panel));
      for (var i = nodes.length - 1; i >= 0; i--) {
        var n = nodes[i];
        if (n && n.isConnected) {
          try {
            var r = n.getBoundingClientRect ? n.getBoundingClientRect() : null;
            var cs = win.getComputedStyle ? win.getComputedStyle(n) : null;
            if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) continue;
            if (r && r.width === 0 && r.height === 0) continue;
          } catch (e) {}
          try { this.activePanelByWindow.set(win, n); } catch (e) {}
          return n;
        }
      }

      return win.document.getElementById(this.ids.panel);
    } catch (e) {
      try { return win.document.getElementById(this.ids.panel); } catch (_) {}
      return null;
    }
  },
  field(win, name) { var p = this.panel(win); return p ? p.querySelector('[data-field="' + name + '"]') : null; },
  status(win, role, text, state) {
    var p = this.panel(win); if (!p) return;
    var n = p.querySelector('[data-role="' + role + '"]'); if (!n) return;
    n.textContent = String(text || '');
    n.dataset.wlStatusState = state || '';
    n.style.background = state === 'ok' ? '#ecfdf5' : state === 'err' ? '#fef2f2' : '#f3f4f6';
    n.style.color = state === 'ok' ? '#065f46' : state === 'err' ? '#991b1b' : '#374151';
  },

  getDraft(win) {
    var phrases = (this.field(win, 'phrases')?.value || '').split(/\r?\n|,/).map(function (x) { return x.trim(); }).filter(Boolean);
    return {
      id: this.selectedIdByWindow.get(win) || '',
      text: this.field(win, 'text')?.value.trim() || '',
      example: this.field(win, 'example')?.value.trim() || '',
      pronunciation: this.field(win, 'pronunciation')?.value.trim() || '',
      chineseMeaning: this.field(win, 'chineseMeaning')?.value.trim() || '',
      contextExplanation: this.field(win, 'contextExplanation')?.value.trim() || '',
      phrases: phrases
    };
  },

  setDraft(win, term) {
    term = term || {};
    this.selectedIdByWindow.set(win, term.id || '');
    var textField = this.field(win, 'text');
    var exampleField = this.field(win, 'example');
    var pronunciationField = this.field(win, 'pronunciation');
    var meaningField = this.field(win, 'chineseMeaning');
    var contextField = this.field(win, 'contextExplanation');
    var phrasesField = this.field(win, 'phrases');
    if (textField) textField.value = term.text || '';
    if (exampleField) exampleField.value = term.example || (term.examples && term.examples[0] && term.examples[0].sentence) || '';
    if (pronunciationField) pronunciationField.value = term.pronunciation || '';
    if (meaningField) meaningField.value = term.chineseMeaning || '';
    if (contextField) contextField.value = term.contextExplanation || '';
    if (phrasesField) phrasesField.value = Array.isArray(term.phrases) ? term.phrases.join('\n') : '';
  },

  clearDraft(win) {
    this.selectedIdByWindow.set(win, '');
    this.setDraft(win, {
      id: '',
      text: '',
      example: '',
      pronunciation: '',
      chineseMeaning: '',
      contextExplanation: '',
      phrases: []
    });
    this.status(win, 'wordbook-status', this.t('editReady'), 'ok');
    this.switchWordbookMode(win, 'edit');
    var textField = this.field(win, 'text');
    if (textField && textField.focus) {
      try { textField.focus(); } catch (e) {}
    }
    this.renderCard(win);
    this.renderList(win);
  },

  getSpeakTextFromDraft(win) {
    var text = this.field(win, 'text')?.value.trim() || '';
    return text;
  },

  getSelectedTerm(win) {
    var p = this.panel(win);
    if (!p) return null;
    var terms = p._wlTerms || [];
    var selected = this.selectedIdByWindow.get(win);
    return terms.find(function (t) { return t.id === selected; }) || terms[0] || null;
  },

  speakDraft(win) {
    var text = this.getSpeakTextFromDraft(win);
    if (!text) {
      this.status(win, 'wordbook-status', 'No word or phrase to read.', 'err');
      return;
    }
    this.speakText(win, text, 'wordbook-status');
  },

  speakSelectedTerm(win) {
    var term = this.getSelectedTerm(win);
    var text = term && term.text ? term.text : this.getSpeakTextFromDraft(win);
    if (!text) {
      this.status(win, 'wordbook-status', 'No selected word to read.', 'err');
      return;
    }
    this.speakText(win, text, 'wordbook-status');
  },

  speakReviewTerm(win) {
    var task = this.getCurrentReviewTask(win);
    var text = task && task.term ? (task.term.text || '') : '';
    if (!text) {
      var p = this.panel(win);
      text = p?.querySelector('[data-review="text"]')?.textContent || '';
    }
    if (!text || text === 'No review item' || text === '暂无复习词条' || text === '拼写单词/短语' || text === 'Spell the word or phrase') {
      this.status(win, 'review-status', this.isChineseUI() ? '没有可朗读的复习词。' : 'No review word to read.', 'err');
      return;
    }
    this.speakText(win, text, 'review-status');
  },

  previewSpeechStyle(win) {
    var p = this.panel(win);
    var styleNode = p ? p.querySelector('[data-setting="speechStyle"]') : null;
    var style = styleNode ? styleNode.value : 'system';
    try { Zotero.Prefs.set('extensions.word-learning.speechStyle', style); } catch (e) {}
    this.speakText(win, 'epistemic uncertainty', 'settings-status');
  },

  speechStyleConfig(style) {
    style = String(style || 'system').toLowerCase();
    if (style === 'slow') return { rate: 0.68, pitch: 0.9, prefer: 'female' };
    if (style === 'natural') return { rate: 0.86, pitch: 0.96, prefer: 'natural' };
    if (style === 'auto-male') return { rate: 0.8, pitch: 0.82, prefer: 'male' };
    if (style === 'auto-female') return { rate: 0.78, pitch: 0.88, prefer: 'female' };
    return { rate: 0.82, pitch: 0.92, prefer: 'explicit' };
  },

  chooseSpeechVoice(voices, style) {
    voices = voices || [];
    style = String(style || 'system');
    var explicit = this.parseVoiceId(style);
    if (explicit) {
      for (var e = 0; e < voices.length; e++) {
        if ((voices[e].name || '') === explicit.name && (voices[e].lang || '') === explicit.lang) return voices[e];
      }
      for (var f = 0; f < voices.length; f++) {
        if ((voices[f].name || '') === explicit.name) return voices[f];
      }
      return null;
    }

    var cfg = this.speechStyleConfig(style);
    if (style === 'system') return null;
    var badVoiceName = /(whisper|novelty|bells|boing|bubbles|cellos|deranged|hysterical|pipe|trinoids|zarvox|bad news|good news|organ|superstar|jester)/i;
    var femaleName = /(samantha|karen|victoria|susan|moira|tessa|serena|zira|jenny|aria|google us english female|female)/i;
    var maleName = /(alex|daniel|guy|david|mark|fred|ralph|tom|male)/i;
    var naturalName = /(natural|enhanced|premium|neural|google us english)/i;
    var englishVoices = voices.filter(function (v) {
      return /^en([-_]|$)/i.test(v.lang || '') && !badVoiceName.test(v.name || '');
    });
    if (!englishVoices.length) return null;
    if (cfg.prefer === 'male') {
      return englishVoices.find(function (v) { return maleName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return naturalName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return /en[-_]US/i.test(v.lang || ''); }) ||
        englishVoices[0] || null;
    }
    if (cfg.prefer === 'natural') {
      return englishVoices.find(function (v) { return naturalName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return femaleName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return /en[-_]US/i.test(v.lang || ''); }) ||
        englishVoices[0] || null;
    }
    return englishVoices.find(function (v) { return femaleName.test(v.name || ''); }) ||
      englishVoices.find(function (v) { return naturalName.test(v.name || ''); }) ||
      englishVoices.find(function (v) { return /en[-_]US/i.test(v.lang || ''); }) ||
      englishVoices[0] || null;
  },

  speakText(win, text, statusRole) {
    text = String(text || '').trim();
    if (!text) return;
    var synth = this.getSpeechSynthesis(win);
    var Utterance = win.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
    if (!synth || !Utterance) {
      this.status(win, statusRole || 'wordbook-status', 'Speech synthesis is not available in this Zotero window.', 'err');
      return;
    }
    try {
      synth.cancel();
      var settings = this.getSettings();
      var speechStyle = String(settings.speechStyle || 'system');
      var cfg = this.speechStyleConfig(speechStyle);
      var utterance = new Utterance(text);
      utterance.lang = 'en-US';
      utterance.rate = cfg.rate;
      utterance.pitch = cfg.pitch;
      utterance.volume = 0.95;
      var voices = [];
      try { voices = synth.getVoices ? synth.getVoices() : []; } catch (e) { voices = []; }
      var voice = this.chooseSpeechVoice(voices, speechStyle);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'en-US';
      }
      utterance.onstart = () => this.status(win, statusRole || 'wordbook-status', 'Reading: ' + text + (voice ? ' · ' + voice.name : ''), 'ok');
      utterance.onerror = (event) => this.status(win, statusRole || 'wordbook-status', 'Speech failed: ' + (event.error || 'unknown error'), 'err');
      synth.speak(utterance);
    } catch (e) {
      this.status(win, statusRole || 'wordbook-status', 'Speech failed: ' + (e.message || e), 'err');
    }
  },

  getDefaultDataPath() {
    var profileDir = Services.dirsvc.get('ProfD', Ci.nsIFile).path;
    return PathUtils.join(profileDir, 'word-learning', 'vocabulary.json');
  },

  getDataPath() {
    try {
      var custom = this.prefGet('dataPath', '');
      custom = String(custom || '').trim();
      if (custom) return custom;
    } catch (e) {}
    return this.getDefaultDataPath();
  },

  async readDocument() {
    try {
      var path = this.getDataPath();
      if (!(await IOUtils.exists(path))) return { schemaVersion: 2, terms: [] };
      var doc = JSON.parse(await IOUtils.readUTF8(path));
      if (!doc || typeof doc !== 'object') return { schemaVersion: 2, terms: [] };
      if (!Array.isArray(doc.terms)) doc.terms = [];
      return doc;
    } catch (e) { this.debug('readDocument failed: ' + e); return { schemaVersion: 2, terms: [] }; }
  },

  async writeDocument(doc) {
    var path = this.getDataPath();
    await IOUtils.makeDirectory(PathUtils.parent(path), { createAncestors: true });
    doc.schemaVersion = 2;
    if (!Array.isArray(doc.terms)) doc.terms = [];
    await IOUtils.writeUTF8(path, JSON.stringify(doc, null, 2), { tmpPath: path + '.tmp' });
  },

  normalize(text) { return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase(); },
  newID(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); },

  phraseContainsTerm(phrase, termText) {
    var p = this.normalize(phrase);
    var t = this.normalize(termText);
    if (!p || !t) return false;
    if (p.indexOf(t) >= 0) return true;
    var words = t.split(/[^a-z0-9]+/).filter(function (x) { return x && x.length > 2; });
    if (!words.length) return false;
    // For a single word, require that word. For a multi-word phrase, require at
    // least the longest meaningful token to avoid unrelated phrases.
    words.sort(function (a, b) { return b.length - a.length; });
    return p.indexOf(words[0]) >= 0;
  },

  filterPhrasesForTerm(phrases, termText) {
    var plugin = this;
    var out = [];
    var seen = {};
    (phrases || []).forEach(function (phrase) {
      phrase = String(phrase || '').trim();
      if (!phrase) return;
      if (!plugin.phraseContainsTerm(phrase, termText)) return;
      var key = plugin.normalize(phrase);
      if (!seen[key]) { seen[key] = true; out.push(phrase); }
    });
    return out;
  },

  async refreshTerms(win, generation) {
    var p = this.panel(win); if (!p) return;
    if (!generation) generation = p.__wlRenderGeneration || this.currentGeneration(win);
    var doc = await this.readDocument();
    if (!this.isRenderCurrent(win, generation)) return;
    p = this.panel(win); if (!p) return;
    p._wlTerms = doc.terms || [];
    if (!this.selectedIdByWindow.get(win) && p._wlTerms.length) this.selectedIdByWindow.set(win, p._wlTerms[0].id);
    this.renderCard(win); this.renderList(win); this.renderAllWordsList(win); this.refreshTheme(win);
  },

  getSelectedTerm(win) {
    var p = this.panel(win);
    var terms = p ? (p._wlTerms || []) : [];
    if (!terms.length) return null;
    var selected = this.selectedIdByWindow.get(win);
    var term = selected ? terms.find(function (t) { return t.id === selected; }) : null;
    if (!term) {
      term = terms[0] || null;
      if (term && term.id) this.selectedIdByWindow.set(win, term.id);
    }
    return term;
  },

  syncEditDraftFromSelected(win) {
    var term = this.getSelectedTerm(win);
    if (term) {
      this.setDraft(win, term);
      return term;
    }
    this.setDraft(win, {});
    return null;
  },

  renderCard(win) {
    var p = this.panel(win); if (!p) return;
    var terms = p._wlTerms || [];
    var term = this.getSelectedTerm(win);
    var pos = term ? terms.findIndex(function (t) { return t.id === term.id; }) + 1 : 0;
    var posNode = p.querySelector('[data-role="card-pos"]'); if (posNode) posNode.textContent = pos + ' / ' + terms.length;
    var textNode = p.querySelector('[data-card="text"]'); if (textNode) textNode.textContent = term ? term.text || '(Untitled)' : 'No word selected';
    var pronNode = p.querySelector('[data-card="pronunciation"]'); if (pronNode) pronNode.textContent = term ? term.pronunciation || '' : '';
    var meaningNode = p.querySelector('[data-card="meaning"]'); if (meaningNode) meaningNode.textContent = term ? (term.chineseMeaning || '') : '';
    var contextNode = p.querySelector('[data-card="context"]'); if (contextNode) contextNode.textContent = term ? (term.contextExplanation || '') : '';
    var examplesNode = p.querySelector('[data-card="examples"]');
    if (examplesNode) examplesNode.textContent = term ? ((term.examples || []).map(function(e){return e.sentence;}).filter(Boolean).join('\n') || '') : '';
    var phraseBox = p.querySelector('[data-card="phrases"]');
    if (phraseBox) {
      while (phraseBox.firstChild) phraseBox.removeChild(phraseBox.firstChild);
      var phrases = term && Array.isArray(term.phrases) ? term.phrases : [];
      for (var i = 0; i < phrases.length; i++) {
        phraseBox.appendChild(this.html(win.document, 'span', { styleObj: { display: 'inline-flex', alignItems: 'center', minHeight: '28px', padding: '4px 10px', borderRadius: '8px', background: '#f3f4f6', color: '#374151', fontSize: '13px', boxSizing: 'border-box' } }, phrases[i]));
      }
      if (!phrases.length) phraseBox.appendChild(this.html(win.document, 'span', { styleObj: { color: '#9ca3af' } }, 'No related phrases.'));
    }
  },

  renderList(win) {
    var p = this.panel(win); if (!p) return;
    var list = p.querySelector('[data-role="term-list"]');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var terms = p._wlTerms || [];
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var item = this.html(win.document, 'div', { styleObj: { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: t.id === this.selectedIdByWindow.get(win) ? '#eff6ff' : '#fff' } });
      item.appendChild(this.html(win.document, 'div', { styleObj: { fontWeight: '700' } }, t.text || '(Untitled)'));
      item.appendChild(this.html(win.document, 'div', { styleObj: { color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, t.chineseMeaning || ''));
      item._termId = t.id;
      item.dataset.termId = t.id;
      var plugin = this;
      item.addEventListener('click', function (event) {
        var id = event.currentTarget._termId;
        var term = (plugin.panel(win)._wlTerms || []).find(function (x) { return x.id === id; });
        plugin.selectedIdByWindow.set(win, id);
        plugin.setDraft(win, term || {});
        plugin.renderCard(win); plugin.renderList(win);
        plugin.switchWordbookMode(win, 'card');
      });
      list.appendChild(item);
    }
    if (!terms.length) list.appendChild(this.html(win.document, 'div', { styleObj: { padding: '8px 10px', color: '#9ca3af' } }, 'No words yet.'));
  },

  moveSelection(win, delta) {
    var p = this.panel(win); var terms = p?._wlTerms || []; if (!terms.length) return;
    var id = this.selectedIdByWindow.get(win); var idx = terms.findIndex(function (t) { return t.id === id; });
    if (idx < 0) idx = 0;
    idx = (idx + delta + terms.length) % terms.length;
    this.selectedIdByWindow.set(win, terms[idx].id); this.setDraft(win, terms[idx]); this.renderCard(win); this.renderList(win); this.renderAllWordsList(win);
  },


  async saveDraftToDocument(win, draft, statusRole, clearAfterSave) {
    if (!draft.text) {
      this.status(win, statusRole || 'wordbook-status', 'Please enter a word or phrase.', 'err');
      return null;
    }
    var doc = await this.readDocument();
    var now = new Date().toISOString();
    var normalizedDraft = this.normalize(draft.text);
    var term = doc.terms.find((t) => this.normalize(t.text) === normalizedDraft) || null;
    if (!term) {
      term = {
        id: this.newID('term'),
        createdAt: now,
        examples: [],
        sources: [],
        wrongCount: 0,
        stats: { totalReviews: 0 }
      };
      doc.terms.push(term);
    }
    term.text = draft.text;
    term.normalizedText = normalizedDraft;
    term.pronunciation = draft.pronunciation;
    term.chineseMeaning = draft.chineseMeaning;
    term.contextExplanation = draft.contextExplanation;
    term.phrases = this.filterPhrasesForTerm(draft.phrases, draft.text);
    term.updatedAt = now;
    if (draft.example && !(term.examples || []).some(function (e) { return e.sentence === draft.example; })) {
      term.examples = term.examples || [];
      term.examples.push({ id: this.newID('example'), sentence: draft.example, createdAt: now });
    }
    await this.writeDocument(doc);
    this.selectedIdByWindow.set(win, term.id);
    this.status(win, statusRole || 'wordbook-status', 'Saved to global wordbook. Generating review distractors...', 'ok');
    await this.ensureLLMReviewDistractors(win, term, statusRole || 'wordbook-status', false);
    await this.refreshTerms(win);
    if (clearAfterSave) {
      this.clearAddDraft(win);
      this.status(win, statusRole || 'addword-status', 'Saved. Review distractors are ready when API settings are available. Ready for the next word.', 'ok');
    } else {
      this.status(win, statusRole || 'wordbook-status', 'Saved to global wordbook. Total words: ' + doc.terms.length + '.', 'ok');
    }
    return term;
  },

  async saveAddTerm(win) {
    var term = await this.saveDraftToDocument(win, this.getAddDraft(win), 'addword-status', true);
    if (term) {
      this.selectedIdByWindow.set(win, term.id);
      this.setDraft(win, term);
      this.renderCard(win);
      this.renderList(win);
      this.renderAllWordsList(win);
    }
  },

  async llmCompleteAdd(win, button) {
    var d = this.getAddDraft(win);
    if (!d.text) {
      this.status(win, 'addword-status', 'Please enter a word first.', 'err');
      return;
    }
    await this.llmCompleteDraft(win, button, d, 'addword-status', function (data, plugin) {
      if (data.pronunciation) plugin.addField(win, 'pronunciation').value = data.pronunciation;
      if (data.chineseMeaning) plugin.addField(win, 'chineseMeaning').value = data.chineseMeaning;
      if (data.contextExplanation) plugin.addField(win, 'contextExplanation').value = data.contextExplanation;
      if (Array.isArray(data.phrases)) plugin.addField(win, 'phrases').value = plugin.filterPhrasesForTerm(data.phrases, d.text).join('\n');
    });
  },

  async saveTerm(win) {
    var draft = this.getDraft(win);
    if (!draft.text) {
      this.status(win, 'wordbook-status', 'Please enter a word or phrase.', 'err');
      return;
    }

    var doc = await this.readDocument();
    var now = new Date().toISOString();
    var normalizedDraft = this.normalize(draft.text);
    var selectedId = draft.id || '';
    var selectedTerm = selectedId ? doc.terms.find(function (t) { return t.id === selectedId; }) : null;
    var selectedSameText = selectedTerm && this.normalize(selectedTerm.text) === normalizedDraft;

    // Important: If the user edits the Word/Phrase field while another card is
    // selected, treat it as a new term instead of overwriting the old selected
    // card.  This fixes the previous behaviour where adding a second word
    // replaced the first word.
    var term = selectedSameText ? selectedTerm : null;
    if (!term) {
      term = doc.terms.find((t) => this.normalize(t.text) === normalizedDraft) || null;
    }
    if (!term) {
      term = {
        id: this.newID('term'),
        createdAt: now,
        examples: [],
        sources: [],
        wrongCount: 0,
        stats: { totalReviews: 0 }
      };
      doc.terms.push(term);
    }

    term.text = draft.text;
    term.normalizedText = normalizedDraft;
    term.pronunciation = draft.pronunciation;
    term.chineseMeaning = draft.chineseMeaning;
    term.contextExplanation = draft.contextExplanation;
    term.phrases = this.filterPhrasesForTerm(draft.phrases, draft.text);
    term.updatedAt = now;

    if (draft.example && !(term.examples || []).some(function (e) { return e.sentence === draft.example; })) {
      term.examples = term.examples || [];
      term.examples.push({ id: this.newID('example'), sentence: draft.example, createdAt: now });
    }

    await this.writeDocument(doc);
    this.selectedIdByWindow.set(win, term.id);
    this.status(win, 'wordbook-status', 'Saved to global wordbook. Generating review distractors...', 'ok');
    await this.ensureLLMReviewDistractors(win, term, 'wordbook-status', false);
    await this.refreshTerms(win);
    this.setDraft(win, term);
    this.status(win, 'wordbook-status', 'Saved to global wordbook. Total words: ' + doc.terms.length + '.', 'ok');
    this.switchWordbookMode(win, 'card');
  },

  async deleteTerm(win) {
    var id = this.selectedIdByWindow.get(win); if (!id) return;
    var doc = await this.readDocument(); doc.terms = (doc.terms || []).filter(function (t) { return t.id !== id; }); await this.writeDocument(doc);
    this.selectedIdByWindow.set(win, ''); this.setDraft(win, {}); this.status(win, 'wordbook-status', 'Deleted.', 'ok'); await this.refreshTerms(win);
  },

  providerDefaults(provider) {
    provider = String(provider || '').toLowerCase();
    var defaults = {
      openai: { apiUrl: 'https://api.openai.com/v1', modelName: 'gpt-4.1-mini' },
      deepseek: { apiUrl: 'https://api.deepseek.com', modelName: 'deepseek-v4-flash' },
      gemini: { apiUrl: 'https://generativelanguage.googleapis.com', modelName: 'gemini-2.0-flash' },
      anthropic: { apiUrl: 'https://api.anthropic.com', modelName: 'claude-3-5-haiku-latest' },
      minimax: { apiUrl: '', modelName: '' },
      glm: { apiUrl: '', modelName: '' },
      grok: { apiUrl: 'https://api.x.ai/v1', modelName: 'grok-3-mini' },
      qwen: { apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-plus' },
      kimi: { apiUrl: 'https://api.moonshot.cn/v1', modelName: 'moonshot-v1-8k' },
      custom: { apiUrl: '', modelName: '' }
    };
    return defaults[provider] || defaults.custom;
  },

  normalizeSettings(s) {
    s = s || {};
    var provider = String(s.llmProvider || 'custom').toLowerCase();
    var defaults = this.providerDefaults(provider);
    if (!String(s.apiUrl || '').trim()) s.apiUrl = defaults.apiUrl;
    if (!String(s.modelName || '').trim()) s.modelName = defaults.modelName;

    // DeepSeek's OpenAI-compatible base URL is https://api.deepseek.com .
    // The /anthropic path is only for Anthropic-compatible requests.  If the
    // provider is DeepSeek, using /anthropic would make the plugin call
    // /anthropic/chat/completions and usually produce HTTP 404.
    if (provider === 'deepseek' && /\/anthropic\/?$/i.test(String(s.apiUrl || '').trim())) {
      s.apiUrl = 'https://api.deepseek.com';
    }
    s.reasoningEffort = String(s.reasoningEffort || 'default').toLowerCase();
    if (!/^(default|low|medium|high)$/.test(s.reasoningEffort)) s.reasoningEffort = 'default';
    if (!this.supportsReasoningEffort(provider, s.modelName)) s.reasoningEffort = 'default';
    s.speechStyle = String(s.speechStyle || 'system');
    if (s.speechStyle.indexOf('voice:') !== 0 && !/^(auto-female|auto-male|natural|slow|system)$/i.test(s.speechStyle)) {
      s.speechStyle = 'system';
    }
    return s;
  },

  supportsReasoningEffort(provider, modelName) {
    provider = String(provider || '').toLowerCase();
    var model = String(modelName || '').toLowerCase();
    if (provider === 'gemini') {
      return /gemini[-_ ]?2\.5|thinking/.test(model);
    }
    if (provider === 'anthropic') {
      return /claude[-_ ]?(3\.7|4)|sonnet[-_ ]?4|opus[-_ ]?4/.test(model);
    }
    if (provider === 'openai') {
      return /(^|[-_])o[134]($|[-_])|gpt[-_]?5|reasoning/.test(model);
    }
    if (provider === 'deepseek') {
      // DeepSeek thinking models support thinking + reasoning_effort.
      // Enable controls for v4-flash, v4-pro, and legacy deepseek-reasoner.
      return /deepseek[-_ ]?v4[-_ ]?flash|deepseek[-_ ]?v4[-_ ]?pro|deepseek[-_ ]?reasoner|reasoner|thinking/.test(model);
    }
    if (provider === 'grok') {
      return /reasoning|mini/.test(model);
    }
    if (provider === 'custom') {
      return /(^|[-_])o[134]($|[-_])|gpt[-_]?5|reasoning|thinking|qwq/.test(model);
    }
    return false;
  },

  updateReasoningControl(win) {
    var p = this.panel(win); if (!p) return;
    var providerNode = p.querySelector('[data-setting="llmProvider"]');
    var modelNode = p.querySelector('[data-setting="modelName"]');
    var reasoningNode = p.querySelector('[data-setting="reasoningEffort"]');
    if (!reasoningNode) return;
    var provider = providerNode ? providerNode.value : 'custom';
    var model = modelNode ? modelNode.value : '';
    var supported = this.supportsReasoningEffort(provider, model);
    reasoningNode.disabled = !supported;
    if (!supported) reasoningNode.value = 'default';
    reasoningNode.style.background = supported ? '#fff' : '#f3f4f6';
    reasoningNode.style.color = supported ? '#111827' : '#9ca3af';
    reasoningNode.style.cursor = supported ? 'pointer' : 'not-allowed';
    reasoningNode.title = supported ?
      (this.isChineseUI() ? '该模型支持思考强度。' : 'This model supports thinking intensity.') :
      (this.isChineseUI() ? '当前服务商或模型未检测到可配置的思考强度，使用默认。' : 'No configurable thinking intensity detected for this provider/model; using default.');
  },

  applyProviderDefaults(win, force) {
    var p = this.panel(win); if (!p) return;
    var providerNode = p.querySelector('[data-setting="llmProvider"]');
    var apiNode = p.querySelector('[data-setting="apiUrl"]');
    var modelNode = p.querySelector('[data-setting="modelName"]');
    var provider = providerNode ? providerNode.value : 'custom';
    var defaults = this.providerDefaults(provider);
    var currentApi = apiNode ? String(apiNode.value || '').trim() : '';
    if (apiNode && (force || !currentApi || /\/anthropic\/?$/i.test(currentApi) && provider === 'deepseek')) {
      apiNode.value = defaults.apiUrl || '';
    }
    if (modelNode && (force || !String(modelNode.value || '').trim())) {
      modelNode.value = defaults.modelName || '';
    }
    if (provider === 'deepseek') {
      this.status(win, 'settings-status', 'DeepSeek provider uses OpenAI-compatible endpoint: https://api.deepseek.com/chat/completions. Thinking intensity is enabled for deepseek-v4-flash / deepseek-v4-pro / deepseek-reasoner-style thinking models.', '');
    }
    this.updateReasoningControl(win);
  },

  prefGet(key, fallback) {
    try {
      var value = Zotero.Prefs.get('extensions.word-learning.' + key, true);
      if (value !== undefined && value !== null && value !== '') return value;
    } catch (e) {}
    try {
      var value2 = Zotero.Prefs.get('extensions.word-learning.' + key);
      if (value2 !== undefined && value2 !== null && value2 !== '') return value2;
    } catch (e) {}
    return fallback;
  },

  prefSet(key, value) {
    try { Zotero.Prefs.set('extensions.word-learning.' + key, value, true); } catch (e) {}
    try { Zotero.Prefs.set('extensions.word-learning.' + key, value); } catch (e) {}
  },

  getSettings() {
    return {
      language: this.prefGet('language', 'zh-CN'),
      llmProvider: this.prefGet('llmProvider', 'deepseek'),
      apiUrl: this.prefGet('apiUrl', 'https://api.deepseek.com'),
      modelName: this.prefGet('modelName', 'deepseek-v4-flash'),
      reasoningEffort: this.prefGet('reasoningEffort', 'default'),
      speechStyle: this.prefGet('speechStyle', 'system'),
      apiKey: this.prefGet('apiKey', ''),
      dataPath: this.prefGet('dataPath', '')
    };
  },

  loadSettings(win) {
    var p = this.panel(win); if (!p) return; var s = this.getSettings();
    for (var k in s) {
      var n = p.querySelector('[data-setting="' + k + '"]');
      if (n) {
        n.value = s[k] || '';
        if (k === 'speechStyle' && n.value !== (s[k] || '') && n.options.length) {
          n.selectedIndex = 0;
          this.prefSet('speechStyle', n.value || 'system');
        }
      }
    }
    this.updateReasoningControl(win);
  },

  settingsFromPanel(win) {
    var p = this.panel(win); var s = {}; var nodes = p.querySelectorAll('[data-setting]');
    for (var i = 0; i < nodes.length; i++) s[nodes[i].dataset.setting] = nodes[i].value || '';
    return this.normalizeSettings(s);
  },


  async migrateDataPathIfNeeded(oldPath, newPath) {
    oldPath = String(oldPath || '').trim();
    newPath = String(newPath || '').trim();
    if (!oldPath || !newPath || oldPath === newPath) {
      return { copied: false, reason: 'unchanged' };
    }
    try {
      var oldExists = await IOUtils.exists(oldPath);
      var newExists = await IOUtils.exists(newPath);
      if (!oldExists) {
        return { copied: false, reason: 'old-missing' };
      }
      if (newExists) {
        return { copied: false, reason: 'new-exists' };
      }
      await IOUtils.makeDirectory(PathUtils.parent(newPath), { createAncestors: true });
      var content = await IOUtils.readUTF8(oldPath);
      await IOUtils.writeUTF8(newPath, content, { tmpPath: newPath + '.tmp' });
      return { copied: true, reason: 'copied' };
    } catch (e) {
      this.debug('migrateDataPathIfNeeded failed: ' + e);
      return { copied: false, reason: 'error', error: e };
    }
  },

  async saveSettings(win) {
    var oldPath = this.getDataPath();
    var s = this.settingsFromPanel(win);
    var p = this.panel(win);
    for (var k in s) {
      this.prefSet(k, s[k]);
      var n = p ? p.querySelector('[data-setting="' + k + '"]') : null;
      if (n && n.value !== s[k]) n.value = s[k];
    }
    var newPath = this.getDataPath();
    var migration = await this.migrateDataPathIfNeeded(oldPath, newPath);

    // Rebuild the whole panel after saving settings so static labels and
    // the effective database path are regenerated.
    this.rebuildPanelUI(win, 'settings');
    await this.refreshTerms(win);

    var msg = this.isChineseUI() ? '设置已保存。' : 'Settings saved.';
    if (oldPath !== newPath) {
      if (migration.copied) {
        msg += this.isChineseUI() ? ' 新路径没有数据库，已自动复制旧数据库到新路径。' : ' The new path had no database, so the old database was copied automatically.';
      } else if (migration.reason === 'new-exists') {
        msg += this.isChineseUI() ? ' 新路径已有数据库，已直接使用新路径数据。' : ' The new path already has a database; using that data.';
      } else if (migration.reason === 'old-missing') {
        msg += this.isChineseUI() ? ' 旧路径没有数据库，新路径将从空词库开始。' : ' No database existed at the old path; the new path will start empty.';
      } else if (migration.reason === 'error') {
        msg += this.isChineseUI() ? ' 自动复制旧数据库失败，请检查路径权限或手动复制。' : ' Automatic database copy failed; check permissions or copy manually.';
      } else {
        msg += this.isChineseUI() ? ' 数据库路径已更改。' : ' Database path changed.';
      }
    } else {
      msg += this.isChineseUI() ? ' 界面语言已更新。' : ' UI language updated.';
    }
    this.status(win, 'settings-status', msg, migration.reason === 'error' ? 'err' : 'ok');
  },

  joinUrl(base, suffix) { base = String(base || '').trim().replace(/\/+$/, ''); if (!base) return suffix; if (base.endsWith('/chat/completions') || base.endsWith('/v1/messages') || base.indexOf(':generateContent') >= 0) return base; return base + suffix; },
  thinkingBudgetForEffort(effort) {
    effort = String(effort || 'default').toLowerCase();
    if (effort === 'low') return 1024;
    if (effort === 'medium') return 4096;
    if (effort === 'high') return 8192;
    return 0;
  },

  buildChatRequest(s, userText, maxTokens) {
    s = this.normalizeSettings(s);
    var provider = String(s.llmProvider || 'custom').toLowerCase();
    var effort = String(s.reasoningEffort || 'default').toLowerCase();
    var useReasoning = effort !== 'default' && this.supportsReasoningEffort(provider, s.modelName);

    if (provider === 'anthropic') {
      var bodyA = { model: s.modelName, max_tokens: maxTokens, messages: [{ role: 'user', content: userText }] };
      if (useReasoning) {
        var budgetA = this.thinkingBudgetForEffort(effort);
        bodyA.thinking = { type: 'enabled', budget_tokens: budgetA };
        bodyA.max_tokens = Math.max(maxTokens, budgetA + 1024);
      }
      return { url: this.joinUrl(s.apiUrl, '/v1/messages'), headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01' }, body: bodyA };
    }

    if (provider === 'gemini') {
      var url = s.apiUrl.indexOf(':generateContent') >= 0 ? s.apiUrl : s.apiUrl.replace(/\/+$/, '') + '/v1beta/models/' + encodeURIComponent(s.modelName) + ':generateContent?key=' + encodeURIComponent(s.apiKey);
      var gen = { temperature: 0, maxOutputTokens: maxTokens };
      if (useReasoning) gen.thinkingConfig = { thinkingBudget: this.thinkingBudgetForEffort(effort) };
      return { url: url, headers: { 'content-type': 'application/json' }, body: { contents: [{ parts: [{ text: userText }] }], generationConfig: gen } };
    }

    var body = { model: s.modelName, temperature: 0, max_tokens: maxTokens, messages: [{ role: 'user', content: userText }] };
    if (useReasoning) {
      body.reasoning_effort = effort;
      if (provider === 'deepseek') {
        // DeepSeek requires thinking mode enabled together with reasoning_effort.
        body.thinking = { type: 'enabled' };
      }
    }
    return { url: this.joinUrl(s.apiUrl, '/chat/completions'), headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + s.apiKey }, body: body };
  },

  async fetchWithTimeout(url, options) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null; var timer = controller ? setTimeout(function () { controller.abort(); }, 25000) : null;
    try { return await fetch(url, Object.assign({}, options, { signal: controller ? controller.signal : undefined })); } finally { if (timer) clearTimeout(timer); }
  },

  contentFromResponse(json) { return json?.choices?.[0]?.message?.content || json?.content?.[0]?.text || json?.candidates?.[0]?.content?.parts?.[0]?.text || ''; },

  async testConnection(win, button) {
    var generation = this.currentGeneration(win);
    this.saveSettings(win); var s = this.settingsFromPanel(win); if (!s.apiUrl || !s.modelName || !s.apiKey) { this.status(win, 'settings-status', 'Missing API URL, model name, or API key.', 'err'); return; }
    var req = this.buildChatRequest(s, 'Reply with OK.', 32); if (button) button.disabled = true; this.status(win, 'settings-status', 'Testing...\nPOST ' + req.url, '');
    try { var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }); var text = await res.text(); if (!this.isRenderCurrent(win, generation)) return; this.status(win, 'settings-status', (res.ok ? 'Success' : 'Failure') + ': HTTP ' + res.status + '\n' + text.slice(0, 700), res.ok ? 'ok' : 'err'); }
    catch (e) { if (this.isRenderCurrent(win, generation)) this.status(win, 'settings-status', 'Failure: ' + (e.message || e), 'err'); } finally { try { if (this.isRenderCurrent(win, generation) && button) button.disabled = false; } catch (e) {} }
  },


  async llmCompleteDraft(win, button, d, statusRole, applyData) {
    var generation = this.currentGeneration(win);
    // Do not call saveSettings() here. saveSettings() rebuilds the panel after
    // language changes, which caused LLM Complete to jump to the Settings page.
    // Read the current settings only.
    var s = this.normalizeSettings(this.settingsFromPanel(win));
    var prompt = [
      '你是一名专业的计算机视觉和机器学习论文阅读助手。',
      '请根据用户在论文中摘出的英文单词或短语，生成适合中文读者的学术词汇卡片。',
      '必须只返回严格 JSON，不要 Markdown，不要代码块，不要解释 JSON 外的文字。',
      'JSON keys 必须是 pronunciation, chineseMeaning, contextExplanation, phrases。',
      'pronunciation: 给出英语音标；如果是短语，可给核心词音标或留空字符串。',
      'chineseMeaning: 必须用中文给出简洁准确的释义。',
      'contextExplanation: 必须用中文，结合计算机视觉/机器学习论文语境解释该词在当前句子中的含义，不要写英文解释。',
      'phrases: 必须是数组；每个短语都必须包含原词/短语本身，或者包含原词/短语的核心英文词形；不要给不包含该词的泛泛相关短语。',
      'Word or phrase: ' + d.text,
      'Example sentence from paper: ' + (d.example || '')
    ].join('\n');
    var req = this.buildChatRequest(s, prompt, 900);
    button.disabled = true;
    this.status(win, statusRole || 'wordbook-status', 'LLM completing...', '');
    try {
      var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
      var text = await res.text();
      if (!this.isRenderCurrent(win, generation)) return;
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 500));
      var content = this.contentFromResponse(JSON.parse(text)).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      var data = JSON.parse(content);
      applyData(data, this);
      this.status(win, statusRole || 'wordbook-status', 'LLM suggestions filled. Review/edit, then Save.', 'ok');
    } catch (e) {
      this.status(win, statusRole || 'wordbook-status', 'LLM completion failed: ' + (e.message || e), 'err');
    } finally {
      try { if (this.isRenderCurrent(win, generation) && button) button.disabled = false; } catch (e) {}
    }
  },

  async llmComplete(win, button) {
    var d = this.getDraft(win);
    if (!d.text) {
      this.status(win, 'wordbook-status', 'Please enter a word first.', 'err');
      return;
    }
    await this.llmCompleteDraft(win, button, d, 'wordbook-status', function (data, plugin) {
      if (data.pronunciation) plugin.field(win, 'pronunciation').value = data.pronunciation;
      if (data.chineseMeaning) plugin.field(win, 'chineseMeaning').value = data.chineseMeaning;
      if (data.contextExplanation) plugin.field(win, 'contextExplanation').value = data.contextExplanation;
      if (Array.isArray(data.phrases)) plugin.field(win, 'phrases').value = plugin.filterPhrasesForTerm(data.phrases, d.text).join('\n');
    });
  },

  getReviewCount(win) {
    var p = this.panel(win);
    var node = p ? p.querySelector('[data-role="review-count"]') : null;
    var n = parseInt(node && node.value ? node.value : '10', 10);
    if (!Number.isFinite(n) || n < 1) n = 10;
    return n;
  },

  startReview(win) {
    this.switchTab(this.panel(win), 'review');
    var p = this.panel(win);
    var allTerms = (p?._wlTerms || []).slice();
    var requested = this.getReviewCount(win);
    var count = Math.min(requested, allTerms.length);
    var selectedTerms = this.weightedSampleTerms(allTerms, count);
    var tasks = [];
    for (var i = 0; i < selectedTerms.length; i++) {
      var term = selectedTerms[i];
      tasks.push({ term: term, type: 'meaning', key: term.id + ':meaning' });
      tasks.push({ term: term, type: 'example', key: term.id + ':example', example: this.randomExampleForTerm(term) });
      tasks.push({ term: term, type: 'spelling', key: term.id + ':spelling' });
    }
    tasks = this.shuffleTerms(tasks);
    this.reviewSessionByWindow.set(win, {
      selectedTerms: selectedTerms,
      tasks: tasks,
      requested: requested,
      count: count,
      completedById: {},
      choicesById: {}
    });
    this.reviewIndexByWindow.set(win, 0);
    this.status(win, 'review-status',
      count ? ((this.isChineseUI() ? '已开始复习：' : 'Review started: ') + count + (this.isChineseUI() ? ' 个词，' : ' words, ') + tasks.length + (this.isChineseUI() ? ' 道题。' : ' questions.')) :
        (this.isChineseUI() ? '词库为空，无法开始复习。' : 'No words available for review.'),
      count ? 'ok' : 'err'
    );
    this.renderReview(win);
  },

  shuffleTerms(terms) {
    var arr = (terms || []).slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  },


  reviewWeight(term) {
    var wrong = Number(term && term.wrongCount || 0);
    if (!Number.isFinite(wrong) || wrong < 0) wrong = 0;
    return 1 + Math.min(10, wrong) * 2;
  },

  weightedSampleTerms(terms, count) {
    var pool = (terms || []).slice();
    var selected = [];
    count = Math.min(count || 0, pool.length);
    while (selected.length < count && pool.length) {
      var total = 0;
      for (var i = 0; i < pool.length; i++) total += this.reviewWeight(pool[i]);
      var r = Math.random() * total;
      var pick = 0;
      for (var j = 0; j < pool.length; j++) {
        r -= this.reviewWeight(pool[j]);
        if (r <= 0) { pick = j; break; }
      }
      selected.push(pool.splice(pick, 1)[0]);
    }
    return selected;
  },

  getReviewSessionTerms(win) {
    var session = this.reviewSessionByWindow.get(win);
    if (session && Array.isArray(session.selectedTerms)) return session.selectedTerms;
    var p = this.panel(win);
    return p?._wlTerms || [];
  },

  getReviewSessionTasks(win) {
    var session = this.reviewSessionByWindow.get(win);
    if (session && Array.isArray(session.tasks)) return session.tasks;
    return [];
  },

  getCurrentReviewTask(win) {
    var tasks = this.getReviewSessionTasks(win);
    return tasks.length ? tasks[0] : null;
  },

  countCompletedReviewWords(win) {
    var session = this.reviewSessionByWindow.get(win) || {};
    var selected = Array.isArray(session.selectedTerms) ? session.selectedTerms : [];
    var completed = session.completedById || {};
    var n = 0;
    for (var i = 0; i < selected.length; i++) {
      var state = completed[selected[i].id] || {};
      if (state.meaning && state.example && state.spelling) n++;
    }
    return n;
  },

  markReviewTaskComplete(win, task) {
    if (!task || !task.term || !task.term.id) return;
    var session = this.reviewSessionByWindow.get(win) || {};
    if (!session.completedById) session.completedById = {};
    if (!session.completedById[task.term.id]) session.completedById[task.term.id] = {};
    session.completedById[task.term.id][task.type || 'meaning'] = true;
    this.reviewSessionByWindow.set(win, session);
  },

  buildMeaningChoices(win, term) {
    var p = this.panel(win);
    var allTerms = (p?._wlTerms || []).slice();
    var correct = term && term.chineseMeaning ? String(term.chineseMeaning).trim() : '';
    var choices = [];
    if (correct) {
      choices.push({ text: correct, correct: true, sourceText: term.text || '' });
    }

    // Prefer LLM-generated close distractors when cached on the term.  These are
    // designed to be semantically close, but still incorrect, and each includes
    // the likely source term to show on the right when the user chooses it.
    var cached = Array.isArray(term?.reviewDistractors) ? term.reviewDistractors : [];
    for (var cidx = 0; cidx < cached.length && choices.length < 4; cidx++) {
      var d = cached[cidx] || {};
      var meaning = String(d.meaning || '').trim();
      if (!meaning) continue;
      if (choices.some(function (c) { return c.text === meaning; })) continue;
      if (correct && this.normalize(meaning) === this.normalize(correct)) continue;
      choices.push({
        text: meaning,
        correct: false,
        sourceText: String(d.sourceTerm || '').trim(),
        explanation: String(d.explanation || '').trim()
      });
    }

    // Fallback to meanings from other saved words while the LLM distractors are
    // being generated, or when no API settings are available.
    var distractors = this.shuffleTerms(allTerms.filter(function (x) {
      return x && x.id !== term.id && x.chineseMeaning && String(x.chineseMeaning).trim();
    }));
    for (var i = 0; i < distractors.length && choices.length < 4; i++) {
      var meaning2 = String(distractors[i].chineseMeaning || '').trim();
      if (!meaning2) continue;
      if (choices.some(function (c) { return c.text === meaning2; })) continue;
      choices.push({ text: meaning2, correct: false, sourceText: distractors[i].text || '' });
    }
    var fallback = this.isChineseUI() ?
      ['该术语在论文语境中的一种解释', '与模型训练过程相关的概念', '用于描述数据或实验结果的术语', '表示视觉任务中的一种方法'] :
      ['A term-specific meaning in the paper context', 'A concept related to model training', 'A term describing data or experiment results', 'A method used in a vision task'];
    for (var j = 0; j < fallback.length && choices.length < 4; j++) {
      if (!choices.some(function (c) { return c.text === fallback[j]; })) choices.push({ text: fallback[j], correct: false, sourceText: '' });
    }
    return this.shuffleTerms(choices).slice(0, 4);
  },

  shouldGenerateReviewDistractors(term) {
    if (!term || !term.id || !term.text || !term.chineseMeaning) return false;
    var cached = Array.isArray(term.reviewDistractors) ? term.reviewDistractors : [];
    return cached.length < 3 || term.reviewDistractorMode !== 'english_similarity_v1';
  },

  async ensureLLMReviewDistractors(win, term, statusRole, renderAfter) {
    var generation = this.currentGeneration(win);
    if (!this.shouldGenerateReviewDistractors(term)) return;
    var p = this.panel(win);
    if (!p) return;
    var session = this.reviewSessionByWindow.get(win) || {};
    if (!session.loadingDistractors) session.loadingDistractors = {};
    if (session.loadingDistractors[term.id]) return;
    session.loadingDistractors[term.id] = true;
    this.reviewSessionByWindow.set(win, session);

    var settings = this.normalizeSettings(this.settingsFromPanel(win));
    if (!settings.apiUrl || !settings.modelName || !settings.apiKey) {
      return;
    }

    var example = term.examples && term.examples[0] && term.examples[0].sentence ? term.examples[0].sentence : '';
    var prompt = [
      '你是一名学术英语词汇训练出题专家，尤其擅长设计“形近词/音近词/拼写相近词”的混淆选项。',
      '',
      '任务：',
      '给定一个英文单词或短语、它在论文中的例句、正确中文释义、上下文解释，请生成 3 个容易与该英文词混淆、但含义错误的中文释义选项，用于四选一复习题。',
      '',
      '核心原则：',
      '混淆项优先根据英文外形或读音相似来设计，而不是根据机器学习概念相似来设计。',
      '例如 genre 的混淆词可以接近 gene、genera、tenure 这类拼写或读音相近的英文词；然后 meaning 写这些相似英文词对应的中文释义。',
      '',
      '要求：',
      '1. 必须只返回严格 JSON，不要 Markdown，不要代码块，不要解释。',
      '2. 输出 JSON keys 必须为 distractors。',
      '3. distractors 必须是长度为 3 的数组。',
      '4. 每个 distractor 必须包含 meaning、sourceTerm、explanation。',
      '5. sourceTerm 必须是英文单词或英文短语，且必须和目标词在拼写、词形、词根、发音或视觉外观上相近。',
      '6. meaning 必须是 sourceTerm 的中文释义，尽量短，不要写复杂长句。',
      '7. explanation 必须用中文说明为什么容易混淆，例如“拼写相近”“读音相近”“词根相近”，控制在 20 字以内。',
      '8. 不要优先生成抽象的机器学习概念干扰项，除非它同时也是英文形近/音近词。',
      '9. 不允许生成与正确中文释义等价或几乎等价的选项。',
      '10. 不允许包含“以上都不对”“无法判断”“都正确”等无效选项。',
      '',
      '英文单词或短语：' + (term.text || ''),
      '论文例句：' + example,
      '正确中文释义：' + (term.chineseMeaning || ''),
      '上下文解释：' + (term.contextExplanation || ''),
      '',
      '输出格式示例：',
      '{"distractors":[{"meaning":"基因","sourceTerm":"gene","explanation":"拼写和读音相近。"},{"meaning":"属；类","sourceTerm":"genera","explanation":"词形相近。"},{"meaning":"任期；终身教职","sourceTerm":"tenure","explanation":"视觉外观相近。"}]}'
    ].join('\n');

    try {
      this.status(win, statusRole || 'review-status', this.isChineseUI() ? '正在生成形近/音近混淆释义...' : 'Generating spelling/sound-alike distractors...', '');
      var req = this.buildChatRequest(settings, prompt, 900);
      var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
      var text = await res.text();
      if (!this.isRenderCurrent(win, generation)) return;
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 500));
      var content = this.contentFromResponse(JSON.parse(text)).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      var data = JSON.parse(content);
      var arr = Array.isArray(data.distractors) ? data.distractors : [];
      var clean = [];
      var seen = {};
      for (var i = 0; i < arr.length && clean.length < 3; i++) {
        var item = arr[i] || {};
        var meaning = String(item.meaning || '').trim();
        var sourceTerm = String(item.sourceTerm || '').trim();
        var explanation = String(item.explanation || '').trim();
        if (!meaning) continue;
        if (this.normalize(meaning) === this.normalize(term.chineseMeaning || '')) continue;
        var key = this.normalize(meaning);
        if (seen[key]) continue;
        seen[key] = true;
        clean.push({ meaning: meaning, sourceTerm: sourceTerm, explanation: explanation });
      }
      if (clean.length) {
        await this.saveReviewDistractors(win, term.id, clean);
        var fresh = this.getCurrentReviewTerm(win);
        if (renderAfter !== false && fresh && fresh.id === term.id) {
          var latestSession = this.reviewSessionByWindow.get(win) || {};
          if (latestSession.choicesById) {
            delete latestSession.choicesById[term.id];
            delete latestSession.choicesById[term.id + ':meaning'];
            delete latestSession.choicesById[term.id + ':example'];
          }
          this.reviewSessionByWindow.set(win, latestSession);
          this.renderReview(win);
        }
      }
    } catch (e) {
      this.status(win, statusRole || 'review-status', (this.isChineseUI() ? '混淆释义生成失败：' : 'Distractor generation failed: ') + (e.message || e), 'err');
    } finally {
      var doneSession = this.reviewSessionByWindow.get(win) || {};
      if (doneSession.loadingDistractors) delete doneSession.loadingDistractors[term.id];
      this.reviewSessionByWindow.set(win, doneSession);
    }
  },

  async saveReviewDistractors(win, termId, distractors) {
    var doc = await this.readDocument();
    var term = (doc.terms || []).find(function (t) { return t.id === termId; });
    if (!term) return;
    term.reviewDistractors = distractors;
    term.reviewDistractorMode = 'english_similarity_v1';
    term.reviewDistractorsUpdatedAt = new Date().toISOString();
    await this.writeDocument(doc);

    var p = this.panel(win);
    if (p && Array.isArray(p._wlTerms)) {
      var local = p._wlTerms.find(function (t) { return t.id === termId; });
      if (local) {
        local.reviewDistractors = distractors;
        local.reviewDistractorMode = 'english_similarity_v1';
        local.reviewDistractorsUpdatedAt = term.reviewDistractorsUpdatedAt;
      }
    }
  },

  getCurrentReviewTerm(win) {
    var task = this.getCurrentReviewTask(win);
    return task && task.term ? task.term : null;
  },


  randomExampleForTerm(term) {
    var examples = term && Array.isArray(term.examples) ? term.examples.filter(function (e) {
      return e && e.sentence && String(e.sentence).trim();
    }) : [];
    if (!examples.length) return '';
    var idx = Math.floor(Math.random() * examples.length);
    return String(examples[idx].sentence || '').trim();
  },

  getReviewItem(win, term) {
    var task = this.getCurrentReviewTask(win);
    if (task && task.term && term && task.term.id === term.id) {
      return {
        type: task.type || 'meaning',
        example: task.type === 'example' ? (task.example || this.randomExampleForTerm(term)) : ''
      };
    }
    return { type: 'meaning', example: '' };
  },

  reviewPromptText(win, item) {
    if (item && item.type === 'spelling') {
      return this.isChineseUI() ? '根据音标和释义拼写该单词/短语' : 'Spell the word or phrase from the pronunciation and meaning';
    }
    if (item && item.type === 'example') {
      return this.isChineseUI() ? '根据单词和例句，选择最合适的中文释义' : 'Choose the best Chinese meaning from the word and example';
    }
    return this.isChineseUI() ? '请选择最合适的中文释义' : 'Choose the best Chinese meaning';
  },


  normalizeSpellingChar(ch) {
    return String(ch || '').toLowerCase();
  },

  buildSpellingSlots(win, term) {
    var p = this.panel(win);
    if (!p || !term) return;
    var doc = p.ownerDocument;
    var slots = p.querySelector('[data-role="review-spelling-slots"]');
    if (!slots) return;
    while (slots.firstChild) slots.removeChild(slots.firstChild);
    var target = String(term.text || '');
    var plugin = this;
    var letterIndex = 0;
    for (var i = 0; i < target.length; i++) {
      var ch = target[i];
      if (ch === ' ') {
        slots.appendChild(this.html(doc, 'span', {
          styleObj: { width: '14px', display: 'inline-block' }
        }, ''));
        continue;
      }
      var input = this.html(doc, 'input', {
        type: 'text',
        maxlength: '1',
        dataset: { role: 'review-spell-char', target: ch, letterIndex: String(letterIndex) },
        styleObj: {
          width: '28px',
          height: '36px',
          border: '0',
          borderBottom: '2px solid #9ca3af',
          borderRadius: '0',
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: '700',
          outline: 'none',
          background: '#fff',
          color: '#111827',
          boxSizing: 'border-box'
        }
      });
      input.addEventListener('input', function (event) {
        var node = event.currentTarget;
        if (node.value.length > 1) node.value = node.value.slice(-1);
        plugin.checkSpellingInput(win);
        if (node.value && node.style.borderBottomColor === 'rgb(34, 197, 94)') {
          var next = plugin.nextSpellInput(win, node);
          if (next) {
            try { next.focus(); } catch (e) {}
          }
        }
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Backspace' && !event.currentTarget.value) {
          var prev = plugin.prevSpellInput(win, event.currentTarget);
          if (prev) {
            try { prev.focus(); } catch (e) {}
          }
        }
      });
      slots.appendChild(input);
      letterIndex++;
    }
    var first = slots.querySelector('[data-role="review-spell-char"]');
    if (first) {
      try { first.focus(); } catch (e) {}
    }
  },

  nextSpellInput(win, node) {
    var p = this.panel(win);
    var inputs = Array.prototype.slice.call(p.querySelectorAll('[data-role="review-spell-char"]'));
    var i = inputs.indexOf(node);
    return i >= 0 && i + 1 < inputs.length ? inputs[i + 1] : null;
  },

  prevSpellInput(win, node) {
    var p = this.panel(win);
    var inputs = Array.prototype.slice.call(p.querySelectorAll('[data-role="review-spell-char"]'));
    var i = inputs.indexOf(node);
    return i > 0 ? inputs[i - 1] : null;
  },

  checkSpellingInput(win) {
    var p = this.panel(win);
    if (!p) return false;
    var inputs = Array.prototype.slice.call(p.querySelectorAll('[data-role="review-spell-char"]'));
    var allFilled = true;
    var allCorrect = true;
    for (var i = 0; i < inputs.length; i++) {
      var node = inputs[i];
      var value = this.normalizeSpellingChar(node.value || '');
      var target = this.normalizeSpellingChar(node.dataset.target || '');
      if (!value) {
        allFilled = false;
        allCorrect = false;
        node.dataset.wlSpellState = '';
        node.style.borderBottomColor = '#9ca3af';
        node.style.color = '#111827';
        node.style.background = '#fff';
      } else if (value === target) {
        node.dataset.wlSpellState = 'correct';
        node.style.borderBottomColor = '#22c55e';
        node.style.color = '#166534';
        node.style.background = '#f0fdf4';
      } else {
        allCorrect = false;
        node.dataset.wlSpellState = 'wrong';
        node.style.borderBottomColor = '#ef4444';
        node.style.color = '#991b1b';
        node.style.background = '#fef2f2';
      }
    }
    var next = p.querySelector('[data-role="review-spelling-next"]');
    if (allFilled && allCorrect) {
      p.dataset.reviewAnsweredCorrect = '1';
      if (next) next.style.display = 'inline-flex';
      this.status(win, 'review-status', this.isChineseUI() ? '拼写正确。点击下一题继续。' : 'Spelling correct. Click Next to continue.', 'ok');
      return true;
    }
    p.dataset.reviewAnsweredCorrect = '0';
    if (next) next.style.display = 'none';
    return false;
  },

  renderReview(win) {
    var p = this.panel(win);
    var session = this.reviewSessionByWindow.get(win) || {};
    var tasks = this.getReviewSessionTasks(win);
    var task = tasks.length ? tasks[0] : null;
    if (!task) {
      this.finishReview(win);
      return;
    }
    var t = task.term;
    var item = this.getReviewItem(win, t);
    p.dataset.reviewAnsweredCorrect = '';
    p.dataset.reviewQuestionType = item ? item.type : 'meaning';
    var total = session.count || (session.selectedTerms ? session.selectedTerms.length : 0);
    var done = this.countCompletedReviewWords(win);
    var promptNode = p.querySelector('[data-review="prompt"]');
    if (promptNode) promptNode.textContent = this.reviewPromptText(win, item);
    var pos = p.querySelector('[data-role="review-pos"]');
    if (pos) pos.textContent = total ? done + ' / ' + total : '0 / 0';
    var progress = p.querySelector('[data-role="review-progress"]');
    if (progress) progress.style.width = total ? Math.round(done / total * 100) + '%' : '0%';
    var isSpelling = item && item.type === 'spelling';
    var textNode = p.querySelector('[data-review="text"]');
    if (textNode) textNode.textContent = isSpelling ? (this.isChineseUI() ? '拼写单词/短语' : 'Spell the word or phrase') : (t?.text || (this.isChineseUI() ? '暂无复习词条' : 'No review item'));
    var pron = p.querySelector('[data-review="pronunciation"]');
    if (pron) pron.textContent = t?.pronunciation || '';
    var exWrap = p.querySelector('[data-role="review-example-wrap"]');
    var ex = p.querySelector('[data-review="example"]');
    var showExample = item && item.type === 'example' && item.example;
    if (exWrap) exWrap.style.display = showExample ? 'block' : 'none';
    if (ex) ex.textContent = showExample ? (item.example || '') : '';
    var spellingWrap = p.querySelector('[data-role="review-spelling-wrap"]');
    var spellingMeaning = p.querySelector('[data-review="spelling-meaning"]');
    if (spellingWrap) spellingWrap.style.display = isSpelling ? 'block' : 'none';
    if (spellingMeaning) spellingMeaning.textContent = isSpelling ? (t?.chineseMeaning || '') : '';
    var choicesBox = p.querySelector('[data-role="review-choices"]');
    if (choicesBox) choicesBox.style.display = isSpelling ? 'none' : 'grid';
    var gradeButtons = p.querySelector('[data-role="review-grade-buttons"]');
    if (gradeButtons) gradeButtons.style.display = isSpelling ? 'none' : 'grid';
    var nextSpelling = p.querySelector('[data-role="review-spelling-next"]');
    if (nextSpelling) nextSpelling.style.display = 'none';
    var ans = p.querySelector('[data-review="answer"]');
    if (ans) {
      ans.style.display = 'none';
      ans.textContent = '';
    }
    if (isSpelling) {
      this.buildSpellingSlots(win, t);
    } else {
      this.renderMeaningChoices(win, t);
    }
  },

  renderMeaningChoices(win, term) {
    var p = this.panel(win);
    var box = p ? p.querySelector('[data-role="review-choices"]') : null;
    if (!box) return;
    while (box.firstChild) box.removeChild(box.firstChild);
    if (!term) return;
    // Render immediately using cached/local choices, then asynchronously replace
    // with LLM-generated close distractors once available.
    this.ensureLLMReviewDistractors(win, term);
    var session = this.reviewSessionByWindow.get(win) || { choicesById: {} };
    if (!session.choicesById) session.choicesById = {};
    var task = this.getCurrentReviewTask(win);
    var item = this.getReviewItem(win, term) || { type: 'meaning' };
    var choiceKey = task && task.key ? task.key : term.id + ':' + item.type;
    var choices = session.choicesById[choiceKey];
    if (!choices) {
      choices = this.buildMeaningChoices(win, term);
      session.choicesById[choiceKey] = choices;
      this.reviewSessionByWindow.set(win, session);
    }
    for (var i = 0; i < choices.length; i++) {
      var c = choices[i];
      var btn = this.html(win.document, 'button', {
        type: 'button',
        dataset: { reviewChoice: c.correct ? '1' : '0' },
        styleObj: {
          width: '100%',
          minHeight: '42px',
          border: '1px solid #e5e7eb',
          borderRadius: '10px',
          background: '#fff',
          color: '#111827',
          padding: '8px 12px',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '13px',
          lineHeight: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxSizing: 'border-box'
        }
      });
      btn.appendChild(this.html(win.document, 'span', {
        styleObj: {
          width: '16px',
          height: '16px',
          minWidth: '16px',
          borderRadius: '999px',
          border: '1px solid #d1d5db',
          boxSizing: 'border-box'
        }
      }));
      btn.appendChild(this.html(win.document, 'span', { dataset: { role: 'choice-text' }, styleObj: { flex: '1' } }, c.text));
      var sourceBadge = this.html(win.document, 'span', {
        dataset: { role: 'choice-source' },
        title: c.explanation || '',
        styleObj: {
          display: 'none',
          marginLeft: '8px',
          color: '#6b7280',
          fontSize: '12px',
          whiteSpace: 'nowrap'
        }
      }, c.sourceText ? ('→ ' + c.sourceText) : '');
      btn.appendChild(sourceBadge);
      btn.addEventListener('click', (event) => {
        this.answerMeaningChoice(win, event.currentTarget);
      });
      box.appendChild(btn);
    }
  },

  answerMeaningChoice(win, btn) {
    var p = this.panel(win);
    if (!p || !btn) return;
    var correct = btn.dataset.reviewChoice === '1';
    p.dataset.reviewAnsweredCorrect = correct ? '1' : '0';
    var buttons = p.querySelectorAll('[data-review-choice]');
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      var isCorrect = b.dataset.reviewChoice === '1';
      b.disabled = true;
      b.style.cursor = 'default';
      if (isCorrect) {
        b.dataset.wlReviewState = 'correct';
        b.style.borderColor = '#22c55e';
        b.style.background = '#f0fdf4';
        b.style.color = '#166534';
      } else {
        b.dataset.wlReviewState = 'selected';
      }
    }
    if (!correct) {
      btn.dataset.wlReviewState = 'wrong';
      btn.style.borderColor = '#ef4444';
      btn.style.background = '#fef2f2';
      btn.style.color = '#991b1b';
      var src = btn.querySelector('[data-role="choice-source"]');
      if (src && src.textContent) src.style.display = 'inline-flex';
      this.status(win, 'review-status', this.isChineseUI() ? '回答错误。已显示正确答案，请点击“不认识”继续加强。' : 'Incorrect. Correct answer shown; click Unknown to reinforce.', 'err');
      this.showReviewAnswer(win, true);
    } else {
      this.status(win, 'review-status', this.isChineseUI() ? '回答正确。' : 'Correct.', 'ok');
    }
  },

  showReviewAnswer(win, forceShow) {
    var p = this.panel(win);
    if (!p) return;
    var ans = p.querySelector('[data-review="answer"]');
    if (!ans) return;
    var show = forceShow === true ? true : ans.style.display === 'none' || !ans.style.display;
    if (!show) {
      ans.style.display = 'none';
      return;
    }

    var task = this.getCurrentReviewTask(win);
    var term = task && task.term ? task.term : null;
    var type = task && task.type ? task.type : (p.dataset.reviewQuestionType || 'meaning');

    if (type === 'spelling') {
      ans.textContent = term ?
        ((this.isChineseUI() ? '正确拼写：' : 'Correct spelling: ') + (term.text || '')) :
        (this.isChineseUI() ? '暂无答案。' : 'No answer.');
    } else {
      var correctBtn = p.querySelector('[data-review-choice="1"]');
      var correctTextNode = correctBtn ? correctBtn.querySelector('[data-role="choice-text"]') : null;
      var correctText = correctTextNode ? correctTextNode.textContent : (term ? (term.chineseMeaning || '') : '');
      ans.textContent = (this.isChineseUI() ? '正确选项：' : 'Correct option: ') + (correctText || '');
      if (correctBtn) {
        correctBtn.dataset.wlReviewState = 'correct';
        correctBtn.style.borderColor = '#22c55e';
        correctBtn.style.background = '#f0fdf4';
        correctBtn.style.color = '#166534';
      }
    }

    ans.style.display = 'block';
  },

  finishReview(win) {
    var p = this.panel(win);
    if (!p) return;
    var pos = p.querySelector('[data-role="review-pos"]');
    if (pos) pos.textContent = this.isChineseUI() ? '完成' : 'Done';
    var progress = p.querySelector('[data-role="review-progress"]');
    if (progress) progress.style.width = '100%';
    var textNode = p.querySelector('[data-review="text"]');
    if (textNode) textNode.textContent = this.isChineseUI() ? '本次复习完成' : 'Review complete';
    var pron = p.querySelector('[data-review="pronunciation"]');
    if (pron) pron.textContent = '';
    var exWrap = p.querySelector('[data-role="review-example-wrap"]');
    if (exWrap) exWrap.style.display = 'none';
    var ex = p.querySelector('[data-review="example"]');
    if (ex) ex.textContent = '';
    var spellingWrap = p.querySelector('[data-role="review-spelling-wrap"]');
    if (spellingWrap) spellingWrap.style.display = 'none';
    var gradeButtons = p.querySelector('[data-role="review-grade-buttons"]');
    if (gradeButtons) gradeButtons.style.display = 'grid';
    var choices = p.querySelector('[data-role="review-choices"]');
    if (choices) {
      choices.style.display = 'grid';
      while (choices.firstChild) choices.removeChild(choices.firstChild);
    }
    var ans = p.querySelector('[data-review="answer"]');
    if (ans) {
      ans.style.display = 'block';
      ans.textContent = this.isChineseUI() ? '很好，本次复习已经完成。可以重新选择词数并开始下一轮。' : 'Great, this review session is complete. Choose a word count and start another round.';
    }
    this.status(win, 'review-status', this.isChineseUI() ? '复习完成。' : 'Review complete.', 'ok');
  },


  async updateReviewStats(win, task, correct) {
    if (!task || !task.term || !task.term.id) return;
    try {
      var doc = await this.readDocument();
      var term = (doc.terms || []).find(function (t) { return t.id === task.term.id; });
      if (!term) return;
      var now = new Date().toISOString();
      term.stats = term.stats || {};
      term.stats.totalReviews = Number(term.stats.totalReviews || 0) + 1;
      term.stats.byType = term.stats.byType || {};
      var type = task.type || 'meaning';
      term.stats.byType[type] = term.stats.byType[type] || { correct: 0, wrong: 0 };
      if (correct) {
        term.stats.correct = Number(term.stats.correct || 0) + 1;
        term.stats.byType[type].correct = Number(term.stats.byType[type].correct || 0) + 1;
        term.lastCorrectAt = now;
        // Successful completion gradually reduces the long-term wrong weight,
        // but does not erase it immediately.
        term.wrongCount = Math.max(0, Number(term.wrongCount || 0) - 1);
      } else {
        term.stats.wrong = Number(term.stats.wrong || 0) + 1;
        term.stats.byType[type].wrong = Number(term.stats.byType[type].wrong || 0) + 1;
        term.wrongCount = Number(term.wrongCount || 0) + 1;
        term.lastWrongAt = now;
      }
      term.updatedAt = now;
      await this.writeDocument(doc);

      var p = this.panel(win);
      if (p && Array.isArray(p._wlTerms)) {
        var local = p._wlTerms.find(function (t) { return t.id === term.id; });
        if (local) {
          local.wrongCount = term.wrongCount;
          local.stats = term.stats;
          local.lastWrongAt = term.lastWrongAt;
          local.lastCorrectAt = term.lastCorrectAt;
          local.updatedAt = term.updatedAt;
        }
      }
      if (task.term) {
        task.term.wrongCount = term.wrongCount;
        task.term.stats = term.stats;
        task.term.lastWrongAt = term.lastWrongAt;
        task.term.lastCorrectAt = term.lastCorrectAt;
      }
    } catch (e) {
      this.debug('updateReviewStats failed: ' + e);
    }
  },

  reinsertReviewTask(win, task) {
    var session = this.reviewSessionByWindow.get(win) || {};
    var tasks = Array.isArray(session.tasks) ? session.tasks : [];
    if (!tasks.length || !task) return;
    tasks.shift();
    if (!tasks.length) {
      tasks.push(task);
    } else {
      var insertAt = Math.floor(Math.random() * tasks.length) + 1;
      tasks.splice(insertAt, 0, task);
    }
    if (session.choicesById && task.key) delete session.choicesById[task.key];
    session.tasks = tasks;
    this.reviewSessionByWindow.set(win, session);
  },

  completeReviewTask(win, task) {
    var session = this.reviewSessionByWindow.get(win) || {};
    var tasks = Array.isArray(session.tasks) ? session.tasks : [];
    if (tasks.length) tasks.shift();
    session.tasks = tasks;
    this.reviewSessionByWindow.set(win, session);
    this.markReviewTaskComplete(win, task);
  },

  async markReview(win, grade) {
    var session = this.reviewSessionByWindow.get(win) || {};
    var tasks = Array.isArray(session.tasks) ? session.tasks : [];
    var task = tasks.length ? tasks[0] : null;
    if (!task) {
      this.finishReview(win);
      return;
    }

    var p = this.panel(win);
    var answeredCorrect = p ? p.dataset.reviewAnsweredCorrect : '';
    var shouldRepeat = grade === 'again' || grade === 'hard' || answeredCorrect === '0';

    if (shouldRepeat) {
      // Do not advance word progress. The exact failed task type goes back into
      // the remaining mixed task pool and will appear again later.
      await this.updateReviewStats(win, task, false);
      this.reinsertReviewTask(win, task);
      this.renderReview(win);
      return;
    }

    await this.updateReviewStats(win, task, true);
    this.completeReviewTask(win, task);
    var updated = this.reviewSessionByWindow.get(win) || {};
    if (!updated.tasks || !updated.tasks.length) {
      this.finishReview(win);
      return;
    }
    this.renderReview(win);
  },

  extractSelectionText(event) { var params = event?.params || {}; var text = params.annotation?.text || params.annotation?.comment || params.text || params.selectedText || params.selectionText || ''; text = String(text || '').trim(); if (!text) { try { text = String(event?.doc?.getSelection?.().toString() || '').trim(); } catch (e) {} } return text; },
  buildSelectionPayload(event) { var params = event?.params || {}; var text = this.extractSelectionText(event); return { text: text, source: { selectedText: text, createdAt: new Date().toISOString() }, createdAt: new Date().toISOString() }; },
  loadLastSelectionIntoDraft(win) { if (!this.lastSelectionPayload?.text) { this.status(win, 'wordbook-status', 'No captured reader selection yet.', 'err'); return; } this.setDraft(win, { text: this.lastSelectionPayload.text, example: this.lastSelectionPayload.text }); this.status(win, 'wordbook-status', 'Selection loaded. Review, LLM Complete, then Save.', 'ok'); },
  openPanelWithSelection(win, payload) {
    this.lastSelectionPayload = payload;
    this.showPanel(win);
    var p = win ? this.panel(win) : null;
    if (p) {
      this.switchTab(p, 'addword');
      this.setAddDraft(win, { text: payload.text, example: payload.text });
      this.status(win, 'addword-status', 'Draft opened from PDF selection.', 'ok');
    }
  },

  registerReaderSelectionPopup() {
    if (this.readerSelectionHandler || !Zotero?.Reader?.registerEventListener) return;
    this.readerSelectionHandler = (event) => this.renderReaderSelectionPopup(event);
    try {
      Zotero.Reader.registerEventListener('renderTextSelectionPopup', this.readerSelectionHandler, this.id);
    } catch (e) {
      this.debug('registerReaderSelectionPopup failed: ' + e);
    }
  },

  unregisterReaderSelectionPopup() {
    if (!this.readerSelectionHandler || !Zotero?.Reader?.unregisterEventListener) return;
    try {
      Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this.readerSelectionHandler, this.id);
    } catch (e1) {
      try { Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this.readerSelectionHandler); } catch (e2) {}
    }
    this.readerSelectionHandler = null;
  },

  renderReaderSelectionPopup(event) {
    try {
      var doc = event?.doc;
      var append = event?.append;
      if (!doc || typeof append !== 'function') return;

      var text = this.extractSelectionText(event);
      if (!text) return;

      // Avoid duplicate controls and avoid modifying controls created by Zotero
      // or other plugins.  We only append one isolated Word Learning box.
      if (doc.querySelector('[data-role="wl-reader-selection-box"]')) return;

      var box = doc.createElement('div');
      box.setAttribute('data-role', 'wl-reader-selection-box');
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.gap = '6px';
      box.style.marginTop = '8px';
      box.style.paddingTop = '8px';
      box.style.borderTop = '1px solid rgba(127, 127, 127, 0.18)';

      var btn = doc.createElement('button');
      btn.setAttribute('data-role', 'wl-add-to-wordbook-button');
      btn.type = 'button';
      btn.textContent = this.isChineseUI() ? '加入词库' : 'Add to Wordbook';
      btn.style.width = '100%';
      btn.style.minHeight = '30px';
      btn.style.padding = '6px 12px';
      btn.style.borderRadius = '8px';
      btn.style.border = '1px solid rgba(45, 140, 255, 0.45)';
      btn.style.background = 'linear-gradient(180deg, #3b91ff 0%, #2d7ff9 100%)';
      btn.style.color = '#ffffff';
      btn.style.fontWeight = '700';
      btn.style.fontSize = '12px';
      btn.style.letterSpacing = '0.01em';
      btn.style.cursor = 'pointer';
      btn.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.12)';
      btn.style.webkitAppearance = 'none';
      btn.style.appearance = 'none';

      var status = doc.createElement('div');
      status.setAttribute('data-role', 'wl-reader-selection-status');
      status.style.fontSize = '11px';
      status.style.lineHeight = '1.35';
      status.style.minHeight = '14px';
      status.style.color = '#6b7280';
      status.style.textAlign = 'center';

      var plugin = this;
      btn.addEventListener('mouseenter', function () {
        btn.style.background = 'linear-gradient(180deg, #4b9aff 0%, #2d7ff9 100%)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.background = 'linear-gradient(180deg, #3b91ff 0%, #2d7ff9 100%)';
      });
      btn.addEventListener('click', function (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
        try {
          var payload = plugin.buildSelectionPayload(event);
          plugin.openPanelWithSelection(plugin.getMainWindow(), payload);
          status.textContent = plugin.isChineseUI() ? '已打开添加面板' : 'Draft opened';
          status.style.color = '#166534';
        } catch (e) {
          status.textContent = plugin.isChineseUI() ? '添加失败' : 'Failed to open draft';
          status.style.color = '#991b1b';
          plugin.debug('reader selection button failed: ' + e);
        }
      });

      box.appendChild(btn);
      box.appendChild(status);
      append(box);
    } catch (e) {
      this.debug('renderReaderSelectionPopup failed: ' + e);
    }
  },

  exposeHost(win) { if (!win) return; var plugin = this; win.WordLearningPluginHost = { open: function () { plugin.showPanel(win); }, getLastSelection: function () { return plugin.lastSelectionPayload; }, getCurrentContext: function () { return {}; } }; }
};

function startup(data, reason) { WordLearningPlugin.startup(data, reason); }
function shutdown(data, reason) { WordLearningPlugin.shutdown(data, reason); }
function install(data, reason) { WordLearningPlugin.install(data, reason); }
function uninstall(data, reason) { WordLearningPlugin.uninstall(data, reason); }
function onMainWindowLoad(data) { WordLearningPlugin.onMainWindowLoad(data); }
function onMainWindowUnload(data) { WordLearningPlugin.onMainWindowUnload(data); }
