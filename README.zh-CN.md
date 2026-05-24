# Zotero Word Learning

Zotero Word Learning 是一个面向 Zotero 9 的论文阅读英语词汇插件，用于在阅读英文论文时收集、补全、管理和复习学术英语单词与短语。

插件重点服务于计算机视觉、机器学习、人工智能等论文阅读场景。你可以在 Zotero PDF 阅读器中选中单词或短语，把它加入词库，让 LLM 自动补全音标、中文释义、论文语境解释和相关短语，然后通过卡片、全部词汇列表、选择题、例句题和拼写题反复复习。

English documentation: [README.md](README.md)

## 功能特性

- 在 Zotero PDF 阅读器中选中单词或短语后直接加入词库。
- 在 Zotero 主窗口右侧显示浮动 `WL` 按钮，也可以从 Tools 菜单打开。
- 提供五个页签：添加单词、单词卡片、全部词汇、复习、设置。
- 使用 LLM 补全词汇卡片，包括音标、中文释义、论文语境解释和相关短语。
- 支持多个 LLM 服务商：OpenAI、DeepSeek、Gemini、Anthropic、MiniMax、GLM、Grok、Qwen、Kimi，以及自定义 OpenAI-compatible 接口。
- 对支持推理/思考参数的模型提供思考强度设置。
- 使用本地 JSON 文件保存词库，并支持自定义数据库路径。
- 修改数据库路径时，如果新路径没有数据库，会尝试自动复制旧数据库。
- 使用系统本地 TTS 播放英文发音。
- 提供三类复习题：中文释义选择、结合例句的释义选择、根据释义和音标拼写。
- 对答错的词增加后续抽样权重。
- 使用 LLM 生成形近词、音近词、拼写相近词的混淆选项，提高复习题质量。
- 支持中文和英文界面。

## 环境要求

- 推荐使用 Zotero 9.x。当前安装包 manifest 允许 Zotero 9.0 到 9.*。

版本限制：

- 推荐运行环境：Zotero 9.x。
- manifest 允许范围：Zotero 9.0 到 9.*。
- 不支持：Zotero 8.x、Zotero 7.x、Zotero 6.x 及更早版本。
- 未声明支持：未来超过 9.* 的 Zotero 版本，需要更新 manifest 并重新测试。
- 支持 Zotero 插件的桌面环境。
- 如果要使用 LLM 补全、连接测试、LLM 生成复习混淆项，需要准备对应服务商的 API Key。

也就是说，本版本应安装在 Zotero 9.x 上。Zotero 8.x、Zotero 7.x 及更早版本被明确排除在 manifest 允许范围之外。

## 安装方法

1. 从 GitHub Release 下载 `zotero-word-learning-0.5.3.xpi`。
2. 打开 Zotero。
3. 进入 `Tools` -> `Add-ons`。
4. 点击 Add-ons Manager 里的齿轮按钮。
5. 选择 `Install Add-on From File...`。
6. 选择下载好的 `zotero-word-learning-0.5.3.xpi`。
7. 安装完成后重启 Zotero。
8. 重启后，在 Zotero 主窗口右侧寻找浮动 `WL` 按钮，或通过 `Tools` -> `Word Learning` 打开插件面板。

如果没有看到面板，可以在 Zotero Add-ons 中禁用再启用插件，然后重启 Zotero。

## 快速开始

1. 打开 Zotero，并在内置 PDF 阅读器中打开一篇论文。
2. 选中论文中的英文单词或短语。
3. 通过 Word Learning 入口把选中的文本送入“添加单词”页面。
4. 粘贴或输入这个词所在的论文例句。
5. 打开“设置”，配置 LLM 服务商、API URL、模型名和 API Key。
6. 点击“测试连接”，确认 API 设置可用。
7. 回到“添加单词”。
8. 点击“LLM 补全”。
9. 检查并编辑 LLM 生成的内容。
10. 点击“保存”。
11. 打开“单词卡片”“全部词汇”或“复习”来浏览和练习已保存词条。

## 面板说明

### 添加单词

这个页面用于连续录入新词，字段包括：

- 单词/短语
- 例句
- 音标
- 中文释义
- 上下文解释
- 相关短语

点击 `LLM 补全` 后，插件会根据当前单词和例句生成音标、中文释义、语境解释和相关短语。点击 `保存` 后，词条会写入本地词库，并清空表单，方便继续录入下一个词。

### 单词卡片

这个页面用于查看和修改已保存词条。卡片展示：

- 单词或短语
- 音标
- 发音按钮
- 中文释义
- 相关短语
- 论文语境解释
- 例句

你可以切换上一张/下一张卡片，也可以新建词条、编辑当前词条、再次运行 LLM 补全、保存修改或删除当前词条。

### 全部词汇

当词库变大后，可以用这个页面快速查找词条。它提供：

- 搜索单词、释义、语境解释和短语。
- A-Z / Z-A 排序。
- 点击列表项后直接跳转到对应的单词卡片。

### 复习

这个页面用于主动回忆。你可以选择每轮复习 10、20、30 个词，也可以输入自定义数量。

插件会为每个被抽中的词生成三道任务：

- 选择正确的中文释义。
- 根据单词和例句选择最合适的中文释义。
- 根据音标和释义拼写该单词或短语。

