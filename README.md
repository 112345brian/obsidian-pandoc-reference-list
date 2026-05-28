# Obsidian Pandoc Reference List (community fork)

Displays a formatted reference in the sidebar for each pandoc citekey present in the current document.

<img src="https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png" alt="A screenshot of the plugin's works cited list">

## What this fork adds

This fork combines improvements from several community forks and adds a bug fix not present in any of them:

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

### Cache staleness bug fix

The original plugin uses an incremental sync strategy: on startup it loads the local cache, then queries Zotero for items modified since `lastUpdate`. The bug was that `lastUpdate` was being advanced to `Date.now()` even when loading from the local cache file — not when actually fetching from Zotero. This caused the subsequent incremental refresh to query for items modified *after right now*, which is always empty, permanently freezing the cache. Any item added to Zotero but not yet in the cache file would never be picked up short of manually deleting the cache.

The fix: `lastUpdate` now only advances when a fresh fetch from Zotero completes successfully.

## Credits

Original plugin by [mgmeyers](https://github.com/mgmeyers/obsidian-pandoc-reference-list), maintained by [obsidian-community](https://github.com/obsidian-community/obsidian-pandoc-reference-list). All the real work is theirs.

Forks cherry-picked from:
- [astroHaoPeng/alp-obsidian-pandoc-reference-list](https://github.com/astroHaoPeng/alp-obsidian-pandoc-reference-list)
- [wjvg-gif/obsidian-pandoc-reference-list-zotero8](https://github.com/wjvg-gif/obsidian-pandoc-reference-list-zotero8)
- [sjelms/obsidian-pandoc-inline-citations](https://github.com/sjelms/obsidian-pandoc-inline-citations)

## A note on how this fork was made

This fork was assembled with significant help from an AI coding assistant (Claude). The bug diagnosis, fork comparison, cherry-pick selection, and cache fix were all done in a Claude Code session. The code changes are small and well-understood, but you should know that going in.

## Setup

- Ensure [Pandoc](https://pandoc.org/) is installed. **This plugin requires at least version 2.11.**
- Supply a path to a compatible bibliography file in plugin settings, or specify one per-note in YAML frontmatter:

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
