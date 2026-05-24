/* global Zotero, Services, PathUtils, IOUtils, Ci */

var WordLearningPlugin = {
  id: null,
  version: null,
  rootURI: null,
  readerSelectionHandler: null,
  lastSelectionPayload: null,
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
    this.addToAllWindows();
    this.registerReaderSelectionPopup();
    this.debug('startup ' + this.version);
  },

  shutdown(data, reason) {
    this.unregisterReaderSelectionPopup();
    this.removeFromAllWindows();
    this.debug('shutdown');
  },

  install() {},
  uninstall() {},

  onMainWindowLoad(data) {
    if (data && data.window) {
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
    this.injectButton(win);
    this.injectToolsMenu(win);
    this.ensurePanel(win);
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
      customDatabasePathHint: ['可自定义完整 JSON 文件路径；留空则使用默认路径。', 'Use a custom full JSON file path, or leave blank for the default path.']
    };
    var v = dict[key] || [key, key];
    return zh ? v[0] : v[1];
  },

  cssButton() {
    return {
      position: 'fixed',
      right: '0px',
      top: '190px',
      zIndex: '2147483646',
      minWidth: '42px',
      minHeight: '58px',
      padding: '6px 4px',
      borderRadius: '8px 0 0 8px',
      border: '1px solid rgba(0,0,0,.2)',
      borderRight: '0',
      background: '#2d7ff9',
      color: '#fff',
      fontWeight: '700',
      boxShadow: '0 2px 8px rgba(0,0,0,.18)',
      cursor: 'pointer',
      pointerEvents: 'auto',
      fontSize: '13px',
      lineHeight: '1.2'
    };
  },

  injectButton(win) {
    var doc = win.document;
    var button = this.html(doc, 'button', {
      id: this.ids.button,
      type: 'button',
      title: 'Word Learning',
      styleObj: this.cssButton()
    }, 'WL');
    var plugin = this;
    var handler = function (event) {
      // Do not bind mousedown and click at the same time. A normal
      // mouse click fires both events; using both makes the panel open
      // on mousedown and immediately close on click.  Use click only.
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

  panelStyle() {
    return {
      position: 'fixed',
      right: '52px',
      top: '76px',
      bottom: '28px',
      width: '580px',
      maxWidth: '56vw',
      minWidth: '460px',
      zIndex: '2147483645',
      background: '#ffffff',
      color: '#111827',
      border: '1px solid rgba(0,0,0,.22)',
      borderRadius: '14px',
      boxShadow: '0 14px 42px rgba(0,0,0,.25)',
      overflow: 'hidden',
      display: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      fontSize: '13px',
      lineHeight: '1.45'
    };
  },

  ensurePanel(win) {
    var doc = win.document;
    var panel = doc.getElementById(this.ids.panel);
    if (panel) {
      return panel;
    }
    panel = this.html(doc, 'div', { id: this.ids.panel, styleObj: this.panelStyle() });
    this.buildPanel(win, panel);
    doc.documentElement.appendChild(panel);
    this.loadSettings(win);
    this.refreshTerms(win);
    return panel;
  },

  buildPanel(win, panel) {
    var doc = win.document;
    var plugin = this;
    var root = this.html(doc, 'div', { styleObj: { height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' } });
    panel.appendChild(root);

    var header = this.html(doc, 'div', { styleObj: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e5e7eb' } });
    header.appendChild(this.html(doc, 'div', { styleObj: { fontWeight: '700', fontSize: '14px' } }, 'Word Learning'));
    header.appendChild(this.html(doc, 'div', { styleObj: { flex: '1' } }));
    var status = this.html(doc, 'div', { dataset: { role: 'top-status' }, styleObj: { color: '#6b7280', fontSize: '12px' } }, (this.version || '0.3.3') + ' loaded');
    header.appendChild(status);
    var close = this.smallButton(doc, 'x');
    close.textContent = '×';
    close.addEventListener('click', function (event) { try { event.preventDefault(); event.stopPropagation(); } catch (e) {} plugin.hidePanel(win); });
    header.appendChild(close);
    root.appendChild(header);

    var tabs = this.html(doc, 'div', { styleObj: { display: 'flex', gap: '6px', padding: '8px 10px', background: '#fff', borderBottom: '1px solid #e5e7eb' } });
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
    root.appendChild(tabs);

    var body = this.html(doc, 'div', { styleObj: { flex: '1', overflow: 'auto', padding: '12px' } });
    root.appendChild(body);
    body.appendChild(this.wordbookView(win));
    body.appendChild(this.addWordView(win));
    body.appendChild(this.allWordsView(win));
    body.appendChild(this.reviewView(win));
    body.appendChild(this.settingsView(win));
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
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        background: '#fff'
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
          borderBottom: '1px solid #f3f4f6',
          cursor: 'pointer',
          background: t.id === this.selectedIdByWindow.get(win) ? '#eff6ff' : '#fff'
        }
      });
      item._termId = t.id;
      item.appendChild(this.html(win.document, 'div', {
        styleObj: {
          fontWeight: '800',
          color: '#111827',
          marginBottom: '4px'
        }
      }, t.text || '(Untitled)'));
      item.appendChild(this.html(win.document, 'div', {
        styleObj: {
          color: '#9ca3af',
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
    again.style.width = '100%';
    again.style.height = '40px';
    again.addEventListener('click', function () { plugin.markReview(win, 'again'); });
    var hard = this.smallButton(doc, this.isChineseUI() ? '模糊' : 'Blurred');
    hard.style.width = '100%';
    hard.style.height = '40px';
    hard.style.color = '#c2410c';
    hard.style.borderColor = '#fed7aa';
    hard.style.background = '#fff7ed';
    hard.addEventListener('click', function () { plugin.markReview(win, 'hard'); });
    var known = this.smallButton(doc, this.isChineseUI() ? '认识' : 'Known');
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
    this.addSettingInput(doc, box, 'API Key', 'apiKey', 'sk-...', 'password');
    this.addSettingInput(doc, box, this.t('databasePath'), 'dataPath', this.getDefaultDataPath());
    this.addReadonlyPathRow(doc, box, this.t('defaultDatabasePath'), this.getDefaultDataPath());
    box.appendChild(this.html(doc, 'div', { styleObj: { margin: '-4px 0 10px 112px', color: '#9ca3af', fontSize: '12px', lineHeight: '18px' } }, this.t('customDatabasePathHint')));
    var row = this.actionRow(doc);
    var save = this.primaryButton(doc, this.t('saveSettings')); save.addEventListener('click', function () { plugin.saveSettings(win); });
    var test = this.smallButton(doc, this.t('testConnection')); test.addEventListener('click', function () { plugin.testConnection(win, test); });
    row.appendChild(save); row.appendChild(test); box.appendChild(row);
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
    var tabs = panel.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) this.activateTabStyle(tabs[i], tabs[i].dataset.tab === name);
    var views = panel.querySelectorAll('[data-view]');
    for (var j = 0; j < views.length; j++) views[j].style.display = views[j].dataset.view === name ? '' : 'none';
    try {
      var win = panel.ownerDocument.defaultView;
      if (name === 'addword') {
        this.clearAddDraft(win);
      }
      if (name === 'allwords') {
        this.renderAllWordsList(win);
      }
    } catch (e) {}
  },

  togglePanel(win) {
    var panel = this.ensurePanel(win);
    panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
    this.debug('togglePanel -> ' + panel.style.display);
  },

  showPanel(win) {
    var panel = this.ensurePanel(win);
    panel.style.display = 'block';
    this.refreshTerms(win);
  },

  hidePanel(win) {
    var panel = win.document.getElementById(this.ids.panel);
    if (panel) panel.style.display = 'none';
  },

  panel(win) { return win.document.getElementById(this.ids.panel); },
  field(win, name) { var p = this.panel(win); return p ? p.querySelector('[data-field="' + name + '"]') : null; },
  status(win, role, text, state) {
    var p = this.panel(win); if (!p) return;
    var n = p.querySelector('[data-role="' + role + '"]'); if (!n) return;
    n.textContent = String(text || '');
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
    var p = this.panel(win);
    var text = p?.querySelector('[data-review="text"]')?.textContent || '';
    if (!text || text === 'No review item') {
      this.status(win, 'review-status', 'No review word to read.', 'err');
      return;
    }
    this.speakText(win, text, 'review-status');
  },

  speakText(win, text, statusRole) {
    text = String(text || '').trim();
    if (!text) return;
    var synth = win.speechSynthesis || (win.window && win.window.speechSynthesis) || (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
    var Utterance = win.SpeechSynthesisUtterance || (typeof SpeechSynthesisUtterance !== 'undefined' ? SpeechSynthesisUtterance : null);
    if (!synth || !Utterance) {
      this.status(win, statusRole || 'wordbook-status', 'Speech synthesis is not available in this Zotero window.', 'err');
      return;
    }
    try {
      synth.cancel();
      var utterance = new Utterance(text);
      utterance.lang = 'en-US';
      // Some Zotero/Firefox environments choose a low-quality or very high-pitch
      // default voice.  A slightly lower pitch and slower rate makes local TTS
      // much less sharp, especially for academic words and phrases.
      utterance.rate = 0.78;
      utterance.pitch = 0.88;
      utterance.volume = 0.95;
      var voices = [];
      try { voices = synth.getVoices ? synth.getVoices() : []; } catch (e) { voices = []; }
      var badVoiceName = /(whisper|novelty|bells|boing|bubbles|cellos|deranged|hysterical|pipe|trinoids|zarvox|bad news|good news|organ|superstar|jester)/i;
      var preferredFemaleVoiceName = /(samantha|karen|victoria|susan|moira|tessa|serena|zira|jenny|aria|google us english female|female)/i;
      var preferredVoiceName = /(natural|enhanced|premium|google us english|alex|daniel|guy)/i;
      var englishVoices = voices.filter(function (v) {
        return /^en([-_]|$)/i.test(v.lang || '') && !badVoiceName.test(v.name || '');
      });
      var voice = englishVoices.find(function (v) { return preferredFemaleVoiceName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return preferredVoiceName.test(v.name || ''); }) ||
        englishVoices.find(function (v) { return /en[-_]US/i.test(v.lang || ''); }) ||
        englishVoices[0] || null;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || 'en-US';
      }
      utterance.onstart = () => this.status(win, statusRole || 'wordbook-status', 'Reading: ' + text, 'ok');
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
      var custom = Zotero.Prefs.get('extensions.word-learning.dataPath');
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

  async refreshTerms(win) {
    var p = this.panel(win); if (!p) return;
    var doc = await this.readDocument();
    p._wlTerms = doc.terms || [];
    if (!this.selectedIdByWindow.get(win) && p._wlTerms.length) this.selectedIdByWindow.set(win, p._wlTerms[0].id);
    this.renderCard(win); this.renderList(win); this.renderAllWordsList(win);
  },

  renderCard(win) {
    var p = this.panel(win); if (!p) return;
    var terms = p._wlTerms || [];
    var selected = this.selectedIdByWindow.get(win);
    var term = terms.find(function (t) { return t.id === selected; }) || terms[0] || null;
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
    await this.saveDraftToDocument(win, this.getAddDraft(win), 'addword-status', true);
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

  getSettings() {
    function get(key, fallback) { try { return Zotero.Prefs.get('extensions.word-learning.' + key) || fallback; } catch (e) { return fallback; } }
    return { language: get('language', 'zh-CN'), llmProvider: get('llmProvider', 'deepseek'), apiUrl: get('apiUrl', 'https://api.deepseek.com'), modelName: get('modelName', 'deepseek-v4-flash'), reasoningEffort: get('reasoningEffort', 'default'), apiKey: get('apiKey', ''), dataPath: get('dataPath', '') };
  },

  loadSettings(win) {
    var p = this.panel(win); if (!p) return; var s = this.getSettings();
    for (var k in s) { var n = p.querySelector('[data-setting="' + k + '"]'); if (n) n.value = s[k] || ''; }
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
      try { Zotero.Prefs.set('extensions.word-learning.' + k, s[k]); } catch (e) {}
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
    this.saveSettings(win); var s = this.settingsFromPanel(win); if (!s.apiUrl || !s.modelName || !s.apiKey) { this.status(win, 'settings-status', 'Missing API URL, model name, or API key.', 'err'); return; }
    var req = this.buildChatRequest(s, 'Reply with OK.', 32); button.disabled = true; this.status(win, 'settings-status', 'Testing...\nPOST ' + req.url, '');
    try { var res = await this.fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) }); var text = await res.text(); this.status(win, 'settings-status', (res.ok ? 'Success' : 'Failure') + ': HTTP ' + res.status + '\n' + text.slice(0, 700), res.ok ? 'ok' : 'err'); }
    catch (e) { this.status(win, 'settings-status', 'Failure: ' + (e.message || e), 'err'); } finally { button.disabled = false; }
  },


  async llmCompleteDraft(win, button, d, statusRole, applyData) {
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
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 500));
      var content = this.contentFromResponse(JSON.parse(text)).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      var data = JSON.parse(content);
      applyData(data, this);
      this.status(win, statusRole || 'wordbook-status', 'LLM suggestions filled. Review/edit, then Save.', 'ok');
    } catch (e) {
      this.status(win, statusRole || 'wordbook-status', 'LLM completion failed: ' + (e.message || e), 'err');
    } finally {
      button.disabled = false;
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
        node.style.borderBottomColor = '#9ca3af';
        node.style.color = '#111827';
        node.style.background = '#fff';
      } else if (value === target) {
        node.style.borderBottomColor = '#22c55e';
        node.style.color = '#166534';
        node.style.background = '#f0fdf4';
      } else {
        allCorrect = false;
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
      ans.textContent = t ? (t.chineseMeaning || '') + '\n' + (t.contextExplanation || '') : '';
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
      btn.appendChild(this.html(win.document, 'span', { styleObj: { flex: '1' } }, c.text));
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
        b.style.borderColor = '#22c55e';
        b.style.background = '#f0fdf4';
        b.style.color = '#166534';
      }
    }
    if (!correct) {
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
    ans.style.display = show ? 'block' : 'none';
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
  openPanelWithSelection(win, payload) { this.lastSelectionPayload = payload; this.showPanel(win); this.switchTab(this.panel(win), 'addword'); this.setAddDraft(win, { text: payload.text, example: payload.text }); this.status(win, 'addword-status', 'Draft opened from PDF selection.', 'ok'); },

  registerReaderSelectionPopup() { if (this.readerSelectionHandler || !Zotero?.Reader?.registerEventListener) return; this.readerSelectionHandler = (event) => this.renderReaderSelectionPopup(event); try { Zotero.Reader.registerEventListener('renderTextSelectionPopup', this.readerSelectionHandler, this.id); } catch (e) { this.debug('registerReaderSelectionPopup failed: ' + e); } },
  unregisterReaderSelectionPopup() { if (!this.readerSelectionHandler || !Zotero?.Reader?.unregisterEventListener) return; try { Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this.readerSelectionHandler); } catch (e) {} this.readerSelectionHandler = null; },
  renderReaderSelectionPopup(event) { try { var doc = event?.doc; var append = event?.append; if (!doc || typeof append !== 'function') return; var text = this.extractSelectionText(event); if (!text) return; var box = doc.createElement('div'); box.style.display = 'flex'; box.style.gap = '6px'; box.style.marginTop = '6px'; var btn = doc.createElement('button'); btn.textContent = 'Add to Wordbook'; var status = doc.createElement('span'); status.style.fontSize = '12px'; var plugin = this; btn.addEventListener('click', function () { var payload = plugin.buildSelectionPayload(event); plugin.openPanelWithSelection(plugin.getMainWindow(), payload); status.textContent = 'Draft opened'; }); box.appendChild(btn); box.appendChild(status); append(box); } catch (e) { this.debug('renderReaderSelectionPopup failed: ' + e); } },
  exposeHost(win) { if (!win) return; var plugin = this; win.WordLearningPluginHost = { open: function () { plugin.showPanel(win); }, getLastSelection: function () { return plugin.lastSelectionPayload; }, getCurrentContext: function () { return {}; } }; }
};

function startup(data, reason) { WordLearningPlugin.startup(data, reason); }
function shutdown(data, reason) { WordLearningPlugin.shutdown(data, reason); }
function install(data, reason) { WordLearningPlugin.install(data, reason); }
function uninstall(data, reason) { WordLearningPlugin.uninstall(data, reason); }
function onMainWindowLoad(data) { WordLearningPlugin.onMainWindowLoad(data); }
function onMainWindowUnload(data) { WordLearningPlugin.onMainWindowUnload(data); }