答题后可以选择：

- `不认识`：完全不会或答错。
- `模糊`：印象不稳定。
- `认识`：已经掌握。

答错或标记困难的词会在后续复习中获得更高抽样权重。

### 设置

这个页面用于配置：

- 界面语言。
- LLM 服务商。
- API URL。
- 模型名。
- 思考强度。
- API Key。
- 词库数据库路径。

修改后点击 `保存设置`。点击 `测试连接` 可以发送一个小请求来验证 API 是否可用。

## LLM 服务商配置

选择服务商后，插件会自动填入默认 API URL 和模型名。

| 服务商 | 默认 API URL | 默认模型 |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1-mini` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| Gemini | `https://generativelanguage.googleapis.com` | `gemini-2.0-flash` |
| Anthropic | `https://api.anthropic.com` | `claude-3-5-haiku-latest` |
| Grok | `https://api.x.ai/v1` | `grok-3-mini` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | 默认为空 | 用户自行配置 |
| GLM | 默认为空 | 用户自行配置 |
| Custom OpenAI-compatible | 默认为空 | 用户自行配置 |

DeepSeek 建议使用 `https://api.deepseek.com`，不要填写 Anthropic-compatible 路径。对于 OpenAI-compatible 服务商，如果你只填写基础 URL，插件会自动拼接 `/chat/completions`。

Gemini 请求会发送到 `:generateContent` 接口。Anthropic 请求会发送到 `/v1/messages`。

## 思考强度

设置页提供四个选项：

- 默认
- 低
- 中
- 高

只有当插件检测到当前服务商和模型可能支持推理/思考参数时，这个控件才会启用。内部映射如下：

- OpenAI-compatible reasoning model：`reasoning_effort`
- DeepSeek thinking model：`thinking` + `reasoning_effort`
- Gemini thinking model：`thinkingConfig`
- Anthropic thinking model：`thinking.budget_tokens`

如果当前模型不支持或未被识别为支持思考强度，控件会变灰，并使用 `默认`。

## 词库数据库

默认情况下，词库保存在 Zotero profile 目录：

```text
<Zotero profile>/word-learning/vocabulary.json
```

你可以在设置页填写一个完整的自定义 JSON 文件路径。路径修改后，如果新路径没有数据库，插件会尝试把旧数据库复制到新路径。

数据库是本地 JSON 文档，schema version 为 `2`。每个词条可以包含：

- ID
- 创建时间和更新时间
- 单词或短语文本
- 归一化文本
- 音标
- 中文释义
- 上下文解释
- 相关短语
- 例句
- 复习错误次数
- 复习统计信息
- LLM 生成的混淆选项

因为数据保存在本地，如果词库很重要，建议定期备份这个 JSON 文件。

## 推荐使用流程

1. 在 Zotero 中阅读论文。
2. 遇到不熟悉的学术词、短语或高频术语时选中它。
3. 每次添加一个词，并附上它在论文中的原句。
4. 把 LLM 补全结果当作初稿，而不是直接当作最终答案。
5. 根据论文上下文手动修正中文释义和语境解释。
6. 保存词条。
7. 每次阅读结束后复习 10-30 个词。
8. 如实点击 `不认识` 或 `模糊`，这样插件才能更频繁地安排薄弱词。

## 源码文件

当前版本是经典 Zotero bootstrap 插件，源码包含三个文件：

- `manifest.json`：插件元数据和 Zotero 兼容性声明。
- `prefs.js`：默认偏好设置。
- `bootstrap.js`：插件生命周期、界面、持久化、LLM 请求和复习逻辑。

## 构建与打包

Release 中的 `.xpi` 本质上是 ZIP 包，包含：

- `manifest.json`
- `prefs.js`
- `bootstrap.js`

查看安装包内容：

```bash
unzip -l zotero-word-learning-0.5.3.xpi
```

从源码重新打包：

```bash
zip -r zotero-word-learning-0.5.3.xpi manifest.json prefs.js bootstrap.js
```

## 常见问题

### 面板没有显示

先重启 Zotero。如果仍然没有显示，进入 `Tools` -> `Add-ons`，禁用再启用插件，然后再次重启 Zotero。

### LLM 补全失败

检查服务商、API URL、模型名和 API Key。可以在设置页点击 `测试连接`。如果使用 DeepSeek，API URL 建议填写 `https://api.deepseek.com`。

### 思考强度不能选择

当前服务商或模型没有被识别为支持思考参数。这对普通 chat 模型是正常现象。

### 词条没有保存

检查设置页中的数据库路径。如果使用自定义路径，需要确保目录存在或 Zotero 有权限创建目录，并且 Zotero 对该路径有写入权限。

### 发音无法播放

插件调用系统本地的语音合成功能。请确认系统已经安装可用的英文语音。

## Release

当前版本：`v0.5.3`

Release 资产：

- `zotero-word-learning-0.5.3.xpi`：可直接安装的 Zotero 插件。
- `Word Learning 0.5.3 source.zip`：当前版本源码压缩包。

## 注意

`manifest.json` 中的 `update_url` 目前仍是占位地址。如果后续需要自动更新，需要把它替换成真实的更新清单地址。
