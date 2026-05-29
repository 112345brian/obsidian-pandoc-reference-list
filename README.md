# Obsidian Pandoc Reference List (community fork)

Displays a formatted reference in the sidebar for each pandoc citekey present in the current document.

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png" alt="A screenshot of the plugin's works cited list">

## What this fork adds

This fork combines improvements from several community forks and adds fixes and features not present in any of them:

| Change | Source |
|--------|--------|
| File-relative bibliography paths in YAML frontmatter | [astroHaoPeng](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list) |
| Multiple bibliography files as a frontmatter array | [astroHaoPeng](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list) |
| Auto-update frontmatter paths when `.bib` files are renamed | [astroHaoPeng](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list) |
| Better error messages surfaced in the UI | [astroHaoPeng](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list) |
| Native Zotero 7/8 API mode (no Better BibTeX required) | [wjvg-gif](https://github.com/wjvg-gif/obsidian-pandoc-reference-list-zotero8) |
| Manual release trigger + pre-release detection in CI | [wjvg-gif](https://github.com/wjvg-gif/obsidian-pandoc-reference-list-zotero8) |
| Fix: `el.doc` / `el.win` DOM fallbacks to prevent crashes | [sjelms](https://github.com/sjelms/obsidian-pandoc-inline-citations) |
| Fix: wikilinks with aliases (`[[link\|alias]]`) no longer mis-parsed as citations | [sjelms](https://github.com/sjelms/obsidian-pandoc-inline-citations) |
| **Fix: Zotero cache staleness bug** | this fork |
| **Fix: citations in footnotes not rendered in reading mode** | this fork |
| **Fix: semicolons inside citation suffixes treated as separators** | this fork |
| **Feature: filter input in the reference sidebar** | this fork |
| **Feature: "Insert bibliography at cursor" command** | this fork |
| **Feature: multi-source merge — .bib + Zotero simultaneously** | this fork |

### Bug fixes in this fork

#### Zotero cache staleness

The original plugin uses an incremental sync strategy: on startup it loads the local cache, then queries Zotero for items modified since `lastUpdate`. The bug was that `lastUpdate` was being advanced to `Date.now()` even when loading from the local cache file — not when actually fetching from Zotero. This caused the subsequent incremental refresh to query for items modified *after right now*, which is always empty, permanently freezing the cache. Any item added to Zotero but not yet in the cache file would never be picked up short of manually deleting the cache.

**Fix:** `lastUpdate` now only advances when a fresh fetch from Zotero completes successfully.

#### Citations in footnotes not rendered in reading mode

In reading mode, citations inside footnotes (`[^1]: see @smith2020`) were silently skipped. Obsidian calls the markdown post-processor for footnote sections (`<section data-footnotes>`) but `getSectionInfo()` returns `null` for them because footnotes don't map directly to source lines. The plugin was returning early on that null check.

**Fix:** Footnote sections are now detected and processed using the full cached citation list, so citekeys inside footnotes are resolved, styled, and interactive just like citations in the main body.

#### Semicolons inside citation suffixes

Writing something like `[@smith2020, see also Table 3; cf. Jones]` — where the semicolon is part of a note rather than separating two citations — would create an orphaned second "citation" with no key, causing rendering errors.

**Fix:** The parser now scans ahead from each `;` to check whether an `@` follows before the closing `]`. If one does, the semicolon is a citation separator as before. If not, it is treated as ordinary suffix text. Multi-citation groups like `[@a; @b]` and `[@a; see also @b]` are unaffected.

#### Multi-source merge (.bib + Zotero simultaneously)

Previously you had to choose between Zotero *or* a `.bib` file. Now both load at the same time:

- **Resolution order:** `.bib` file loads first; Zotero merges on top. For any citekey present in both, the Zotero version is used.
- **Fallback:** If Zotero is unavailable at startup, the `.bib` file covers whatever it can. You only see "Cannot connect to Zotero" if *no* fallback is available.
- **Cross-group Zotero duplicates:** If the same citationKey appears in multiple Zotero groups, the most recently modified version wins (`dateModified` from the Zotero API).
- **Conflict indicator:** Entries that exist in both sources show a ⚠ icon in the sidebar. Hovering it confirms that the Zotero version is being used.

### New features in this fork

#### Filter input in the reference sidebar

When a document has more than one citation, a search box appears at the top of the sidebar. Typing filters the list to entries whose text contains the query (case-insensitive). Useful for documents with long reference lists.

#### Insert bibliography at cursor

A new command — **Pandoc Reference List: Insert bibliography at cursor** — converts the current document's formatted reference list to markdown and inserts it at the cursor position, replacing any selected text. Entries are separated by blank lines. This is the inline equivalent of LaTeX's `\printbibliography`.

Access it via the command palette (`Ctrl/Cmd+P`) or by assigning a hotkey in Obsidian settings.

## Known issues from upstream

The table below tracks open issues in the [upstream community repo](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues) and whether this fork addresses them.

| Issue | Status in this fork |
|-------|---------------------|
| [#153](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/153) Native Zotero 7/8 API (no BBT required) | ✅ Fixed — opt-in toggle in settings |
| [#151](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/151) Recently added Zotero items never picked up | ✅ Fixed — cache staleness bug (see above) |
| [#118](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/118) Multiple `.bib` files in frontmatter | ✅ Fixed — frontmatter `bibliography` accepts an array |
| [#28](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/28) Wikilink aliases (`[[link\|alias]]`) mis-parsed as citations | ✅ Fixed |
| [#155](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/155) Stale/invalid cached CSL causes "cannot find citation" for everyone | ✅ Fixed — cached CSL is validated; a previously downloaded 404 is detected and re-fetched |
| [#127](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/127) `setViewContent is not a function` console spam on startup | ✅ Fixed — `instanceof` guard on the view getter |
| [#157](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/157) Citations in footnotes not rendered in reading mode | ✅ Fixed — see above |
| [#124](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/124) Semicolons inside citation prefixes/suffixes treated as separators | ✅ Fixed — see above |
| [#147](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/147) Autocomplete suggestion in a table cell corrupts text | ⚠️ Still broken — Obsidian's `EditorSuggest` API reports wrong cursor position inside table cells |
| [#119](https://github.com/obsidian-community/obsidian-pandoc-reference-list/issues/119) `%` in `.bib` file paths breaks parsing | 🚫 Pandoc behavior — escape `%` as `\%` in the `.bib` file |

## Credits

Original plugin by [mgmeyers](https://github.com/mgmeyers/obsidian-pandoc-reference-list), maintained by [obsidian-community](https://github.com/obsidian-community/obsidian-pandoc-reference-list). All the real work is theirs.

Forks cherry-picked from:
- [astroHaoPeng/alp-obsidian-pandoc-reference-list](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list)
- [wjvg-gif/obsidian-pandoc-reference-list-zotero8](https://github.com/wjvg-gif/obsidian-pandoc-reference-list-zotero8)
- [sjelms/obsidian-pandoc-inline-citations](https://github.com/sjelms/obsidian-pandoc-inline-citations)

## Mobile support

This fork works on iOS and Android. You do not need Pandoc or Better BibTeX. Requirements:

- **Bibliography file:** `.bib`, `.json` (CSL-JSON), or `.yaml` (CSL-YAML), stored inside your vault. Vault-relative paths work on all platforms (e.g. `references.bib` or `assets/refs.bib`). Absolute paths also work on desktop.
- **Zotero:** The native Zotero 7/8 REST API works on mobile as long as Zotero is running on the same local network and is accessible by IP.
- **CSL styles:** Downloaded automatically on first use and cached in `.pandoc/` inside the vault. A local path to a `.csl` file also works.

## A note on how this fork was made

This fork was assembled with significant help from an AI coding assistant (Claude). The bug diagnosis, fork comparison, cherry-pick selection, and cache fix were all done in a Claude Code session. The code changes are small and well-understood, but you should know that going in.

## Setup

- Supply a path to your bibliography file in plugin settings. Vault-relative paths (e.g. `references.bib`) are recommended for cross-platform use. Absolute paths also work on desktop.
- Supported formats: **BibTeX/BibLaTeX** (`.bib`), **CSL-JSON** (`.json`), **CSL-YAML** (`.yaml`/`.yml`). Pandoc is no longer required.
- You can also specify a bibliography per-note in YAML frontmatter:

```yaml
---
bibliography: ./references.bib
---
```

You can also pass multiple files:

```yaml
---
bibliography:
  - ./primary.bib
  - ./secondary.bib
---
```

Paths are resolved relative to the note file first, then the vault root.

- (Optional) Supply a path or URL to a compatible [CSL style](https://citationstyles.org/)
- Run **Pandoc Reference List: Show reference list** from the Obsidian command palette to display the References tab in the sidebar

## Install via BRAT

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. In BRAT settings, add this repo: `112345brian/obsidian-pandoc-reference-list`
