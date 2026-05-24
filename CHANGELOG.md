# Changelog

## 0.5.3

- Added automatic database migration when users set a new data path.
- If the new path has no database, the old `vocabulary.json` is copied automatically.
- Existing databases at the new path are never overwritten.
- Added explicit status messages for migration outcomes.

## 0.5.2

- Added editable custom database path in Settings.
- Added default database path display.
- Added support for storing the vocabulary JSON file on external drives or custom directories.

## 0.5.1

- Added long-term wrong-answer weighting.
- Added persistent review statistics per word and per question type.
- Added database path display in Settings.

## 0.5.0

- Added spelling review mode.
- Added per-letter green/red spelling feedback.
- Added phrase-aware spelling slots with spaces.
- A word is completed only after all review task types are passed.

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
