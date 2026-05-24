# Zotero Word Learning

Zotero Word Learning is a Zotero 9 plugin for collecting, enriching, managing, and reviewing English words and phrases while reading academic papers.

The plugin is designed for paper-reading workflows in computer vision, machine learning, and AI. Select a word or phrase in the Zotero PDF reader, add it to your wordbook, let an LLM complete the pronunciation and Chinese explanations, then review it later with cards, searchable lists, meaning-choice questions, example-context questions, and spelling practice.

Chinese documentation: [README.zh-CN.md](README.zh-CN.md)

## Features

- Add selected words or phrases directly from the Zotero PDF reader.
- Open a floating `WL` panel from the Zotero main window or the Tools menu.
- Manage vocabulary through five tabs: Add Word, Word Card, All Words, Review, and Settings.
- Complete vocabulary cards with an LLM, including pronunciation, Chinese meaning, paper-context explanation, and related phrases.
- Support multiple LLM providers: OpenAI, DeepSeek, Gemini, Anthropic, MiniMax, GLM, Grok, Qwen, Kimi, and custom OpenAI-compatible endpoints.
- Configure thinking intensity for supported reasoning models.
- Store vocabulary in a local JSON database with a configurable save path.
- Automatically migrate the database when the custom path changes.
- Use system text-to-speech for local pronunciation playback.
- Review words with three question types: meaning selection, example-based meaning selection, and spelling.
- Give higher sampling weight to words answered incorrectly.
- Generate spelling- or sound-alike distractors with an LLM for more realistic multiple-choice review.
- Switch the plugin UI between Simplified Chinese and English.

## Requirements

- Zotero 9 is the recommended and target runtime for this release. The bundled manifest allows Zotero 9.0 through 9.*.

Compatibility boundary:

- Recommended: Zotero 9.x.
- Manifest-allowed: Zotero 9.0 to 9.*.
- Not supported: Zotero 8.x, Zotero 7.x, Zotero 6.x, and earlier.
- Not declared: future Zotero versions beyond 9.* until the manifest is updated and tested.
- A desktop environment with Zotero plugin support.
- An LLM API key if you want to use LLM completion, connection testing, or LLM-generated review distractors.

This means the release should be installed on Zotero 9.x. Zotero 8.x, Zotero 7.x, and earlier versions are intentionally outside the manifest range.

## Installation

1. Download `zotero-word-learning-0.5.3.xpi` from the GitHub release.
2. Open Zotero.
3. Go to `Tools` -> `Add-ons`.
4. Click the gear icon in the Add-ons Manager.
5. Choose `Install Add-on From File...`.
6. Select `zotero-word-learning-0.5.3.xpi`.
7. Restart Zotero after installation.
8. After Zotero restarts, look for the floating `WL` button on the right side of the main Zotero window, or open `Tools` -> `Word Learning`.

If the panel does not appear, disable and re-enable the plugin from Zotero Add-ons, then restart Zotero.

## Quick Start

1. Open Zotero and load a PDF in the built-in reader.
2. Select an English word or phrase in the paper.
3. Use the Word Learning entry to send the selected text into the Add Word page.
4. Paste or type the sentence where the word appears.
5. Open `Settings` and configure your LLM provider, API URL, model, and API key.
6. Click `Test connection` to verify the API settings.
7. Return to `Add Word`.
8. Click `LLM Complete`.
9. Review and edit the generated fields.
10. Click `Save`.
11. Open `Word Card`, `All Words`, or `Review` to browse and practice saved terms.

## Panel Overview

### Add Word

Use this tab for continuous vocabulary entry. It includes:

- Word/Phrase
- Example sentence
- Pronunciation
- Chinese meaning
- Context explanation
- Related phrases

`LLM Complete` fills the pronunciation, Chinese meaning, context explanation, and related phrases from the current word and example sentence. `Save` writes the entry to the local wordbook and clears the form for the next word.

### Word Card

Use this tab to read and edit saved words. The card displays:

- Word or phrase
- Pronunciation
- Speak button
- Chinese meaning
- Related phrases
- Paper-context explanation
- Example sentences

You can move between cards, create a new word, edit the selected word, run LLM completion again, save changes, or delete the selected word.

### All Words

Use this tab when your wordbook grows large. It provides:

- Search across word text, meaning, context explanation, and phrases.
- A-Z and Z-A sorting.
- One-click navigation from a list item back to the word card.

### Review

Use this tab for active recall. You can choose 10, 20, 30, or a custom number of words for a session.

For each selected word, the plugin creates three tasks:

- Choose the correct Chinese meaning.
- Choose the correct Chinese meaning from the word and an example sentence.
- Spell the word or phrase from pronunciation and meaning.

After each answer, choose:

