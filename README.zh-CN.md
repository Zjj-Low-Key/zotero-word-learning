# Zotero Word Learning

本 Zotero 插件及其文档由 ChatGPT 和 Codex 协作完成。

Zotero Word Learning 是一个面向 Zotero 9 的论文阅读英语词汇插件，用于在阅读英文论文时收集、补全、管理和复习学术英语单词与短语。它重点服务计算机视觉、机器学习、人工智能以及相近研究方向的论文阅读流程。

English documentation: [README.md](README.md)

## 插件用途

当你在 Zotero 中阅读 PDF 时，可以把不熟悉的单词或短语加入本地词库，使用 LLM 补全词汇卡片信息，并在之后通过卡片、列表、选择题、例句题和拼写题进行复习。

推荐使用流程是：

1. 在 Zotero 中阅读论文。
2. 选中不熟悉的英文单词或短语。
3. 添加到 Word Learning。
4. 填写或生成音标、中文释义、论文语境解释和相关短语。
5. 保存到本地 JSON 词库。
6. 使用卡片、全部词汇列表、选择题、例句题和拼写题复习。

## 目标环境

- 推荐运行环境：Zotero 9。
- 插件类型：Zotero bootstrap 插件。
- 数据存储：默认保存在 Zotero profile 下的本地 JSON 文件。
- LLM 使用：可选，需要用户在插件设置中自行配置。

## 界面截图

以下截图展示当前 Zotero Item Pane 中的新版界面布局，并包含日间和夜间两套主题。

### 日间主题

手动添加新词，或从 Zotero 阅读流程中加入选中的词，再手动填写字段或使用 LLM 补全。

<img src="docs/images/add-word-light.png" alt="添加单词日间主题页面" width="620">

以卡片形式浏览已保存词条，查看音标、释义、相关短语、语境解释、例句，并播放本地发音。

<img src="docs/images/word-card-light.png" alt="单词卡片日间主题页面" width="620">

搜索完整词库，切换排序，并从列表项跳转回对应单词卡片。

<img src="docs/images/all-words-light.png" alt="全部词汇日间主题页面" width="620">

通过中文释义选择题进行主动回忆，并使用不认识、模糊、认识三个按钮记录掌握情况。

<img src="docs/images/review-light.png" alt="复习日间主题页面" width="620">

配置语言、LLM 服务商、API URL、模型、思考强度、API Key 和数据库路径。

<img src="docs/images/word-card-dark.png" alt="单词卡片夜间主题页面" width="620">

### 夜间主题

同一套流程也支持插件内部控制的夜间主题。

<img src="docs/images/add-word-dark.png" alt="添加单词夜间主题页面" width="620">

<img src="docs/images/settings-light.png" alt="设置日间主题页面" width="620">

<img src="docs/images/all-words-dark.png" alt="全部词汇夜间主题页面" width="620">

<img src="docs/images/review-dark.png" alt="复习夜间主题页面" width="620">

<img src="docs/images/settings-dark.png" alt="设置夜间主题页面" width="620">

## 功能特性

- 从 Zotero PDF 阅读流程中添加单词和短语。
- 通过 Zotero 右侧原生 Item Pane 插件区域嵌入 Word Learning 面板。
- 在 Zotero 主窗口右侧保留 `WL` 快速入口。
- 通过 `Tools` 菜单打开 Word Learning 面板。
- 提供五个主要页面：添加单词、单词卡片、全部词汇、复习、设置。
- 使用 LLM 补全音标、中文释义、论文语境解释和相关短语。
- 支持 OpenAI、DeepSeek、Gemini、Anthropic、MiniMax、GLM、Grok、Qwen、Kimi 和自定义 OpenAI-compatible API。
- 对支持推理或思考参数的模型提供思考强度设置。
- 支持插件内部日间 / 夜间主题切换。
- 顶部标签栏右侧提供独立主题切换按钮，不参与普通页面 tab 状态。
- 支持本地语音选择和语音预览。
- 使用本地 JSON 文件保存词库。
- 支持自定义数据库路径。
- 修改到空的新数据库路径时，尝试自动复制旧数据库。
- 支持卡片式浏览和编辑。
- 提供可搜索、可排序，并适配日间 / 夜间主题的全部词汇列表。
- 使用系统本地语音合成播放英文发音。
- 提供释义选择、例句语境选择、拼写三类复习题。
- 保留不认识、模糊、认识、正确选项、错误选项、选中项和状态提示的语义颜色。
- 拼写题支持逐字符绿色正确反馈和红色错误反馈。
- 根据错题情况提高后续复习抽样权重。
- 使用 LLM 生成形近、音近、拼写相近的混淆选项。
- 插件界面支持中文和英文。

