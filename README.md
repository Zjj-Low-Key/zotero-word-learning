# Zotero Word Learning

Zotero Word Learning 是一个面向论文阅读场景的 Zotero 插件，用于在阅读英文论文时收集、补全、管理和复习学术英语单词与短语。

插件重点面向计算机视觉、机器学习、人工智能论文阅读场景。用户可以在 Zotero PDF 阅读器中选中单词或短语，将其加入词库，然后通过 LLM 自动补全音标、中文释义、上下文解释、相关短语、例句复习题和混淆选项。插件还提供卡片式词库、全部词汇列表、本地发音、三种复习题型、错题加权、自定义数据库路径等功能。

## 功能特性

### 1. Zotero 阅读器内添加单词

在 Zotero PDF 阅读器中选中英文单词或短语后，可以通过插件入口添加到词库。

插件会打开添加单词页面，并自动填入选中的文本。用户可以手动补充例句，也可以使用 LLM 补全其他信息。

### 2. 独立添加单词页面

插件提供独立的“添加单词”页面，专门用于新词录入。

添加页面包含：

- 单词 / 短语
- 例句
- 音标
- 中文释义
- 上下文解释
- 相关短语

点击保存后，插件会自动保存到本地 JSON 数据库。保存成功后，添加页面会自动清空，方便连续添加多个词条。

### 3. LLM 自动补全

点击 `LLM 补全` 后，插件会调用用户配置的 LLM 服务，自动补全：

- 音标
- 中文释义
- 结合论文语境的中文解释
- 包含目标词的相关短语

Prompt 默认要求 LLM 作为计算机视觉和机器学习论文阅读助手，输出适合中文读者理解的学术词汇信息。

### 4. 多服务商 LLM 设置

设置页支持多种服务商：

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

设置项包括：

- Provider
- API URL
- Model
- API Key
- 思考强度
- 数据库保存路径

### 5. 思考强度设置

对于支持思考强度的模型，插件会启用“思考强度”下拉框。

可选项：

- 默认
- 低
- 中
- 高

不同服务商使用不同请求参数：

- OpenAI-compatible reasoning model：`reasoning_effort`
- DeepSeek thinking model：`thinking` + `reasoning_effort`
- Gemini thinking model：`thinkingConfig`
- Anthropic thinking model：`thinking.budget_tokens`

如果当前模型不支持思考强度，设置项会显示为默认、灰色、不可编辑。

### 6. 单词卡片界面

“单词卡片”页面用于浏览当前词条。

卡片显示：

- 单词 / 短语
- 音标
- 发音按钮
- 中文释义
- 相关短语
- 上下文解释
- 例句

左右切换按钮固定在卡片两侧，不随卡片高度变化，方便连续点击切换。

### 7. 本地系统发音

卡片和复习页面都提供发音按钮。

发音功能调用系统本地 TTS：

```js
window.speechSynthesis
SpeechSynthesisUtterance
```

不依赖网络 API，不消耗 LLM token。

插件会优先选择英文女声，例如：

- Samantha
- Karen
- Victoria
- Microsoft Jenny
- Microsoft Aria
- Google US English Female

如果系统没有对应语音，则回退到系统默认英文语音。

### 8. 修改单词

“单词卡片”页面内提供“修改单词”入口。

用户可以修改当前卡片对应的词条信息，包括：

- 单词 / 短语
- 例句
- 音标
- 中文释义
- 上下文解释
- 相关短语

修改保存后，卡片视图会同步刷新。

### 9. 全部词汇列表

“全部词汇”页面用于查看完整词库。

功能包括：

- 默认 A-Z 排序
- 支持 Z-A 排序
- 淡灰色 `⇅ A-Z / ⇅ Z-A` 排序按钮
- 搜索词条
- 点击词条跳转到对应单词卡片

词汇列表主要显示基础信息，例如单词和中文释义，释义使用浅灰色显示。

