# LLM 设置说明

## 支持的服务商

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

## DeepSeek 示例

推荐配置：

```text
Provider: DeepSeek
API URL: https://api.deepseek.com
Model: deepseek-v4-flash
```

如果选择低 / 中 / 高思考强度，请求体会包含：

```json
{
  "thinking": {
    "type": "enabled"
  },
  "reasoning_effort": "low | medium | high"
}
```

## 自定义 OpenAI-compatible

对于兼容 OpenAI Chat Completions 的 API，填写：

```text
Provider: Custom OpenAI-compatible
API URL: https://your-api.example.com
Model: your-model-name
```

插件会请求：

```text
<API URL>/chat/completions
```