## 0.10.0 更新内容

0.10.0 修复了 0.9.9 这一线在 Reader 选中文本弹窗中的按钮回归，同时保留紧凑、非侵入式的按钮设计。

- 移除 Reader 弹窗逻辑中的 `setTimeout(addControl, 0)`。
- 恢复同步 `append(btn)`，保证按钮在 Zotero 弹窗渲染周期内加入。
- 保留 0.9.9 的非侵入式设计：不再使用大块容器、不再增加状态行、不修改其他插件 DOM、只追加一个紧凑按钮。
- 保留小型蓝色按钮样式，降低遮挡 Translate 和 LLM-for-Zotero 按钮的风险。

## 仓库结构

```text
.
├── README.md
├── README.zh-CN.md
├── LICENSE
├── CHANGELOG.md
├── RELEASE_NOTES_v0.10.0.md
├── package.json
├── manifest.json
├── bootstrap.js
├── prefs.js
├── word-learning.ftl
├── chrome/
│   └── icons/
│       ├── theme-sun.png
│       └── theme-moon.png
├── docs/
│   ├── usage.md
│   ├── llm-settings.md
│   ├── review-system.md
│   └── images/
├── scripts/
│   └── build-xpi.sh
```

## 安装方法

1. 从 Release 页面下载 `zotero-word-learning-0.10.0.xpi`。
2. 打开 Zotero 9。
3. 进入 `Tools` -> `Add-ons`。
4. 点击 Add-ons Manager 中的齿轮按钮。
5. 选择 `Install Add-on From File...`。
6. 选择 `zotero-word-learning-0.10.0.xpi`。
7. 安装后重启 Zotero。
8. 重启后，点击右侧 `WL` 入口、Zotero 右侧 Item Pane 中的 Word Learning 区域，或通过 `Tools` -> `Word Learning` 打开插件。

## 首次配置

### 1. 打开插件面板

安装并重启 Zotero 后，有两个入口：

- 点击 Zotero 主窗口右侧的 `WL` 入口。
- 打开 Zotero 右侧 Item Pane 中的 Word Learning 区域。
- 打开 `Tools` -> `Word Learning`。

面板包含五个页签：

- `添加单词`
- `单词卡片`
- `全部词汇`
- `复习`
- `设置`

主题切换按钮位于标签栏最右侧，只切换 Word Learning 面板自身的日间 / 夜间模式，不改变 Zotero 全局主题。

### 2. 设置界面语言

1. 打开 `设置`。
2. 选择界面语言。
3. 点击 `保存设置`。

保存后，面板会重建，以便静态标签刷新。

### 3. 配置 LLM 服务商

LLM 配置是可选的。没有 API Key 时，你仍然可以手动添加、编辑、保存、浏览和复习词条。LLM 补全和 LLM 混淆项生成需要 API 配置。

在 `设置` 中填写：

- Provider
- API URL
- Model
- API Key
- 思考强度，如果当前模型支持

然后点击 `测试连接`。插件会发送一个小请求，并在设置页状态区域显示 HTTP 返回结果。

### 4. 选择数据库路径

默认情况下，词库保存在 Zotero profile 目录下的 `word-learning` 文件夹中。

你也可以在 `设置` 中填写一个完整的自定义 JSON 文件路径。如果切换到一个新路径，且新文件不存在，插件会尝试把旧数据库复制到新路径。

## LLM 服务商说明

服务商下拉框包含：

- OpenAI
- DeepSeek
- Gemini
- Anthropic
- MiniMax
- GLM
- Grok
- Qwen
- Kimi
- Custom OpenAI-compatible

对于 OpenAI-compatible 服务商，可以填写基础 API URL，也可以填写完整 chat-completions endpoint。Gemini 和 Anthropic 会使用各自对应的请求格式。

`思考强度` 支持：

- 默认
- 低
- 中
- 高

只有当插件判断当前服务商和模型可能支持推理或思考参数时，该控件才会启用。如果模型没有被识别为推理模型，控件会保持禁用，并使用默认行为。

## 添加单词

### 从论文中添加

1. 在 Zotero 中打开 PDF。
2. 选中英文单词或短语。
3. 打开 Word Learning。
4. 进入 `添加单词`。
5. 确认选中的文本已经填入。
6. 补充该词所在的论文例句。
7. 点击 `LLM 补全`，或手动填写字段。
8. 检查生成内容。
9. 点击 `保存`。

### 手动添加

