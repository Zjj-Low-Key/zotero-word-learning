# Zotero Word Learning v0.10.3

Version 0.10.3 adds duplicate-word validation before saving terms.

## Changes

- Adds normalized duplicate detection before saving a word or phrase.
- Treats case-only differences as the same term, for example `Abstract`, `abstract`, and ` ABSTRACT ` are considered duplicates.
- Normalizes text with trim, whitespace collapsing, Unicode NFKC normalization, and case folding before comparison.
- Blocks duplicate saves with a clear warning instead of silently overwriting or reusing an existing term.
- Excludes the currently edited term from duplicate checks in the Modify Word page, so editing the selected term itself is still allowed.
- Prevents editing one term into another existing term.

## Result

Users are warned when attempting to add a word or phrase that already exists in the vocabulary database, including entries that differ only by capitalization or surrounding whitespace.

## Assets

- `zotero-word-learning-0.10.3.xpi`
- `Word Learning 0.10.3 source no README.zip`
