# Zotero Word Learning v0.10.7

Version 0.10.7 fixes the top-button layout regression introduced in 0.10.6.

## 修复内容

### 1. 修复“刷新状态”和日夜切换按钮排布异常

0.10.6 中这两个按钮被放进了独立的右侧 action group：

```text
wl-tab-actions
```

并且 CSS 中用了：

```text
margin-left: auto;
```

这会导致它们不像其他 tab 按钮一样自然换行，而是作为一组被推到最右侧。侧栏宽度变窄时，前面的按钮会正常换行，但“刷新状态”和太阳按钮会单独占据右侧或下一行，排布不协调。

### 2. 改回统一的顶部按钮流

现在改为：

- 移除独立右对齐 action group；
- `刷新状态` 按钮直接加入顶部按钮流；
- 日夜模式按钮也直接加入顶部按钮流。

这样它们会像 `添加单词 / 单词卡片 / 全部词汇 / 复习 / 设置` 一样，根据插件宽度自然换行。

### 3. 保留兼容样式兜底

对仍然存在旧 `wl-tab-actions` DOM 的情况，保留了兼容样式处理，但不再强制右对齐或单独成组显示。

## Assets

- `zotero-word-learning-0.10.7.xpi`
- `Word-Learning-0.10.7-source-no-README.zip`
