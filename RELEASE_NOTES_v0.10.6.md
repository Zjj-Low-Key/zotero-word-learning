# Zotero Word Learning v0.10.6

Version 0.10.6 improves panel refresh, connection testing, and PDF-selection handoff reliability.

## 更新内容

### 1. 新增显式的刷新状态按钮

现在面板顶部提供 `Refresh` / `刷新状态` 按钮，用于：

- 重新绑定当前面板；
- 刷新词库和设置状态；
- 在不重置插件的情况下恢复当前面板显示。

### 2. 测试连接结果更完整，不再被保存提示覆盖

`Test connection` / `测试连接` 现在会先静默保存当前设置，再直接显示本次测试结果。

状态区域会展示：

- Provider；
- Model；
- Endpoint；
- HTTP 状态；
- 请求耗时；
- 响应片段。

这样可以更直接地确认当前到底测试了哪个接口，以及服务端返回了什么。

### 3. 从 PDF 选中文本打开草稿更稳定

从 Reader 里的选中文本点击 `Add to Wordbook` / `加入词库` 后，插件现在会：

- 先尝试当前 reader 窗口；
- 再尝试父窗口、顶层窗口和 Zotero 主窗口；
- 如果目标面板尚未创建完成，会在短延迟后自动重试几次。

这能减少“选中了文本但没有正确带入添加草稿”的情况。

## Assets

- `zotero-word-learning-0.10.6.xpi`
- `Word-Learning-0.10.6-source-no-README.zip`