- `Unknown` when you do not know the word.
- `Blurred` when you are unsure.
- `Known` when you know it.

Words with mistakes get higher sampling weight in later sessions.

### Settings

Use this tab to configure:

- UI language.
- LLM provider.
- API URL.
- Model name.
- Thinking intensity.
- API key.
- Vocabulary database path.

Click `Save Settings` after changes. Click `Test connection` to send a small API request and verify the provider settings.

## LLM Provider Configuration

The plugin normalizes provider defaults automatically when you choose a provider.

| Provider | Default API URL | Default model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1-mini` |
| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-flash` |
| Gemini | `https://generativelanguage.googleapis.com` | `gemini-2.0-flash` |
| Anthropic | `https://api.anthropic.com` | `claude-3-5-haiku-latest` |
| Grok | `https://api.x.ai/v1` | `grok-3-mini` |
| Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| MiniMax | empty by default | user configured |
| GLM | empty by default | user configured |
| Custom OpenAI-compatible | empty by default | user configured |

DeepSeek should use `https://api.deepseek.com`, not an Anthropic-compatible path. The plugin appends `/chat/completions` automatically for OpenAI-compatible providers unless you enter a full chat-completions URL.

Gemini requests are sent to the `:generateContent` endpoint. Anthropic requests are sent to `/v1/messages`.

## Thinking Intensity

The Settings page exposes four values:

- Default
- Low
- Medium
- High

The control is enabled only when the selected provider and model look like they support reasoning or thinking controls. Internally, the plugin maps the setting as follows:

- OpenAI-compatible reasoning models: `reasoning_effort`
- DeepSeek thinking models: `thinking` plus `reasoning_effort`
- Gemini thinking models: `thinkingConfig`
- Anthropic thinking models: `thinking.budget_tokens`

When the selected model is not detected as reasoning-capable, the control is disabled and the plugin uses `Default`.

## Vocabulary Database

By default, vocabulary is stored in the Zotero profile directory:

```text
<Zotero profile>/word-learning/vocabulary.json
```

You can set a custom full JSON file path in Settings. When you change the path, the plugin tries to copy the old database into the new location if the new file does not already exist.

The database is a local JSON document with schema version `2`. Each term can store:

- ID
- Created and updated timestamps
- Word or phrase text
- Normalized text
- Pronunciation
- Chinese meaning
- Context explanation
- Related phrases
- Example sentences
- Review mistake count
- Review statistics
- LLM-generated distractors

Because the data is stored locally, you should back up the JSON file if the wordbook matters to you.

## Recommended Workflow

1. Read a paper in Zotero.
2. Select unfamiliar academic words, phrases, and recurring terms.
3. Add one term at a time with its paper sentence.
4. Use LLM completion as a draft, not as the final source of truth.
5. Edit the Chinese meaning and context explanation so they match the paper.
6. Save the term.
7. Review 10-30 words after each reading session.
8. Use `Unknown` and `Blurred` honestly so the plugin can resurface weak terms more often.

## Source Files

This release is a classic Zotero bootstrap plugin with three source files:

- `manifest.json`: plugin metadata and Zotero compatibility.
- `prefs.js`: default plugin preferences.
- `bootstrap.js`: plugin lifecycle, UI, persistence, LLM calls, and review logic.

## Build and Packaging

The release `.xpi` is a ZIP archive containing:

- `manifest.json`
- `prefs.js`
- `bootstrap.js`

To inspect the package:

```bash
unzip -l zotero-word-learning-0.5.3.xpi
```

To build a local package from source:

```bash
zip -r zotero-word-learning-0.5.3.xpi manifest.json prefs.js bootstrap.js
```

## Troubleshooting

### The panel does not show

Restart Zotero. If it still does not show, open `Tools` -> `Add-ons`, disable and re-enable the plugin, then restart Zotero again.

### LLM Complete fails

Check the provider, API URL, model name, and API key. Use `Test connection` in Settings. If the provider is DeepSeek, use `https://api.deepseek.com`.

### Thinking intensity is disabled

The selected provider/model was not detected as supporting thinking controls. This is expected for ordinary chat models.

### Words are not saved

Check the database path in Settings. If you use a custom path, make sure the directory exists or can be created by Zotero and that Zotero has write permission.

### Pronunciation does not play

The plugin uses the operating system's browser speech synthesis support. Make sure system voices are installed and available.

## Release

Current release: `v0.5.3`

Release assets:

- `zotero-word-learning-0.5.3.xpi`: installable Zotero plugin.
- `Word Learning 0.5.3 source.zip`: source archive for this release.

## Notes

The `update_url` in `manifest.json` is currently a placeholder. If you want automatic update checks, replace it with a real update manifest URL before publishing a production update channel.