### 10. 三种复习题型

复习页面支持三种题型。

#### 题型一：单词选择释义

给定单词或短语，用户在四个中文释义中选择正确答案。

#### 题型二：单词 + 例句选择释义

给定单词或短语，并显示一个对应例句。

如果某个词条有多个例句，插件会随机选择一个。用户根据单词和例句，在四个中文释义中选择正确答案。

#### 题型三：根据音标、发音和释义拼写单词

插件只显示：

- 音标
- 发音按钮
- 中文释义
- 根据字母数量生成的下划线输入区域

用户在下划线区域逐字输入。

反馈规则：

- 输入正确：绿色
- 输入错误：红色
- 未输入：灰色下划线

如果是短语，插件会保留空格。例如 `volume splatting` 会分成两个词块输入。

全部输入正确后，插件显示“下一题”按钮。此时不显示“不认识 / 模糊 / 认识”三个按钮。

### 11. 词条级复习进度

复习逻辑是词条级进度，而不是题目级进度。

如果用户选择复习 10 个单词，每个单词有 3 种题型，则本轮内部会生成：

```text
10 个单词 × 3 种题型 = 30 道任务
```

这些任务会混合在同一个随机池中出现。

某个单词只有在三种题型都答对后，进度才会 +1。

例如：

```text
第一个单词题型一答对 → 进度不变
第一个单词题型二答对 → 进度不变
第一个单词题型三答对 → 进度 +1
```

### 12. 当前轮错题重新进入随机池

如果某个题型答错，只有该题型会重新进入本轮随机池。

例如：

```text
题型一答对
题型二答错
题型三答对
```

则题型二会重新出现，题型一和题型三不会被重置。

### 13. 长期错题加权

插件会持久化记录错题统计。

每个词条包含：

```json
{
  "wrongCount": 3,
  "lastWrongAt": "...",
  "lastCorrectAt": "...",
  "stats": {
    "totalReviews": 8,
    "wrong": 3,
    "correct": 5,
    "byType": {
      "meaning": {
        "correct": 2,
        "wrong": 1
      },
      "example": {
        "correct": 2,
        "wrong": 1
      },
      "spelling": {
        "correct": 1,
        "wrong": 1
      }
    }
  }
}
```

开始新一轮复习时，插件会根据 `wrongCount` 对词条进行加权抽样：

```text
权重 = 1 + min(wrongCount, 10) × 2
```

错得越多，后续被抽中的概率越高。答对后，`wrongCount` 会逐步下降，但不会立刻清零。

### 14. LLM 混淆释义

保存单词时，插件会自动生成用于复习的混淆释义。

混淆释义的设计原则是英文形近 / 音近 / 拼写相近，而不是复杂语义相近。

例如目标词是 `genre`，混淆项可能是：

```json
{
  "distractors": [
    {
      "meaning": "基因",
      "sourceTerm": "gene",
      "explanation": "拼写和读音相近。"
    },
    {
      "meaning": "属；类",
      "sourceTerm": "genera",
      "explanation": "词形相近。"
    },
    {
      "meaning": "任期；终身教职",
      "sourceTerm": "tenure",
      "explanation": "视觉外观相近。"
    }
  ]
}
```

复习时，如果用户选错，错误选项右侧会显示对应英文混淆词，例如：

```text
基因 → gene
```

### 15. 本地 JSON 数据库

插件使用本地 JSON 文件保存数据，不依赖云端服务。

默认路径位于 Zotero profile 下：

```text
.../word-learning/vocabulary.json
```

用户也可以在设置页自定义完整 JSON 文件路径，例如：

```text
/Users/yourname/Documents/ZoteroWordLearning/vocabulary.json
```

或 Windows：

```text
D:\ZoteroWordLearning\vocabulary.json
```

如果新路径不存在数据库，插件会自动把旧数据库复制到新路径。  
如果新路径已经有数据库，插件不会覆盖，而是直接使用新路径已有数据。

