# Zotero Word Learning v0.10.8

本版本重点提升 LLM 补全功能的稳定性和容错能力，修复 API 偶发返回空内容、截断 JSON 或非标准响应时，插件出现 `JSON.parse: unexpected end of data` 的问题。

## 修复与优化

- 新增 LLM 补全自动重试机制：空响应、JSON 不完整、网络超时、HTTP 429 或 5xx 等临时异常最多自动重试 3 次。
- 增加空响应检查，不再直接对空字符串执行 `JSON.parse()`。
- 增强 JSON 解析，支持 Markdown JSON 代码块、响应前后说明文字、尾随逗号、JSON 字符串嵌套、字符串形式的 `phrases` 和 Unicode BOM。
- 支持更多 OpenAI-compatible 响应格式，包括 `choices[0].message.content`、`choices[0].text`、`output_text`、Gemini `candidates` 及部分 SSE `data:` 响应。
- 请求明确设置 `stream: false`，降低兼容接口返回流式数据造成解析失败的概率。
- 提高 LLM 返回长度上限，降低上下文解释较长时 JSON 被截断的概率。
- 补全失败时显示 HTTP 状态码、具体错误原因及部分原始响应内容；自动重试成功后会给出明确提示。

## 升级说明

建议安装新版本后完整重启 Zotero，避免旧版本脚本或监听器残留。

## Assets

- `zotero-word-learning-0.10.8.xpi`
- `Word-Learning-0.10.8-source-no-README.zip`
