/* global Zotero, Services, PathUtils, IOUtils, Ci */

var WordLearning = {
  id: 'word-learning@zotero.local',
  version: '0.10.0',
  prefsPrefix: 'extensions.word-learning.',
  nativePaneID: 'word-learning-item-pane',
  registered: false,
  nativePanelRegistered: false,
  windowStates: new WeakMap(),
  activePanelByWindow: new WeakMap(),
  panelLifecycleByBody: new WeakMap(),
  renderGenerationByWindow: new WeakMap(),
  panelLastInteractionByWindow: new WeakMap(),
  selectedIdByWindow: new WeakMap(),
  wordbookModeByWindow: new WeakMap(),
  allWordsSortByWindow: new WeakMap(),
  reviewSessionByWindow: new WeakMap(),
  reviewLastTypeByWindow: new WeakMap(),
  addDraftByWindow: new WeakMap(),
  themeModeByWindow: new WeakMap(),
  themeMediaListeners: new WeakMap(),
  themeStyleByWindow: new WeakMap(),
  themeIconCacheByWindow: new WeakMap(),
  readerSelectionHandler: null,
  lastSelectionPayload: null,
  emptyDatabase: { version: 1, terms: [], stats: { createdAt: null, updatedAt: null } },
  defaultSettings: {
    language: 'zh-CN', provider: 'DeepSeek', apiUrl: 'https://api.deepseek.com', modelName: 'deepseek-v4-flash',
    thinking: 'default', speechStyle: '', apiKey: '', databasePath: '', themeMode: 'light'
  },
  ids: { panel: 'wl-panel-v026' },

  log(msg) { try { Zotero.debug('[WordLearning] ' + msg); } catch (e) {} },
  debug(msg) { this.log(msg); },

  startup(data, reason) {
    this.version = data && data.version ? data.version : this.version;
    this.ensurePrefs();
    this.registerNativeItemPaneSection();
    this.registerReaderSelectionPopup();
    this.registered = true;
    this.debug('startup ' + this.version);
  },

  onMainWindowLoad(win) {
    try {
      this.registerNativeItemPaneSection();
      this.debug('main window load');
    } catch (e) { this.debug('main window load failed: ' + e); }
  },

  onMainWindowUnload(win) { this.removeFromWindow(win); },

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

  install(data, reason) {},
  uninstall(data, reason) {},

  ensurePrefs() {
    var defaults = this.defaultSettings;
    for (var k in defaults) {
      try {
        if (Services.prefs.getPrefType(this.prefsPrefix + k) === Services.prefs.PREF_INVALID) {
          Services.prefs.setStringPref(this.prefsPrefix + k, defaults[k]);
        }
      } catch (e) {}
    }
  },

  prefGet(key, fallback) {
    try {
      var full = this.prefsPrefix + key;
      if (Services.prefs.getPrefType(full) === Services.prefs.PREF_INVALID) return fallback;
      return Services.prefs.getStringPref(full, fallback);
    } catch (e) { return fallback; }
  },

  prefSet(key, value) {
    try { Services.prefs.setStringPref(this.prefsPrefix + key, value == null ? '' : String(value)); } catch (e) {}
  },

  settings() {
    return {
      language: this.prefGet('language', this.defaultSettings.language),
      provider: this.prefGet('provider', this.defaultSettings.provider),
      apiUrl: this.prefGet('apiUrl', this.defaultSettings.apiUrl),
      modelName: this.prefGet('modelName', this.defaultSettings.modelName),
      thinking: this.prefGet('thinking', this.defaultSettings.thinking),
      speechStyle: this.prefGet('speechStyle', this.defaultSettings.speechStyle),
      apiKey: this.prefGet('apiKey', this.defaultSettings.apiKey),
      databasePath: this.prefGet('databasePath', this.defaultSettings.databasePath),
      themeMode: this.prefGet('themeMode', this.defaultSettings.themeMode)
    };
  },

  normalizeAPIBase(url) {
    url = String(url || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (/\/chat\/completions$/.test(url)) return url;
    if (/\/v1$/.test(url)) return url + '/chat/completions';
    if (/\/anthropic$/.test(url)) return url + '/v1/messages';
    return url + '/v1/chat/completions';
  },

  dataDir() {
    var profile = Zotero && Zotero.Profile ? Zotero.Profile.dir : null;
    if (profile && profile.path) return PathUtils.join(profile.path, 'word-learning');
    return PathUtils.join(PathUtils.profileDir, 'word-learning');
  },

  async defaultDatabasePath() {
    var dir = this.dataDir();
    await IOUtils.makeDirectory(dir, { ignoreExisting: true });
    return PathUtils.join(dir, 'vocabulary.json');
  },

  async databasePath() {
    var custom = String(this.settings().databasePath || '').trim();
    if (custom) return custom;
    return await this.defaultDatabasePath();
  },

  async ensureDatabase() {
    var path = await this.databasePath();
    var defaultPath = await this.defaultDatabasePath();
    try {
      var parent = PathUtils.parent(path);
      if (parent) await IOUtils.makeDirectory(parent, { ignoreExisting: true });
    } catch (e) {}
    if (!(await IOUtils.exists(path))) {
      if (path !== defaultPath && await IOUtils.exists(defaultPath)) {
        await IOUtils.copy(defaultPath, path);
      } else {
        var doc = Object.assign({}, this.emptyDatabase, { stats: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
        await IOUtils.writeUTF8(path, JSON.stringify(doc, null, 2));
      }
    }
    return path;
  },

  async readDocument() {
    var path = await this.ensureDatabase();
    try {
      var text = await IOUtils.readUTF8(path);
      var doc = JSON.parse(text || '{}');
      if (!Array.isArray(doc.terms)) doc.terms = [];
      if (!doc.stats) doc.stats = {};
      return doc;
    } catch (e) {
      this.debug('read database failed, recreating: ' + e);
      var doc = JSON.parse(JSON.stringify(this.emptyDatabase));
      doc.stats.createdAt = doc.stats.updatedAt = new Date().toISOString();
      await IOUtils.writeUTF8(path, JSON.stringify(doc, null, 2));
      return doc;
    }
  },

  async writeDocument(doc) {
    var path = await this.ensureDatabase();
    doc.stats = doc.stats || {};
    doc.stats.updatedAt = new Date().toISOString();
    await IOUtils.writeUTF8(path, JSON.stringify(doc, null, 2));
  },

  makeId() { return 'wl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); },

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
    if (this.nativePanelRegistered) return;
    var plugin = this;
    try {
      if (!Zotero.ItemPaneManager || typeof Zotero.ItemPaneManager.registerSection !== 'function') throw new Error('ItemPaneManager.registerSection unavailable');
      var options = {
        paneID: this.nativePaneID,
        pluginID: this.id,
        header: { l10nID: 'word-learning-panel-head', icon: 'chrome://word-learning/content/icons/wl.svg' },
        sidenav: { l10nID: 'word-learning-panel-head', icon: 'chrome://word-learning/content/icons/wl.svg' },
        bodyXHTML: false,
        onRender: function (ctx) {
          var body = ctx && ctx.body;
          if (!body) return;
          var win = body.ownerDocument.defaultView;
          while (body.firstChild) body.removeChild(body.firstChild);
          var panel = plugin.html(body.ownerDocument, 'div', { id: plugin.ids.panel, styleObj: plugin.panelStyle(true) });
          panel.dataset.embedded = '1';
          panel.dataset.native = '1';
          var generation = plugin.beginRender(win, body, 'native-onRender');
          body.appendChild(panel);
          plugin.setActivePanel(win, body, panel);
          plugin.installThemeStyles(win, panel);
          plugin.buildPanel(win, panel);
          plugin.setupPanelHandlers(win, body, panel);
          panel.__wlRenderGeneration = generation;
          plugin.renderThemeToggle(win);
          plugin.decorateNativeSectionHeader(body);
          plugin.normalizeNativeItemPaneLayout(win, panel);
          plugin.loadSettings(win);
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
      };
      var section = Zotero.ItemPaneManager.registerSection(options);
      this.nativePanelRegistered = true;
      this.debug('native ItemPane section registered' + (section ? '' : ''));
    } catch (e) {
      this.debug('native ItemPane registration unavailable, fallback will be used: ' + e);
      try { var win = this.getMainWindow(); if (win) this.ensurePanel(win); } catch (e2) {}
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
    try { return Zotero.getMainWindow ? Zotero.getMainWindow() : Services.wm.getMostRecentWindow('navigator:browser'); } catch (e) { return null; }
  },

  ensurePanel(win) {
    if (!win || !win.document) return null;
    var doc = win.document;
    var existing = doc.getElementById(this.ids.panel);
    if (existing) return existing;

    var embedded = !!this.findNativeItemPaneHost(doc);
    var panel = null;
    var host = null;
    if (embedded) {
      host = this.findNativeItemPaneHost(doc);
    }

    panel = this.html(doc, 'div', { id: this.ids.panel, styleObj: this.panelStyle(embedded) });
    panel.dataset.embedded = embedded ? '1' : '0';
    var generation = this.beginRender(win, panel, 'fallback-ensurePanel');
    this.buildPanel(win, panel);
    panel.__wlRenderGeneration = generation;

    if (embedded) {
      host.appendChild(panel);
    } else {
      panel.style.position = 'fixed';
      panel.style.right = '28px';
      panel.style.top = '70px';
      panel.style.width = '520px';
      panel.style.maxHeight = 'calc(100vh - 90px)';
      panel.style.zIndex = 999999;
      panel.style.boxShadow = '0 18px 50px rgba(15,23,42,.22)';
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

  findNativeItemPaneHost(doc) {
    var candidates = [
      '#zotero-item-pane-content', '#item-pane-content', '[id*="item-pane"] [class*="content"]',
      '[class*="item-pane"] [class*="content"]', '#zotero-item-pane'
    ];
    for (var i = 0; i < candidates.length; i++) {
      var el = doc.querySelector(candidates[i]);
      if (el && el.clientWidth > 200) return el;
    }
    return null;
  },

  removeFromWindow(win) {
    try { var p = win.document.getElementById(this.ids.panel); if (p) p.remove(); } catch (e) {}
  },
  removeFromAllWindows() {
    var e = Services.wm.getEnumerator(null);
    while (e.hasMoreElements()) { try { this.removeFromWindow(e.getNext()); } catch (err) {} }
  },

  panelStyle(embedded) {
    return {
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#111827',
      background: '#f8fafc',
      border: embedded ? 'none' : '1px solid #d9dee7',
      borderRadius: embedded ? '0' : '16px',
      overflow: 'hidden',
      minWidth: embedded ? '0' : '360px',
      height: embedded ? '100%' : 'auto',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    };
  },

  html(doc, tag, opts, children) {
    opts = opts || {};
    var el = doc.createElement(tag);
    if (opts.id) el.id = opts.id;
    if (opts.className) el.className = opts.className;
    if (opts.text != null) el.textContent = opts.text;
    if (opts.html != null) el.innerHTML = opts.html;
    if (opts.title) el.title = opts.title;
    if (opts.value != null) el.value = opts.value;
    if (opts.type) el.type = opts.type;
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.dataset) Object.keys(opts.dataset).forEach(k => { el.dataset[k] = opts.dataset[k]; });
    if (opts.attrs) Object.keys(opts.attrs).forEach(k => { el.setAttribute(k, opts.attrs[k]); });
    if (opts.styleObj) Object.assign(el.style, opts.styleObj);
    if (opts.on) Object.keys(opts.on).forEach(k => el.addEventListener(k, opts.on[k]));
    if (children) children.forEach(c => { if (c != null) el.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return el;
  },

  iconButton(doc, label) { return this.html(doc, 'button', { text: label, styleObj: this.buttonStyle(false, true) }); },
  buttonStyle(active, small) {
    return {
      border: '1px solid ' + (active ? '#2f7df6' : '#d0d6df'), background: active ? '#2f7df6' : '#fff', color: active ? '#fff' : '#111827',
      borderRadius: '999px', padding: small ? '5px 10px' : '8px 18px', fontWeight: 700, fontSize: small ? '12px' : '15px', cursor: 'pointer', minHeight: small ? '28px' : '36px'
    };
  },
  activateTabStyle(btn, active) { Object.assign(btn.style, this.buttonStyle(active, false)); },
  activatePresetStyle(btn, active) { Object.assign(btn.style, this.buttonStyle(active, true)); btn.style.borderRadius = '8px'; },

  buildPanel(win, panel) {
    var doc = win.document;
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    panel._wlTerms = panel._wlTerms || [];
    var embedded = panel.dataset.embedded === '1';
    var nativeItemPane = panel.dataset.native === '1';
    var root = this.html(doc, 'div', { dataset: { role: 'wl-root' }, styleObj: { display: 'flex', flexDirection: 'column', height: embedded ? '100%' : 'auto', minHeight: '0' } });
    panel.appendChild(root);
    // Event handlers are installed by setupPanelHandlers() immediately after buildPanel().

    var header = this.html(doc, 'div', { dataset: { role: 'wl-section-header' }, styleObj: { display: 'flex', alignItems: 'center', gap: '8px', padding: embedded ? '6px 10px' : '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff' } });
    header.appendChild(this.html(doc, 'span', { text: '▾', styleObj: { color: '#6b7280' } }));
    header.appendChild(this.badge(doc));
    header.appendChild(this.html(doc, 'strong', { text: 'Word Learning', styleObj: { fontSize: embedded ? '12px' : '18px' } }));
    header.appendChild(this.html(doc, 'span', { text: (this.version || '0.10.0') + ' loaded', styleObj: { marginLeft: 'auto', color: '#6b7280' } }));
    var close = this.html(doc, 'button', { text: embedded ? '−' : '×', styleObj: this.buttonStyle(false, true), on: { click: () => this.setPanelCollapsed(panel, panel.dataset.collapsed !== '1') } });
    close.dataset.role = 'wl-collapse-toggle';
    header.appendChild(close);
    root.appendChild(header);

    var navRow = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', padding: embedded ? '8px 10px 6px' : '12px 16px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', alignItems: 'center' } });
    var tabs = [ ['addword', '添加单词'], ['wordbook', '单词卡片'], ['allwords', '全部词汇'], ['review', '复习'], ['settings', '设置'] ];
    tabs.forEach(([id, name]) => {
      var b = this.html(doc, 'button', { text: name, dataset: { tab: id }, styleObj: this.buttonStyle(id === 'addword', false) });
      b.addEventListener('click', () => this.switchTab(panel, id));
      navRow.appendChild(b);
    });
    var themeBtn = this.html(doc, 'button', { dataset: { role: 'theme-toggle' }, attrs: { 'aria-label': 'Toggle Word Learning theme' }, styleObj: Object.assign(this.buttonStyle(false, true), { marginLeft: 'auto', width: '28px', height: '28px', padding: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '999px', flex: '0 0 auto', background: 'var(--wl-surface)', overflow: 'hidden' }) });
    themeBtn.addEventListener('click', () => { var current = this.getThemeMode(win); var next = current === 'dark' ? 'light' : 'dark'; this.setThemeMode(win, next); this.fillThemeToggleButton(doc, themeBtn, next); });
    navRow.appendChild(themeBtn);
    root.appendChild(navRow);

    var body = this.html(doc, 'div', {
      dataset: { role: 'wl-body' },
      styleObj: {
        flex: nativeItemPane ? '0 0 auto' : (embedded ? '0 1 auto' : '1'),
        overflow: nativeItemPane ? 'visible' : 'auto',
        padding: embedded ? '10px' : '12px',
        maxHeight: nativeItemPane ? '' : (embedded ? '560px' : ''),
        minHeight: '0'
      }
    });
    root.appendChild(body);

    body.appendChild(this.addWordView(win));
    body.appendChild(this.wordbookView(win));
    body.appendChild(this.allWordsView(win));
    body.appendChild(this.reviewView(win));
    body.appendChild(this.settingsView(win));
    this.switchTab(panel, 'addword');
    this.renderThemeToggle(win);
  },

  badge(doc) { return this.html(doc, 'span', { text: 'WL', styleObj: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#2f7df6', color: '#fff', width: '18px', height: '18px', borderRadius: '5px', fontWeight: 800, fontSize: '9px' } }); },

  setPanelCollapsed(panel, collapsed) {
    panel.dataset.collapsed = collapsed ? '1' : '0';
    var body = panel.querySelector('[data-role="wl-body"]');
    var nav = panel.querySelector('[data-role="wl-section-header"]').nextElementSibling;
    if (body) body.style.display = collapsed ? 'none' : '';
    if (nav) nav.style.display = collapsed ? 'none' : 'flex';
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

  label(doc, text) { return this.html(doc, 'div', { text, styleObj: { fontWeight: 700, fontSize: '13px', color: '#374151', paddingTop: '8px' } }); },
  input(doc, role, placeholder) { return this.html(doc, 'input', { dataset: { role }, placeholder, styleObj: { width: '100%', padding: '9px 10px', border: '1px solid #d9dee7', borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box' } }); },
  textarea(doc, role, placeholder, rows) { return this.html(doc, 'textarea', { dataset: { role }, placeholder, styleObj: { width: '100%', minHeight: (rows * 38) + 'px', padding: '9px 10px', border: '1px solid #d9dee7', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' } }); },

  addWordView(win) {
    var doc = win.document;
    var wrap = this.html(doc, 'div', { dataset: { view: 'addword' }, styleObj: { display: 'block' } });
    var card = this.html(doc, 'div', { styleObj: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px', boxShadow: '0 2px 8px rgba(15,23,42,.04)' } });
    card.appendChild(this.html(doc, 'h3', { text: '添加单词', styleObj: { textAlign: 'center', margin: '0 0 12px' } }));
    var row = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' } });
    var newBtn = this.html(doc, 'button', { text: '新词', styleObj: this.buttonStyle(false, true), on: { click: () => this.clearAddDraft(win) } });
    var llmBtn = this.html(doc, 'button', { text: 'LLM 补全', styleObj: this.buttonStyle(false, true), on: { click: () => this.llmCompleteAdd(win, llmBtn) } });
    var saveBtn = this.html(doc, 'button', { text: '保存', styleObj: this.buttonStyle(true, true), on: { click: () => this.saveAddTerm(win) } });
    row.append(newBtn, llmBtn, saveBtn); card.appendChild(row);
    var grid = this.html(doc, 'div', { styleObj: { display: 'grid', gridTemplateColumns: '92px 1fr', gap: '10px', alignItems: 'start' } });
    grid.append(this.label(doc, '单词/短语'), this.input(doc, 'add-text', 'word or phrase'));
    grid.append(this.label(doc, '例句'), this.textarea(doc, 'add-example', 'sentence from current paper', 2));
    var pronWrap = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '6px' } });
    pronWrap.append(this.input(doc, 'add-pronunciation', '/.../'));
    var speak = this.html(doc, 'button', { text: '发音', styleObj: this.buttonStyle(false, true), on: { click: () => this.speakAddDraft(win) } }); pronWrap.append(speak);
    grid.append(this.label(doc, '音标'), pronWrap);
    grid.append(this.label(doc, '释义'), this.textarea(doc, 'add-meaning', '中文释义', 2));
    grid.append(this.label(doc, '上下文解释'), this.textarea(doc, 'add-context', '结合论文语境的解释', 3));
    grid.append(this.label(doc, '相关短语'), this.textarea(doc, 'add-related', 'related phrases, one per line', 2));
    card.appendChild(grid);
    card.appendChild(this.statusBox(doc, 'add-status'));
    wrap.appendChild(card);
    return wrap;
  },

  wordbookView(win) {
    var doc = win.document;
    var wrap = this.html(doc, 'div', { dataset: { view: 'wordbook' }, styleObj: { display: 'none', position: 'relative' } });
    var modeRow = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', justifyContent: 'center', margin: '0 0 10px' } });
    var cardBtn = this.html(doc, 'button', { text: '单词卡片', dataset: { wlSubtab: 'card' }, styleObj: this.buttonStyle(true, true), on: { click: () => this.switchWordbookMode(win, 'card') } });
    var editBtn = this.html(doc, 'button', { text: '修改单词', dataset: { wlSubtab: 'edit' }, styleObj: this.buttonStyle(false, true), on: { click: () => this.switchWordbookMode(win, 'edit') } });
    modeRow.append(cardBtn, editBtn); wrap.appendChild(modeRow);
    var cardPage = this.html(doc, 'div', { dataset: { wlPage: 'card' } });
    var content = this.html(doc, 'div', { dataset: { role: 'card-content' }, styleObj: { width: 'min(400px, calc(100% - 72px))', minHeight: '360px', margin: '0 auto', background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', boxShadow: '0 8px 20px rgba(15,23,42,.08)', padding: '22px', boxSizing: 'border-box' } });
    cardPage.appendChild(content);
    var left = this.html(doc, 'button', { text: '‹', styleObj: Object.assign(this.buttonStyle(false, true), { position: 'absolute', left: '2px', top: '45%', borderRadius: '999px', width: '32px', height: '32px', padding: 0 }), on: { click: () => this.moveSelection(win, -1) } });
    var right = this.html(doc, 'button', { text: '›', styleObj: Object.assign(this.buttonStyle(false, true), { position: 'absolute', right: '2px', top: '45%', borderRadius: '999px', width: '32px', height: '32px', padding: 0 }), on: { click: () => this.moveSelection(win, 1) } });
    cardPage.append(left, right); wrap.appendChild(cardPage);

    var editPage = this.html(doc, 'div', { dataset: { wlPage: 'edit' }, styleObj: { display: 'none' } });
    var editCard = this.html(doc, 'div', { styleObj: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' } });
    var editRow = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '10px' } });
    var newBtn = this.html(doc, 'button', { text: '新词', styleObj: this.buttonStyle(false, true), on: { click: () => { this.clearDraft(win); this.switchWordbookMode(win, 'edit'); } } });
    var llmBtn = this.html(doc, 'button', { text: 'LLM 补全', styleObj: this.buttonStyle(false, true), on: { click: () => this.llmComplete(win, llmBtn) } });
    var saveBtn = this.html(doc, 'button', { text: '保存', styleObj: this.buttonStyle(true, true), on: { click: () => this.saveTerm(win) } });
    var delBtn = this.html(doc, 'button', { text: '删除', styleObj: Object.assign(this.buttonStyle(false, true), { borderColor: '#fecaca', color: '#b91c1c' }), on: { click: () => this.deleteTerm(win) } });
    editRow.append(newBtn, llmBtn, saveBtn, delBtn); editCard.appendChild(editRow);
    var grid = this.html(doc, 'div', { styleObj: { display: 'grid', gridTemplateColumns: '92px 1fr', gap: '10px', alignItems: 'start' } });
    grid.append(this.label(doc, '单词/短语'), this.input(doc, 'text', 'word or phrase'));
    grid.append(this.label(doc, '例句'), this.textarea(doc, 'example', 'sentence', 2));
    var pronWrap = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '6px' } }); pronWrap.append(this.input(doc, 'pronunciation', '/.../')); pronWrap.append(this.html(doc, 'button', { text: '发音', styleObj: this.buttonStyle(false, true), on: { click: () => this.speakDraft(win) } }));
    grid.append(this.label(doc, '音标'), pronWrap);
    grid.append(this.label(doc, '释义'), this.textarea(doc, 'meaning', '中文释义', 2));
    grid.append(this.label(doc, '上下文解释'), this.textarea(doc, 'context', '结合论文语境的解释', 3));
    grid.append(this.label(doc, '相关短语'), this.textarea(doc, 'related', 'related phrases, one per line', 2));
    editCard.appendChild(grid); editCard.appendChild(this.statusBox(doc, 'edit-status'));
    editPage.appendChild(editCard); wrap.appendChild(editPage);
    this.wordbookModeByWindow.set(win, 'card');
    return wrap;
  },

  allWordsView(win) {
    var doc = win.document;
    var wrap = this.html(doc, 'div', { dataset: { view: 'allwords' }, styleObj: { display: 'none' } });
    var card = this.html(doc, 'div', { styleObj: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' } });
    var top = this.html(doc, 'div', { styleObj: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } });
    top.appendChild(this.html(doc, 'h3', { text: '全部词汇列表', styleObj: { margin: 0 } }));
    var sort = this.html(doc, 'button', { text: '↕ A-Z', dataset: { role: 'allwords-sort' }, styleObj: this.buttonStyle(false, true), on: { click: () => { var cur = this.allWordsSortByWindow.get(win) || 'az'; this.allWordsSortByWindow.set(win, cur === 'az' ? 'za' : 'az'); this.renderAllWordsList(win); } } });
    top.appendChild(sort); card.appendChild(top);
    card.appendChild(this.input(doc, 'allwords-search', '搜索单词'));
    var list = this.html(doc, 'div', { dataset: { role: 'allwords-list' }, styleObj: { marginTop: '10px', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' } });
    card.appendChild(list); wrap.appendChild(card); return wrap;
  },

  reviewView(win) {
    var doc = win.document;
    var wrap = this.html(doc, 'div', { dataset: { view: 'review' }, styleObj: { display: 'none' } });
    var card = this.html(doc, 'div', { styleObj: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' } });
    var controls = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' } });
    controls.append(this.html(doc, 'strong', { text: '本次词数' }));
    [10,20,30].forEach((n, idx) => { var b = this.html(doc, 'button', { text: String(n), dataset: { reviewCountPreset: String(n) }, styleObj: this.buttonStyle(idx===0, true) }); b.addEventListener('click', () => { card.querySelector('[data-role="review-count"]').value = n; controls.querySelectorAll('[data-review-count-preset]').forEach(x => this.activatePresetStyle(x, x===b)); }); controls.appendChild(b); });
    var count = this.input(doc, 'review-count', '10'); count.type = 'number'; count.value = '10'; count.style.width = '82px'; controls.appendChild(count);
    var start = this.html(doc, 'button', { text: '开始复习', styleObj: this.buttonStyle(true, true), on: { click: () => this.startReview(win) } });
    var show = this.html(doc, 'button', { text: '显示答案', styleObj: this.buttonStyle(false, true), on: { click: () => this.showReviewAnswer(win) } });
    controls.append(start, show, this.html(doc, 'strong', { text: '0 / 0', dataset: { role: 'review-progress' } })); card.appendChild(controls);
    var bar = this.html(doc, 'div', { styleObj: { height: '7px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px' } });
    bar.appendChild(this.html(doc, 'div', { dataset: { role: 'review-bar' }, styleObj: { height: '100%', width: '0%', background: '#2f7df6' } })); card.appendChild(bar);
    var content = this.html(doc, 'div', { dataset: { role: 'review-content' } }); card.appendChild(content); wrap.appendChild(card); return wrap;
  },

  settingsView(win) {
    var doc = win.document;
    var wrap = this.html(doc, 'div', { dataset: { view: 'settings' }, styleObj: { display: 'none' } });
    var card = this.html(doc, 'div', { styleObj: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '14px' } });
    var grid = this.html(doc, 'div', { styleObj: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', alignItems: 'center' } });
    var select = (role, opts) => { var el = this.html(doc, 'select', { dataset: { role }, styleObj: { width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #d9dee7' } }); opts.forEach(o => { var op = doc.createElement('option'); op.value = o[0]; op.textContent = o[1]; el.appendChild(op); }); return el; };
    grid.append(this.label(doc, '语言'), select('language', [['zh-CN','中文（简）'], ['en','English']]));
    grid.append(this.label(doc, '服务商'), select('provider', [['DeepSeek','DeepSeek'], ['OpenAI','OpenAI'], ['Anthropic','Anthropic-compatible']]));
    grid.append(this.label(doc, 'API URL'), this.input(doc, 'apiUrl', 'https://api.deepseek.com'));
    grid.append(this.label(doc, 'Model'), this.input(doc, 'modelName', 'deepseek-v4-flash'));
    grid.append(this.label(doc, '思考强度'), select('thinking', [['default','默认'], ['low','低'], ['medium','中'], ['high','高'] ]));
    var speech = select('speechStyle', [['','系统默认']]); grid.append(this.label(doc, '发音风格'), speech);
    var apiKeyWrap = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '6px' } });
    var apiKey = this.input(doc, 'apiKey', 'sk-...'); apiKey.type = 'password'; apiKeyWrap.appendChild(apiKey); var eye = this.html(doc, 'button', { text: '⊙', styleObj: this.buttonStyle(false, true), on: { click: () => { apiKey.type = apiKey.type === 'password' ? 'text' : 'password'; } } }); apiKeyWrap.appendChild(eye); grid.append(this.label(doc, 'API Key'), apiKeyWrap);
    grid.append(this.label(doc, '数据库保存路径'), this.input(doc, 'databasePath', '/path/to/vocabulary.json'));
    grid.append(this.label(doc, '默认数据库路径'), this.input(doc, 'defaultDatabasePath', ''));
    card.appendChild(grid);
    card.appendChild(this.html(doc, 'p', { text: '可自定义完整 JSON 文件路径；留空则使用默认路径。', styleObj: { color: '#6b7280', fontSize: '12px', margin: '8px 0 0 120px' } }));
    var row = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' } });
    var save = this.html(doc, 'button', { text: '保存设置', styleObj: this.buttonStyle(true, true), on: { click: () => this.saveSettings(win) } });
    var test = this.html(doc, 'button', { text: '测试连接', styleObj: this.buttonStyle(false, true), on: { click: () => this.testConnection(win, test) } });
    var preview = this.html(doc, 'button', { text: '预览发音', styleObj: this.buttonStyle(false, true), on: { click: () => this.previewSpeechStyle(win) } });
    row.append(save, test, preview); card.appendChild(row);
    card.appendChild(this.html(doc, 'p', { text: 'Tip: For DeepSeek, use API URL https://api.deepseek.com. The /anthropic path is only for Anthropic-compatible mode.', styleObj: { color: '#475569', fontSize: '11px', marginTop: '10px' } }));
    card.appendChild(this.statusBox(doc, 'settings-status'));
    wrap.appendChild(card); return wrap;
  },

  statusBox(doc, role) { return this.html(doc, 'div', { dataset: { role }, styleObj: { marginTop: '10px', background: '#f1f5f9', borderRadius: '8px', padding: '8px 10px', color: '#334155', fontSize: '12px', whiteSpace: 'pre-wrap' }, text: '就绪。' }); },
  status(win, role, text, kind) { var el = this.panel(win)?.querySelector('[data-role="' + role + '"]'); if (!el) return; el.textContent = text; el.style.background = kind === 'err' ? '#fee2e2' : kind === 'ok' ? '#dcfce7' : '#f1f5f9'; el.style.color = kind === 'err' ? '#991b1b' : kind === 'ok' ? '#166534' : '#334155'; },

  panel(win) {
    try {
      var active = this.activePanelByWindow.get(win);
      if (active && active.isConnected) return active;
    } catch (e) {}
    try { var p = win.document.getElementById(this.ids.panel); if (p && p.isConnected) { this.activePanelByWindow.set(win, p); return p; } } catch (e) {}
    return this.ensurePanel(win);
  },
  q(win, role) { return this.panel(win).querySelector('[data-role="' + role + '"]'); },
  val(win, role) { var el = this.q(win, role); return el ? String(el.value || '').trim() : ''; },
  setVal(win, role, v) { var el = this.q(win, role); if (el) el.value = v || ''; },

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

  fieldArray(text) { return String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean); },
  firstDefinition(meaning) { return String(meaning || '').split(/[；;\n]/)[0].trim(); },

  setAddDraft(win, t) { this.addDraftByWindow.set(win, Object.assign({}, t)); ['add-text','add-example','add-pronunciation','add-meaning','add-context','add-related'].forEach(role => this.setVal(win, role, '')); this.setVal(win, 'add-text', t.text); this.setVal(win, 'add-example', t.example); this.setVal(win, 'add-pronunciation', t.pronunciation); this.setVal(win, 'add-meaning', t.meaning); this.setVal(win, 'add-context', t.context); this.setVal(win, 'add-related', (t.related || []).join('\n')); },
  addDraft(win) { return { text: this.val(win,'add-text'), example: this.val(win,'add-example'), pronunciation: this.val(win,'add-pronunciation'), meaning: this.val(win,'add-meaning'), context: this.val(win,'add-context'), related: this.fieldArray(this.val(win,'add-related')) }; },
  clearAddDraft(win) { this.setAddDraft(win, {}); this.status(win, 'add-status', '已清空。', ''); },
  setDraft(win, t) { ['text','example','pronunciation','meaning','context','related'].forEach(role => this.setVal(win, role, '')); this.setVal(win, 'text', t.text); this.setVal(win, 'example', t.example); this.setVal(win, 'pronunciation', t.pronunciation); this.setVal(win, 'meaning', t.meaning); this.setVal(win, 'context', t.context); this.setVal(win, 'related', (t.related || []).join('\n')); },
  draft(win) { return { id: this.selectedIdByWindow.get(win), text: this.val(win,'text'), example: this.val(win,'example'), pronunciation: this.val(win,'pronunciation'), meaning: this.val(win,'meaning'), context: this.val(win,'context'), related: this.fieldArray(this.val(win,'related')) }; },
  clearDraft(win) { this.selectedIdByWindow.delete(win); this.setDraft(win, {}); this.status(win, 'edit-status', '新词模式。', ''); },

  termStats(term) {
    if (!term.stats) term.stats = {};
    var defaults = { correct: 0, wrong: 0, weight: 1, lastReviewedAt: null, known: 0, fuzzy: 0, unknown: 0 };
    for (var k in defaults) if (term.stats[k] == null) term.stats[k] = defaults[k];
    return term.stats;
  },

  async saveDraftToDocument(d, selectedId) {
    if (!d.text) throw new Error('请输入单词或短语');
    var doc = await this.readDocument();
    var terms = doc.terms || [];
    var now = new Date().toISOString();
    var idx = terms.findIndex(t => t.id === selectedId || (!selectedId && String(t.text || '').toLowerCase() === d.text.toLowerCase()));
    var term;
    if (idx >= 0) {
      term = Object.assign({}, terms[idx], d, { updatedAt: now });
      term.stats = terms[idx].stats || term.stats || {};
      terms[idx] = term;
    } else {
      term = Object.assign({ id: this.makeId(), createdAt: now, updatedAt: now, stats: { correct: 0, wrong: 0, weight: 1 } }, d);
      terms.push(term);
    }
    doc.terms = terms;
    await this.writeDocument(doc);
    return term;
  },

  async saveAddTerm(win) {
    try {
      var term = await this.saveDraftToDocument(this.addDraft(win), null);
      this.selectedIdByWindow.set(win, term.id);
      this.setDraft(win, term);
      await this.refreshTerms(win);
      this.status(win, 'add-status', '保存成功：' + term.text, 'ok');
      this.clearAddDraft(win);
    } catch (e) { this.status(win, 'add-status', String(e.message || e), 'err'); }
  },
  async saveTerm(win) {
    try { var term = await this.saveDraftToDocument(this.draft(win), this.selectedIdByWindow.get(win)); this.selectedIdByWindow.set(win, term.id); await this.refreshTerms(win); this.status(win, 'edit-status', '保存成功：' + term.text, 'ok'); }
    catch (e) { this.status(win, 'edit-status', String(e.message || e), 'err'); }
  },
  async deleteTerm(win) {
    var id = this.selectedIdByWindow.get(win); if (!id) return;
    var doc = await this.readDocument(); doc.terms = (doc.terms || []).filter(t => t.id !== id); await this.writeDocument(doc); this.selectedIdByWindow.delete(win); await this.refreshTerms(win); this.status(win, 'edit-status', '已删除。', 'ok');
  },

  getSelectedTerm(win) {
    var p = this.panel(win);
    var terms = p ? (p._wlTerms || []) : [];
    var id = this.selectedIdByWindow.get(win);
    return terms.find(t => t.id === id) || terms[0] || null;
  },

  syncEditDraftFromSelected(win) {
    var term = this.getSelectedTerm(win);
    if (term) this.setDraft(win, term);
  },

  switchWordbookMode(win, mode) {
    var p = this.panel(win);
    this.wordbookModeByWindow.set(win, mode);
    var card = p.querySelector('[data-wl-page="card"]'); var edit = p.querySelector('[data-wl-page="edit"]');
    if (mode === 'edit') {
      this.syncEditDraftFromSelected(win);
    }
    if (card) card.style.display = mode === 'card' ? '' : 'none';
    if (edit) edit.style.display = mode === 'edit' ? '' : 'none';
    p.querySelectorAll('[data-wl-subtab]').forEach(b => this.activatePresetStyle(b, b.dataset.wlSubtab === mode));
  },

  renderCard(win) {
    var p = this.panel(win), box = p.querySelector('[data-role="card-content"]'); if (!box) return;
    var terms = p._wlTerms || [];
    var id = this.selectedIdByWindow.get(win);
    var idx = terms.findIndex(t => t.id === id); if (idx < 0) idx = 0;
    if (!terms.length) { box.innerHTML = '<div style="color:#6b7280">0 / 0</div><h2>未选择单词</h2><button data-role="speak-empty">🔊</button><h4>释义</h4><h4>相关短语</h4><h4>上下文解释</h4><h4>例句</h4>'; return; }
    var t = terms[idx]; this.selectedIdByWindow.set(win, t.id); box.textContent = '';
    box.append(this.html(win.document, 'div', { text: (idx+1) + ' / ' + terms.length, styleObj: { color: '#6b7280', marginBottom: '14px' } }));
    box.append(this.html(win.document, 'h2', { text: t.text || '', styleObj: { margin: '0 0 8px', fontSize: '26px' } }));
    var pr = this.html(win.document, 'div', { styleObj: { display: 'flex', gap: '8px', alignItems: 'center', color: '#64748b', marginBottom: '20px' } }); pr.append(this.html(win.document, 'span', { text: t.pronunciation || '' })); pr.append(this.html(win.document, 'button', { text: '🔊', styleObj: Object.assign(this.buttonStyle(false, true), { padding: '2px 6px' }), on: { click: () => this.speakSelectedTerm(win) } })); box.append(pr);
    box.append(this.html(win.document, 'h4', { text: '释义' })); box.append(this.html(win.document, 'div', { text: t.meaning || '' }));
    if (t.related && t.related.length) { box.append(this.html(win.document, 'h4', { text: '相关短语' })); var chips = this.html(win.document, 'div', { styleObj: { display: 'flex', flexWrap: 'wrap', gap: '6px' } }); t.related.forEach(r => chips.append(this.html(win.document, 'span', { text: r, styleObj: { background: '#f1f5f9', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' } }))); box.append(chips); }
    box.append(this.html(win.document, 'h4', { text: '上下文解释' })); box.append(this.html(win.document, 'p', { text: t.context || '', styleObj: { lineHeight: 1.6 } }));
    box.append(this.html(win.document, 'h4', { text: '例句' })); box.append(this.html(win.document, 'p', { text: t.example || '', styleObj: { color: '#475569' } }));
  },

  renderList(win) {},

  renderAllWordsList(win) {
    var p = this.panel(win); if (!p) return;
    var list = p.querySelector('[data-role="allwords-list"]'); if (!list) return;
    var terms = (p._wlTerms || []).slice();
    var q = String(this.val(win, 'allwords-search') || '').toLowerCase();
    if (q) terms = terms.filter(t => String(t.text || '').toLowerCase().includes(q));
    var sort = this.allWordsSortByWindow.get(win) || 'az';
    terms.sort((a,b) => sort === 'az' ? String(a.text).localeCompare(String(b.text)) : String(b.text).localeCompare(String(a.text)));
    list.textContent = '';
    if (!terms.length) { list.appendChild(this.html(win.document, 'div', { text: '暂无词汇', styleObj: { padding: '12px', color: '#6b7280' } })); return; }
    terms.forEach(t => {
      var item = this.html(win.document, 'div', { styleObj: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb', cursor: 'pointer' } });
      item._termId = t.id;
      item.dataset.termId = t.id;
      item.appendChild(this.html(win.document, 'div', { text: t.text, styleObj: { fontWeight: 800 } }));
      item.appendChild(this.html(win.document, 'div', { text: this.firstDefinition(t.meaning), styleObj: { color: '#64748b', fontSize: '12px', marginTop: '3px' } }));
      item.addEventListener('click', () => { this.selectedIdByWindow.set(win, t.id); this.setDraft(win, t); this.renderCard(win); this.switchTab(p, 'wordbook'); this.switchWordbookMode(win, 'card'); });
      list.appendChild(item);
    });
  },

  moveSelection(win, delta) {
    var p = this.panel(win); var terms = p._wlTerms || []; if (!terms.length) return;
    var id = this.selectedIdByWindow.get(win); var idx = terms.findIndex(t => t.id === id); if (idx < 0) idx = 0;
    idx = (idx + delta + terms.length) % terms.length; this.selectedIdByWindow.set(win, terms[idx].id); this.setDraft(win, terms[idx]); this.renderCard(win);
  },

  buildLLMPrompt(d) {
    return '你是学术英语词汇助手。请根据给定词汇和论文语境补全 JSON。只输出 JSON。字段：text, pronunciation, meaning, context, related, example。要求中文释义简洁，context 结合计算机视觉/机器学习论文语境，related 为英文短语数组。\n输入：' + JSON.stringify(d, null, 2);
  },

  buildChatRequest(s, prompt, maxTokens) {
    var url = this.normalizeAPIBase(s.apiUrl);
    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.apiKey };
    if (s.provider === 'Anthropic') return { url, headers: Object.assign(headers, { 'anthropic-version': '2023-06-01' }), body: { model: s.modelName, max_tokens: maxTokens || 1200, messages: [{ role: 'user', content: prompt }] } };
    var body = { model: s.modelName, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: maxTokens || 1200 };
    if (s.thinking && s.thinking !== 'default') body.reasoning_effort = s.thinking;
    return { url, headers, body };
  },

  async fetchWithTimeout(url, opts) {
    var controller = new AbortController(); var t = setTimeout(() => controller.abort(), 45000); opts.signal = controller.signal;
    try { return await fetch(url, opts); } finally { clearTimeout(t); }
  },

  extractLLMContent(s, json) { if (s.provider === 'Anthropic') return (json.content || []).map(c => c.text || '').join('\n'); return json.choices && json.choices[0] && json.choices[0].message ? json.choices[0].message.content : ''; },
  parseJsonMaybe(text) { var m = String(text || '').match(/```json\s*([\s\S]*?)```/i) || String(text || '').match(/```\s*([\s\S]*?)```/); var raw = m ? m[1] : text; var start = raw.indexOf('{'), end = raw.lastIndexOf('}'); if (start >= 0 && end > start) raw = raw.slice(start, end+1); return JSON.parse(raw); },

  async llmCompleteDraft(win, button, d, statusRole, applyData) {
    var generation = this.currentGeneration(win);
    // Do not call saveSettings() here. saveSettings() rebuilds the panel after
    // changing preferences and can wipe the in-progress Add Word / Edit Word
    // form before the LLM request is created. Read the current panel values
    // directly, and let the user save settings explicitly in the Settings tab.
    var s = this.settingsFromPanel(win) || this.settings();
    if (!s.apiUrl || !s.modelName || !s.apiKey) { this.status(win, statusRole, '请先在设置中填写 API URL、Model 和 API Key。', 'err'); return; }
    if (!d.text && !d.example) { this.status(win, statusRole, '请至少输入单词或例句。', 'err'); return; }
    var prompt = this.buildLLMPrompt(d); var req = this.buildChatRequest(s, prompt, 1400);
    button.disabled = true; this.status(win, statusRole, 'LLM 正在补全...\nPOST ' + req.url, '');
    try {
      var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) });
      var text = await res.text();
      if (!this.isRenderCurrent(win, generation)) return;
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 500));
      var content = this.extractLLMContent(s, JSON.parse(text));
      var obj = this.parseJsonMaybe(content);
      applyData(Object.assign({}, d, obj));
      this.status(win, statusRole, 'LLM 补全完成。', 'ok');
    } catch (e) { this.status(win, statusRole, 'LLM 补全失败：' + (e.message || e), 'err'); }
    } finally {
      try { if (this.isRenderCurrent(win, generation) && button) button.disabled = false; } catch (e) {}
    }
  },

  llmCompleteAdd(win, button) { this.llmCompleteDraft(win, button, this.addDraft(win), 'add-status', d => this.setAddDraft(win, d)); },
  llmComplete(win, button) { this.llmCompleteDraft(win, button, this.draft(win), 'edit-status', d => this.setDraft(win, d)); },

  settingsFromPanel(win) { return { language: this.val(win,'language') || 'zh-CN', provider: this.val(win,'provider') || 'DeepSeek', apiUrl: this.val(win,'apiUrl'), modelName: this.val(win,'modelName'), thinking: this.val(win,'thinking') || 'default', speechStyle: this.val(win,'speechStyle') || '', apiKey: this.val(win,'apiKey'), databasePath: this.val(win,'databasePath'), themeMode: this.getThemeMode(win) }; },
  async loadSettings(win) {
    var s = this.settings();
    ['language','provider','apiUrl','modelName','thinking','speechStyle','apiKey','databasePath'].forEach(k => this.setVal(win, k, s[k]));
    try { this.setVal(win, 'defaultDatabasePath', await this.defaultDatabasePath()); } catch (e) {}
    this.populateSpeechVoices(win, s.speechStyle);
    this.setThemeMode(win, s.themeMode || 'light', true);
  },
  async saveSettings(win) {
    var oldPath = await this.databasePath();
    var s = this.settingsFromPanel(win);
    Object.keys(s).forEach(k => this.prefSet(k, s[k]));
    var newPath = await this.databasePath();
    if (newPath !== oldPath && !(await IOUtils.exists(newPath)) && await IOUtils.exists(oldPath)) {
      try { await IOUtils.makeDirectory(PathUtils.parent(newPath), { ignoreExisting: true }); await IOUtils.copy(oldPath, newPath); } catch (e) { this.status(win, 'settings-status', '复制数据库到新路径失败：' + e, 'err'); return; }
    }
    await this.ensureDatabase();
    this.status(win, 'settings-status', '设置已保存，界面语言已更新。', 'ok');
    await this.loadSettings(win);
    this.refreshTheme(win);
  },
  async testConnection(win, button) {
    var generation = this.currentGeneration(win);
    this.saveSettings(win); var s = this.settingsFromPanel(win); if (!s.apiUrl || !s.modelName || !s.apiKey) { this.status(win, 'settings-status', 'Missing API URL, model name, or API key.', 'err'); return; }
    var req = this.buildChatRequest(s, 'Reply with OK.', 32); if (button) button.disabled = true; this.status(win, 'settings-status', 'Testing...\nPOST ' + req.url, '');
    try { var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }); var text = await res.text(); if (!this.isRenderCurrent(win, generation)) return; this.status(win, 'settings-status', (res.ok ? 'Success' : 'Failure') + ': HTTP ' + res.status + '\n' + text.slice(0, 700), res.ok ? 'ok' : 'err'); }
    catch (e) { if (this.isRenderCurrent(win, generation)) this.status(win, 'settings-status', 'Failure: ' + (e.message || e), 'err'); } finally { try { if (this.isRenderCurrent(win, generation) && button) button.disabled = false; } catch (e) {} }
  },

  weightedReviewPool(terms) {
    var pool = [];
    terms.forEach(t => { var st = this.termStats(t); var n = Math.max(1, Math.min(8, Math.round(st.weight || 1))); for (var i=0;i<n;i++) pool.push(t); });
    return pool;
  },
  randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle(arr) { var a = arr.slice(); for (var i=a.length-1;i>0;i--) { var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; },

  getQuestionTypes(term) {
    var types = ['meaning', 'example', 'spelling'];
    return types;
  },

  startReview(win) {
    var p = this.panel(win); var terms = p._wlTerms || []; var n = parseInt(this.val(win, 'review-count'), 10) || 10;
    if (!terms.length) { this.reviewContent(win, '<h2>暂无复习词条</h2>'); return; }
    var pool = this.weightedReviewPool(terms); var selected = [];
    while (selected.length < Math.min(n, terms.length) && pool.length) { var t = this.randomPick(pool); if (!selected.find(x=>x.id===t.id)) selected.push(t); }
    var tasks = [];
    selected.forEach(t => this.getQuestionTypes(t).forEach(type => tasks.push({ termId: t.id, type, done: false, correct: false, attempts: 0 })));
    var session = { selected, tasks: this.shuffle(tasks), completedTermIds: [], current: null, answered: false };
    this.reviewSessionByWindow.set(win, session); this.nextReviewTask(win);
  },
  nextReviewTask(win) {
    var s = this.reviewSessionByWindow.get(win); if (!s) return;
    var pending = s.tasks.filter(t => !t.done);
    if (!pending.length) { this.reviewContent(win, '<h2>复习完成</h2><p>已完成 ' + s.completedTermIds.length + ' 个单词。</p>'); this.updateReviewProgress(win); return; }
    s.current = this.randomPick(pending); s.answered = false; this.renderReviewTask(win);
  },
  reviewTerm(win) { var p=this.panel(win), s=this.reviewSessionByWindow.get(win); if(!s||!s.current)return null; return (p._wlTerms||[]).find(t=>t.id===s.current.termId); },
  reviewContent(win, html) { var el=this.q(win,'review-content'); if(el) el.innerHTML=html; },
  updateReviewProgress(win) { var s=this.reviewSessionByWindow.get(win); var total=s?(s.selected.length):0; var done=s?(s.completedTermIds.length):0; var txt=this.q(win,'review-progress'); if(txt) txt.textContent=done+' / '+total; var bar=this.q(win,'review-bar'); if(bar) bar.style.width=total?Math.round(done/total*100)+'%':'0%'; },

  distractorMeanings(win, term) {
    var terms=(this.panel(win)._wlTerms||[]).filter(t=>t.id!==term.id && t.meaning);
    var picks=this.shuffle(terms).slice(0,3).map(t=>this.firstDefinition(t.meaning));
    var fallback=['方法；途径；接近','说明；举例说明；图解','显著的','衰减；扣除','从数据中自动归纳潜在规律'];
    while(picks.length<3) picks.push(fallback[picks.length]);
    return picks;
  },

  renderReviewTask(win) {
    var term=this.reviewTerm(win); if(!term){this.nextReviewTask(win);return;}
    var s=this.reviewSessionByWindow.get(win), type=s.current.type;
    this.updateReviewProgress(win);
    if(type==='spelling') return this.renderSpellingTask(win, term);
    var opts=this.shuffle([this.firstDefinition(term.meaning)].concat(this.distractorMeanings(win,term))).slice(0,4);
    var doc=win.document, box=this.q(win,'review-content'); box.textContent='';
    box.append(this.html(doc,'h2',{text:term.text||''}));
    box.append(this.html(doc,'div',{text:term.pronunciation||'',styleObj:{color:'#64748b',marginBottom:'6px'}}));
    box.append(this.html(doc,'button',{text:'🔊',styleObj:this.buttonStyle(false,true),on:{click:()=>this.speakReviewTerm(win)}}));
    if(type==='example' && term.example) box.append(this.html(doc,'p',{text:'例句：'+term.example,styleObj:{fontWeight:600}}));
    box.append(this.html(doc,'h4',{text:type==='example'?'根据单词和例句，选择最合适的中文释义':'请选择最合适的中文释义'}));
    opts.forEach(o=>{ var b=this.html(doc,'button',{text:o,dataset:{reviewChoice:o},styleObj:Object.assign(this.buttonStyle(false,false),{display:'block',width:'100%',borderRadius:'8px',margin:'6px 0',textAlign:'left'})}); b.addEventListener('click',()=>this.answerMeaningChoice(win,b)); box.append(b); });
    this.appendReviewGradeButtons(win, box);
    box.append(this.statusBox(doc,'review-status'));
  },
  answerMeaningChoice(win, btn) {
    var term=this.reviewTerm(win), correct=this.firstDefinition(term.meaning); var ok=btn.dataset.reviewChoice===correct;
    this.panel(win).querySelectorAll('[data-review-choice]').forEach(b=>{ if(b.dataset.reviewChoice===correct){b.style.borderColor='#16a34a';b.style.background='#dcfce7';} else if(b===btn&&!ok){b.style.borderColor='#dc2626';b.style.background='#fee2e2';} });
    this.q(win,'review-status').textContent= ok?'回答正确。':'回答错误。已显示正确答案，请点击“不认识”继续加强。'; this.q(win,'review-status').style.background=ok?'#dcfce7':'#fee2e2';
    if(ok)this.completeCurrentTask(win,true); else this.failCurrentTask(win);
  },
  appendReviewGradeButtons(win, box) {
    var doc=win.document,row=this.html(doc,'div',{styleObj:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginTop:'12px'}});
    [['unknown','不认识','#dc2626'],['fuzzy','模糊','#d97706'],['known','认识','#16a34a']].forEach(a=>{ var b=this.html(doc,'button',{text:a[1],dataset:{reviewGrade:a[0]},styleObj:Object.assign(this.buttonStyle(false,false),{borderColor:a[2],color:a[2]})}); b.addEventListener('click',()=>this.markReview(win,a[0])); row.append(b); }); box.append(row);
  },
  renderSpellingTask(win, term) {
    var doc=win.document,box=this.q(win,'review-content'); box.textContent='';
    box.append(this.html(doc,'div',{text:term.pronunciation||''})); box.append(this.html(doc,'button',{text:'🔊',styleObj:this.buttonStyle(false,true),on:{click:()=>this.speakReviewTerm(win)}})); box.append(this.html(doc,'h3',{text:this.firstDefinition(term.meaning)}));
    var letters=String(term.text||''); var wrap=this.html(doc,'div',{styleObj:{display:'flex',flexWrap:'wrap',gap:'4px',fontSize:'24px',fontWeight:800,margin:'16px 0'}}); var inputs=[];
    for(var i=0;i<letters.length;i++){ if(letters[i]===' '){wrap.append(this.html(doc,'span',{text:' ',styleObj:{width:'16px'}}));continue;} var inp=this.html(doc,'input',{attrs:{maxlength:'1'},styleObj:{width:'26px',border:'none',borderBottom:'2px solid #64748b',textAlign:'center',fontSize:'22px',outline:'none'}}); inp.dataset.index=i; inp.addEventListener('input',()=>this.checkSpelling(win,term,inputs)); inputs.push(inp); wrap.append(inp); }
    box.append(wrap); box.append(this.statusBox(doc,'review-status'));
  },
  checkSpelling(win,term,inputs){ var chars=String(term.text||''); var ok=true; inputs.forEach(inp=>{ var i=parseInt(inp.dataset.index,10), good=chars[i].toLowerCase(), val=String(inp.value||'').toLowerCase(); if(!val){ok=false;inp.style.color='#111827';return;} if(val===good){inp.style.color='#16a34a';} else {inp.style.color='#dc2626';ok=false;} }); if(ok){ var st=this.q(win,'review-status'); st.textContent='拼写正确。点击下一题继续。'; st.style.background='#dcfce7'; var b=this.html(win.document,'button',{text:'下一题',dataset:{role:'review-spelling-next'},styleObj:this.buttonStyle(true,true),on:{click:()=>this.markReview(win,'known')}}); st.appendChild(b); this.completeCurrentTask(win,true); } },
  completeCurrentTask(win,correct){ var s=this.reviewSessionByWindow.get(win); if(!s||!s.current)return; var task=s.current; task.done=true; task.correct=!!correct; var related=s.tasks.filter(t=>t.termId===task.termId); if(related.every(t=>t.done&&t.correct)&&!s.completedTermIds.includes(task.termId))s.completedTermIds.push(task.termId); this.updateReviewProgress(win); },
  failCurrentTask(win){ var s=this.reviewSessionByWindow.get(win); if(!s||!s.current)return; s.current.attempts++; s.current.done=false; s.current.correct=false; },
  async markReview(win,grade){ var term=this.reviewTerm(win); if(!term)return; var doc=await this.readDocument(); var t=(doc.terms||[]).find(x=>x.id===term.id); if(t){var st=this.termStats(t); st[grade]=(st[grade]||0)+1; if(grade==='known'){st.correct++;st.weight=Math.max(1,(st.weight||1)*0.75);}else{st.wrong++;st.weight=Math.min(8,(st.weight||1)+1.5);} st.lastReviewedAt=new Date().toISOString(); await this.writeDocument(doc);} if(grade==='known')this.completeCurrentTask(win,true); else this.failCurrentTask(win); await this.refreshTerms(win); this.nextReviewTask(win); },
  showReviewAnswer(win){var term=this.reviewTerm(win); if(!term)return; var st=this.q(win,'review-status'); if(st){st.textContent='正确答案：'+(this.reviewSessionByWindow.get(win).current.type==='spelling'?term.text:this.firstDefinition(term.meaning));st.style.background='#fef3c7';}},

  speak(text, win) { text=String(text||'').trim(); if(!text)return; var u=new win.SpeechSynthesisUtterance(text); u.lang='en-US'; var style=this.settings().speechStyle; var voices=win.speechSynthesis.getVoices(); if(style){var v=voices.find(x=>x.name===style); if(v)u.voice=v;} win.speechSynthesis.cancel(); win.speechSynthesis.speak(u); },
  speakSelectedTerm(win){var t=this.getSelectedTerm(win); if(t)this.speak(t.text,win);},
  speakReviewTerm(win){var t=this.reviewTerm(win); if(t)this.speak(t.text,win);},
  speakDraft(win){this.speak(this.val(win,'text'),win);},
  speakAddDraft(win){this.speak(this.val(win,'add-text'),win);},
  previewSpeechStyle(win){this.speak('Word Learning pronunciation preview.',win);},
  populateSpeechVoices(win, selected){ var sel=this.q(win,'speechStyle'); if(!sel)return; var voices=[]; try{voices=win.speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang||''));}catch(e){} sel.textContent=''; if(!voices.length)voices=[{name:'',lang:'',label:'系统默认'}]; voices.forEach((v,i)=>{var op=win.document.createElement('option');op.value=v.name||'';op.textContent=v.name?((v.name)+' - '+(v.lang||'')):'系统默认';sel.appendChild(op);}); sel.value=selected||''; },

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
    // Some Zotero builds support unregistering by plugin id.  Use this as a
    // harmless extra cleanup path for repeated development installs.
    try { Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this.id); } catch (e3) {}
    this.readerSelectionHandler = null;
  },

  renderReaderSelectionPopup(event) {
    // Non-invasive Reader selection popup integration.
    //
    // Important: Zotero's `append` callback for renderTextSelectionPopup is only
    // reliable during the synchronous render event.  Version 0.9.9 deferred the
    // append with setTimeout(0), which avoided competing with other plugins but
    // also meant the Word Learning button could disappear entirely because the
    // popup had already finished building.  Keep the control compact and append
    // synchronously instead.
    try {
      var doc = event && event.doc;
      var append = event && event.append;
      if (!doc || typeof append !== 'function') return;

      var text = this.extractSelectionText(event);
      if (!text) return;

      if (doc.querySelector('[data-role="wl-reader-selection-action"]')) return;

      var btn = doc.createElement('button');
      btn.setAttribute('data-role', 'wl-reader-selection-action');
      btn.type = 'button';
      btn.textContent = this.isChineseUI() ? '加入词库' : 'Add to Wordbook';
      btn.title = this.isChineseUI() ? '将当前选中文本加入 Word Learning 词库草稿' : 'Open the current selection as a Word Learning draft';

      // Compact single-button style: avoid taking enough vertical space to hide
      // Translate / LLM-for-Zotero controls in the same popup.
      btn.style.display = 'block';
      btn.style.width = '100%';
      btn.style.boxSizing = 'border-box';
      btn.style.minHeight = '26px';
      btn.style.margin = '4px 0 0 0';
      btn.style.padding = '4px 8px';
      btn.style.borderRadius = '6px';
      btn.style.border = '1px solid rgba(45, 140, 255, 0.40)';
      btn.style.background = '#2d8cff';
      btn.style.color = '#ffffff';
      btn.style.fontWeight = '650';
      btn.style.fontSize = '12px';
      btn.style.lineHeight = '16px';
      btn.style.cursor = 'pointer';
      btn.style.webkitAppearance = 'none';
      btn.style.appearance = 'none';

      var plugin = this;
      btn.addEventListener('click', function (ev) {
        try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
        try {
          var payload = plugin.buildSelectionPayload(event);
          plugin.openPanelWithSelection(plugin.getMainWindow(), payload);
        } catch (e) {
          plugin.debug('reader selection button failed: ' + e);
        }
      });

      append(btn);
    } catch (e) {
      this.debug('renderReaderSelectionPopup failed: ' + e);
    }
  },

  exposeHost(win) { this.ensurePanel(win); },
  extractSelectionText(event) { try { return String(event.text || event.selectionText || (event.selection && event.selection.toString()) || '').trim(); } catch(e){return '';} },
  buildSelectionPayload(event){ var text=this.extractSelectionText(event); return { text, example:text }; },
  openPanelWithSelection(win,payload){ this.lastSelectionPayload=payload; var p=this.panel(win); this.switchTab(p,'addword'); this.setAddDraft(win,{text:payload.text,example:payload.example}); },
  isChineseUI(){ return /^zh/.test(this.settings().language||''); },

  installThemeStyles(win, panel) {
    if (this.themeStyleByWindow.get(win)) return;
    var doc=win.document, style=doc.createElement('style'); style.textContent=this.themeCSS(); doc.documentElement.appendChild(style); this.themeStyleByWindow.set(win,style);
  },
  themeCSS(){return `
#wl-panel-v026{--wl-bg:#f8fafc;--wl-surface:#fff;--wl-surface-2:#f1f5f9;--wl-text:#111827;--wl-text-muted:#64748b;--wl-border:#e5e7eb;--wl-input-bg:#fff;--wl-button-bg:#fff;--wl-button-hover:#f8fafc;--wl-chip-bg:#f1f5f9;--wl-chip-text:#334155;--wl-blue:#2f7df6;--wl-red-bg:#fef2f2;--wl-red-border:#fecaca;--wl-red-text:#b91c1c;--wl-orange-bg:#fff7ed;--wl-orange-border:#fed7aa;--wl-orange-text:#c2410c;--wl-green-bg:#f0fdf4;--wl-green-border:#bbf7d0;--wl-green-text:#15803d;color:var(--wl-text)!important;background:var(--wl-bg)!important;color-scheme:light;}
#wl-panel-v026[data-wl-theme="dark"]{--wl-bg:#2b2b2b;--wl-surface:#242424;--wl-surface-2:#303030;--wl-text:#f3f4f6;--wl-text-muted:#d1d5db;--wl-border:#555;--wl-input-bg:#1f1f1f;--wl-button-bg:#3a3a3a;--wl-button-hover:#464646;--wl-chip-bg:#4a4a4a;--wl-chip-text:#f3f4f6;--wl-blue:#3b82f6;--wl-red-bg:#3a1f22;--wl-red-border:#ef4444;--wl-red-text:#fecaca;--wl-orange-bg:#3b2a18;--wl-orange-border:#f59e0b;--wl-orange-text:#fed7aa;--wl-green-bg:#153520;--wl-green-border:#22c55e;--wl-green-text:#bbf7d0;color-scheme:dark;}
#wl-panel-v026 [data-role="wl-root"],#wl-panel-v026 [data-role="wl-section-header"]{background:var(--wl-surface)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 [data-role="wl-body"]{background:var(--wl-bg)!important;color:var(--wl-text)!important;}
#wl-panel-v026 button{background:var(--wl-button-bg)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 button[style*="rgb(47, 125, 246)"],#wl-panel-v026 button[data-tab][style*="rgb(47, 125, 246)"]{background:var(--wl-blue)!important;color:#fff!important;border-color:var(--wl-blue)!important;}
#wl-panel-v026 input,#wl-panel-v026 textarea,#wl-panel-v026 select{background:var(--wl-input-bg)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 input::placeholder,#wl-panel-v026 textarea::placeholder{color:var(--wl-text-muted)!important;opacity:.85;}
#wl-panel-v026 h2,#wl-panel-v026 h3,#wl-panel-v026 h4,#wl-panel-v026 strong,#wl-panel-v026 label{color:var(--wl-text)!important;}
#wl-panel-v026 p,#wl-panel-v026 div,#wl-panel-v026 span{color:inherit;}
#wl-panel-v026 [data-role="card-content"],#wl-panel-v026 [data-view] > div{background:var(--wl-surface)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 [data-role="allwords-list"]{background:var(--wl-surface)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 [data-role="allwords-list"]>div{background:var(--wl-surface)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 [data-role="allwords-list"]>div:hover{background:var(--wl-surface-2)!important;}
#wl-panel-v026 [data-role="review-content"]{color:var(--wl-text)!important;}
#wl-panel-v026 [data-review-choice]{background:var(--wl-surface-2)!important;color:var(--wl-text)!important;border-color:var(--wl-border)!important;}
#wl-panel-v026 [data-review-grade="unknown"]{border-color:var(--wl-red-border)!important;color:var(--wl-red-text)!important;background:var(--wl-red-bg)!important;}
#wl-panel-v026 [data-review-grade="fuzzy"]{border-color:var(--wl-orange-border)!important;color:var(--wl-orange-text)!important;background:var(--wl-orange-bg)!important;}
#wl-panel-v026 [data-review-grade="known"]{border-color:var(--wl-green-border)!important;color:var(--wl-green-text)!important;background:var(--wl-green-bg)!important;}
#wl-panel-v026 [data-role$="status"]{background:var(--wl-surface-2)!important;color:var(--wl-text)!important;}
#wl-panel-v026 [data-wl-theme-icon="1"]{width:18px;height:18px;display:block;object-fit:contain;}
`;},
  getThemeMode(win){ var cached=this.themeModeByWindow.get(win); if(cached)return cached; return this.settings().themeMode || 'light'; },
  setThemeMode(win,mode,silent){ mode=mode==='dark'?'dark':'light'; this.themeModeByWindow.set(win,mode); this.prefSet('themeMode',mode); var p=this.panel(win); if(p){p.dataset.wlTheme=mode; this.normalizeDarkElements(win,p); this.normalizeDarkSpecificWidgets(win,p);} if(!silent)this.renderThemeToggle(win); },
  refreshTheme(win){ var p=this.panel(win); if(p){p.dataset.wlTheme=this.getThemeMode(win); this.normalizeDarkElements(win,p); this.normalizeDarkSpecificWidgets(win,p);} this.renderThemeToggle(win); },
  renderThemeToggle(win){ var b=this.panel(win)?.querySelector('[data-role="theme-toggle"]'); if(!b)return; this.fillThemeToggleButton(win.document,b,this.getThemeMode(win)); },
  async fillThemeToggleButton(doc,button,mode){ button.textContent=''; var img=doc.createElement('img'); img.dataset.wlThemeIcon='1'; img.alt=mode==='dark'?'moon':'sun'; var url=mode==='dark'?'chrome://word-learning/content/icons/theme-moon.png':'chrome://word-learning/content/icons/theme-sun.png'; img.src=url; button.appendChild(img); button.title=mode==='dark'?'切换到日间模式':'切换到夜间模式'; },
  normalizeDarkElements(win,panel){ if(!panel)return; panel.dataset.wlTheme=this.getThemeMode(win); },
  normalizeDarkSpecificWidgets(win,panel){},
  setupThemeWatcher(win,panel){ this.refreshTheme(win); },
  normalizeNativeItemPaneLayout(win, panel) {
    try {
      if (!panel || panel.dataset.native !== '1') return;

      // In native Zotero ItemPane mode, Zotero already provides the section
      // header, collapse arrow, side icon and outer scroll container.  Internal
      // fallback headers/max-height constraints must not be reintroduced after
      // rebuilding the panel, otherwise a duplicate toolbar appears and the
      // content becomes trapped in a nested scroll box.
      var internalHeader = panel.querySelector('[data-role="wl-section-header"]');
      if (internalHeader && internalHeader.parentNode) {
        internalHeader.parentNode.removeChild(internalHeader);
      }

      var root = panel.querySelector('[data-role="wl-root"]');
      if (root) {
        root.style.height = 'auto';
        root.style.minHeight = '0';
        root.style.background = 'Canvas';
      }

      var bodyNode = panel.querySelector('[data-role="wl-body"]');
      if (bodyNode) {
        bodyNode.style.flex = '0 0 auto';
        bodyNode.style.maxHeight = '';
        bodyNode.style.overflow = 'visible';
        bodyNode.style.minHeight = '0';
      }

      panel.style.height = 'auto';
      panel.style.minHeight = '0';
      panel.style.overflow = 'visible';
    } catch (e) {
      this.debug('normalizeNativeItemPaneLayout failed: ' + e);
    }
  },

  rebuildPanelUI(win, activeTab) {
    var p = this.panel(win);
    if (!p) return;
    var body = p.__wordLearningBody || p;
    var generation = this.beginRender(win, body, 'rebuildPanelUI');
    while (p.firstChild) {
      p.removeChild(p.firstChild);
    }
    this.setActivePanel(win, body, p);
    this.buildPanel(win, p);
    this.setupPanelHandlers(win, body, p);
    p.__wlRenderGeneration = generation;
    this.normalizeNativeItemPaneLayout(win, p);
    this.loadSettings(win);
    this.refreshTerms(win, generation);
    this.switchTab(p, activeTab || 'wordbook');
    this.renderThemeToggle(win);
  },

  decorateNativeSectionHeader(body) {
    // Zotero's native ItemPaneManager already owns the section header.
    // Previous builds used DOM geometry guesses to inject an extra label near the
    // native WL icon.  That can accidentally touch neighboring plugin headers
    // (Translate, LLM-for-Zotero, etc.) when Zotero changes its layout, so this
    // function is intentionally kept as a no-op for plugin stability.
    return;
  },
};

function install(data, reason) { WordLearning.install(data, reason); }
function uninstall(data, reason) { WordLearning.uninstall(data, reason); }
function startup(data, reason) { WordLearning.startup(data, reason); }
function shutdown(data, reason) { WordLearning.shutdown(data, reason); }
function onMainWindowLoad(win) { WordLearning.onMainWindowLoad(win); }
function onMainWindowUnload(win) { WordLearning.onMainWindowUnload(win); }