## 安装方法

1. 下载 release 中的 `.xpi` 文件。
2. 打开 Zotero。
3. 进入 `Tools -> Add-ons`。
4. 点击齿轮图标。
5. 选择 `Install Add-on From File...`。
6. 选择下载的 `.xpi` 文件。
7. 重启 Zotero。

安装成功后，Zotero 右侧会出现 `WL` 按钮，也可以通过工具栏菜单打开插件面板。

## 使用流程

### 1. 配置 LLM

打开插件面板，进入“设置”。

填写：

- Provider
- API URL
- Model
- API Key
- 思考强度

然后点击 `测试连接`。

如果连接成功，状态栏会显示 HTTP 成功响应。

### 2. 添加单词

在 Zotero PDF 中选中一个英文单词或短语，点击插件提供的添加按钮。

或者直接进入插件面板中的“添加单词”页面手动输入。

点击 `LLM 补全`，检查生成内容后点击保存。

保存后插件会：

1. 保存词条到本地数据库；
2. 尝试生成复习用混淆释义；
3. 清空添加表单，方便继续添加下一个词。

### 3. 浏览词库

进入“单词卡片”页面，可以查看当前词条。

使用左右按钮切换词条。

点击发音按钮可以听本地系统发音。

### 4. 查看全部词汇

进入“全部词汇”页面，可以查看完整词汇列表。

支持搜索和 A-Z / Z-A 排序。

### 5. 开始复习

进入“复习”页面。

选择本次复习词数：

- 10
- 20
- 30
- 自定义数量

点击“开始复习”。

插件会从词库中根据错题权重抽取词条，并为每个词条生成三种题型任务。

## 数据结构概览

词条大致结构如下：

```json
{
  "id": "term-...",
  "text": "uncertainty",
  "normalizedText": "uncertainty",
  "pronunciation": "/ʌnˈsɜːrtənti/",
  "chineseMeaning": "不确定性",
  "contextExplanation": "在机器学习论文中通常表示模型或数据中存在的不确定因素。",
  "phrases": [
    "epistemic uncertainty",
    "aleatoric uncertainty"
  ],
  "examples": [
    {
      "id": "example-...",
      "sentence": "The model estimates uncertainty for each prediction.",
      "createdAt": "..."
    }
  ],
  "reviewDistractors": [
    {
      "meaning": "确定性",
      "sourceTerm": "certainty",
      "explanation": "词形相近。"
    }
  ],
  "wrongCount": 0,
  "stats": {
    "totalReviews": 0
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 隐私说明

- 词库数据默认保存在本地 JSON 文件中。
- 插件不会主动上传完整词库。
- LLM 补全、测试连接、混淆释义生成会把当前请求所需的词条信息发送到用户配置的 LLM API。
- API Key 保存在 Zotero preferences 中。
- 用户可以通过设置页自定义数据库路径。

## 开发说明

插件主体文件包括：

```text
manifest.json
bootstrap.js
prefs.js
```

当前版本以 Zotero bootstrap plugin 形式实现，主要逻辑集中在 `bootstrap.js` 中。

构建 XPI 的方式是将源码根目录内容压缩为 zip，并改名为 `.xpi`。

macOS / Linux 示例：

```bash
./scripts/build-xpi.sh
```

手动构建：

```bash
zip -r dist/zotero-word-learning-0.5.3.xpi manifest.json bootstrap.js prefs.js
```

Windows PowerShell 示例：

```powershell
Compress-Archive -Path manifest.json, bootstrap.js, prefs.js -DestinationPath zotero-word-learning-0.5.3.zip
Rename-Item zotero-word-learning-0.5.3.zip zotero-word-learning-0.5.3.xpi
```

## Release 文件

每个 release 建议包含：

```text
zotero-word-learning-<version>.xpi
Word Learning <version> source.zip
```

## 当前版本

```text
0.5.3
```

## License

MIT
