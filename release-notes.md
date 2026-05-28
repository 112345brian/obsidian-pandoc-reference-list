## 2.0.27

- Fix: `el.doc` / `el.win` DOM API calls replaced with safe fallbacks (`ownerDocument`, `defaultView`) — prevents crashes in contexts where those Obsidian-specific properties are unavailable
- Fix: wikilinks with aliases (`[[link|alias]]`) were being incorrectly parsed as citations due to the `|` character; they are now correctly skipped

## 2.0.26

- Support file-relative and multiple bibliography files in YAML frontmatter
- Auto-update frontmatter bibliography paths when `.bib` files are renamed
- Native Zotero 7/8 API mode (no Better BibTeX required) — opt-in in settings
- Fix stale Zotero cache: items added to Zotero were permanently missed after the initial cache load because `lastUpdate` was incorrectly advanced when reading from the local cache file instead of fetching fresh from Zotero
