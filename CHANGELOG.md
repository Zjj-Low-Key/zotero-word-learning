# Changelog

## 0.5.6

- Changed speech style selection to use locally exposed English voices from `speechSynthesis.getVoices()`.
- If Zotero/Windows exposes only one English voice, Settings now shows only that one voice option.
- Preview voice now uses the exact selected local voice.
- Existing legacy speech style values remain compatible.

## 0.5.5

- Added speech style selection in Settings.
- Added local speech preview button.
- Added Auto female, Auto male, Natural clear, Slow clear, and System default voice styles.

## 0.5.4

- Fixed pronunciation button in spelling review mode.
- Changed Show Answer behavior:
  - spelling mode now shows the correct spelling;
  - multiple-choice modes now show and highlight the correct option.

## 0.5.3

- Added automatic database migration when users set a new data path.
- If the new path has no database, the old `vocabulary.json` is copied automatically.
- Existing databases at the new path are never overwritten.

## 0.5.2

- Added editable custom database path in Settings.
- Added default database path display.

## 0.5.1

- Added long-term wrong-answer weighting.
- Added persistent review statistics per word and per question type.

## 0.5.0

- Added spelling review mode.
- Added per-letter green/red spelling feedback.
- Added phrase-aware spelling slots with spaces.

## 0.4.x

- Added mixed review task pool.
- Added word-level progress.
- Added LLM-generated distractors.
- Added DeepSeek thinking intensity support.
- Added card/list/review/settings UI refinements.

## 0.3.x

- Rebuilt the plugin into a stable minimal Zotero bootstrap plugin.
- Added global wordbook persistence.
- Added LLM completion and connection testing.
- Added independent Add Word, Word Card, All Words, Review, and Settings pages.
