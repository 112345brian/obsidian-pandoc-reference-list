# Bripey Citation Suite

A citation management plugin for Obsidian. Displays a formatted reference sidebar for every Pandoc citekey in the current document, with live-preview and reading-mode rendering, citekey autocomplete, and Zotero sync.

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png" alt="A screenshot of the plugin's works cited list">

## Features

- **Formatted reference sidebar** — live list of all citations in the current note, filterable, with copy and jump-to buttons
- **Inline citation rendering** — live-preview and reading-mode support for `[@citekey]` and `[[@wikilink]]` syntax
- **No Pandoc required** — pure-JS BibTeX/BibLaTeX parser built in; Pandoc can still be used as an opt-in
- **Multi-source bibliography** — `.bib` file and Zotero load simultaneously; Zotero wins on conflicts
- **Native Zotero 7/8 API** — no Better BibTeX plugin required (BBT still supported for Zotero 6)
- **Mobile support** — works on iOS and Android; tap citations in reading mode for a bottom-sheet card; long-press in editor mode to view citation without interrupting editing
- **Citekey autocomplete** — fuzzy search across all bibliography entries, triggers after `@`
- **Citation decoration** — citekeys highlighted in accent color in the editor; customizable via Style Settings
- **Literature note creation** — create and open literature notes directly from the sidebar
- **Insert bibliography at cursor** — command palette action to dump the full formatted reference list into the note

## Install via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add: `112345brian/bripey-citation-suite`

## Documentation

- [Setup guide](docs/setup.md) — installation, bibliography formats, frontmatter keys, CSL styles
- [Zotero integration](docs/zotero.md) — native API, Better BibTeX, library selection, multi-source merge
- [Mobile](docs/mobile.md) — tap/long-press behaviour, file picker, limitations

## Changelog

See [release-notes.md](release-notes.md) for a full version history.

## Why the rename?

The upstream plugin is called "Pandoc Reference List" — but this fork no longer requires Pandoc, so the name felt wrong. It takes heavily from the [Citations plugin](https://github.com/hans/obsidian-citation-plugin) lineage, so "citation suite" made sense. And since my name is Bri, and this project is pretty squarely mine at this point — it's the **Bripey Citation Suite**.

## Credits

Original plugin by [mgmeyers](https://github.com/mgmeyers/obsidian-pandoc-reference-list), maintained by [obsidian-community](https://github.com/obsidian-community/obsidian-pandoc-reference-list). All the real work is theirs.

This fork incorporates changes from:
- [astroHaoPeng/alp-obsidian-pandoc-reference-list](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list) — file-relative bib paths, multiple bibliography files, auto-update on rename, better error messages
- [wjvg-gif/obsidian-pandoc-reference-list-zotero8](https://github.com/wjvg-gif/obsidian-pandoc-reference-list-zotero8) — native Zotero 7/8 API mode
- [sjelms/obsidian-pandoc-inline-citations](https://github.com/sjelms/obsidian-pandoc-inline-citations) — DOM fallback fixes, wikilink alias parsing

This fork was assembled with significant help from Claude (Anthropic). Bug diagnosis, cherry-pick selection, and most feature work were done in Claude Code sessions.
