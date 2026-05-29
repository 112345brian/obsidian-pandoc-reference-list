## 2.0.29

- Fix: stale or bad CSL style files cached on disk (e.g. a previously downloaded 404 response) are now detected and re-downloaded — prevents "cannot find citation" errors after CSL style URLs change (upstream issue #155)
- Fix: `setViewContent is not a function` console errors on startup — the sidebar view getter now uses an `instanceof` guard instead of a bare TypeScript cast, so a leaf that isn't fully initialized yet is safely skipped (upstream issue #127)

## 2.0.28

- Fix: "Use native Zotero API" toggle label was invisible — translation strings added by the wjvg-gif cherry-pick were missing from the English locale, causing `t()` to return `undefined` and the label to render empty

## 2.0.27

- Fix: `el.doc` / `el.win` DOM API calls replaced with safe fallbacks (`ownerDocument`, `defaultView`) — prevents crashes in contexts where those Obsidian-specific properties are unavailable
- Fix: wikilinks with aliases (`[[link|alias]]`) were being incorrectly parsed as citations due to the `|` character; they are now correctly skipped

## 2.0.26

- Support file-relative and multiple bibliography files in YAML frontmatter
- Auto-update frontmatter bibliography paths when `.bib` files are renamed
- Native Zotero 7/8 API mode (no Better BibTeX required) — opt-in in settings
- Fix stale Zotero cache: items added to Zotero were permanently missed after the initial cache load because `lastUpdate` was incorrectly advanced when reading from the local cache file instead of fetching fresh from Zotero