1. 打开 `添加单词`。
2. 输入单词或短语。
3. 如果有例句，填入例句。
4. 手动填写或使用 LLM 生成音标、释义、语境解释和相关短语。
5. 点击 `保存`。

保存后，添加页表单会清空，方便连续录入下一个词。

## 词汇卡片字段

每个词条可以包含：

- 单词或短语
- 例句
- 音标
- 中文释义
- 上下文解释
- 相关短语
- 复习混淆项
- 复习统计信息

LLM 补全提示词面向学术论文阅读，会要求生成适合中文读者理解的解释，并结合计算机视觉或机器学习论文语境，而不是只给普通词典释义。

## 单词卡片

`单词卡片` 页面用于集中浏览和编辑词条。

卡片显示：

- 单词或短语
- 音标
- 发音按钮
- 中文释义
- 相关短语
- 论文语境解释
- 例句

你可以切换上一张和下一张卡片，也可以编辑当前词条、再次运行 LLM 补全、保存修改或删除当前词条。

## 全部词汇

`全部词汇` 页面用于快速查找词条。

它支持：

- 搜索单词、释义、语境解释和短语。
- A-Z 排序。
- Z-A 排序。
- 点击列表项后跳转到对应单词卡片。

## 发音

插件使用系统本地语音合成功能播放英文发音，不调用外部发音 API，也不会消耗 LLM token。

单词卡片和复习页面都可以发音。插件会优先选择英文语音，如果没有找到合适语音，则回退到系统可用语音。

## 复习系统

`复习` 页面用于主动回忆。

你可以选择：

- 10 个词
- 20 个词
- 30 个词
- 自定义数量

对于每个被抽中的词，插件可以生成三类任务：

1. 根据单词或短语选择正确中文释义。
2. 根据单词和例句选择正确中文释义。
3. 根据音标和释义拼写单词或短语。

这些任务会混合进入同一个随机复习池。

## 复习进度

复习进度以词条为单位，而不是以题目为单位。

例如选择复习 10 个词，每个词有 3 类题型时，本轮内部可能包含 30 道任务。只有某个词需要完成的题型都完成后，这个词才计入完成进度。

## 错题加权

如果某个词答错，或被标记为困难，它会在后续复习抽样中获得更高权重。这样薄弱词会更频繁出现。

复习按钮包括：

- `不认识`：完全不会。
- `模糊`：印象不稳定。
- `认识`：已经掌握。

建议如实选择，这样复习池才能反映真实记忆状态。

## LLM 混淆选项

在选择题复习中，插件可以请求 LLM 生成形近、音近或拼写相近的混淆选项。这类选项通常比随机错误答案更有训练价值。

例如，混淆项可以来自与目标词外形或读音相近但含义不同的英文词。

如果没有配置 LLM，或请求失败，插件会回退到本地可用选项。

## 本地数据

词库以 JSON 文件保存在本地。插件通过 Zotero 的本地文件 API 读写数据库。

如果词库很重要，请定期备份 JSON 文件。如果使用自定义路径，请确保 Zotero 对该路径有写入权限。

## 构建

可安装插件包是 `.xpi` 文件，本质上是一个 ZIP 包，包含：

- `manifest.json`
- `bootstrap.js`
- `prefs.js`
- `word-learning.ftl`
- `chrome/icons/theme-sun.png`
- `chrome/icons/theme-moon.png`

在仓库根目录执行：

```bash
npm run build
```

或：

```bash
bash scripts/build-xpi.sh
```

构建结果会输出到 `dist/`。

## 常见问题

### WL 按钮没有出现

重启 Zotero。如果仍然没有出现，打开 `Tools` -> `Add-ons`，禁用再启用插件，然后再次重启。

### LLM 补全失败

检查 Provider、API URL、Model 和 API Key。可以在设置页点击 `测试连接`，查看返回的 HTTP 状态。

### 修改数据库路径后词库为空

检查旧数据库文件是否存在，以及 Zotero 是否有权限复制文件。必要时可以手动复制 JSON 数据库。

### 发音无法播放

检查操作系统是否安装了英文语音，以及 Zotero 运行环境是否可用语音合成功能。

### 复习选项太泛

配置 LLM 服务商并重新保存词条，或在 API Key 可用时开始复习。LLM 配置可用时，插件可以生成更贴近目标词的混淆选项。

## Release

当前版本：`0.10.0`

Release 资产：

- `zotero-word-learning-0.10.0.xpi`
- `Word Learning 0.10.0 source no README.zip`

## 许可证

MIT。见 [LICENSE](LICENSE)。
