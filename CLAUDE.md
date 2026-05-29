# CLAUDE.md

## Commands
- Build: `npm run build` (production minified) / `npm run dev` (watch mode)
- Test: `npm test` (Jest + jsdom — Zotero tests require a live Zotero instance)
- Lint/Format: `npm run lint` / `npm run prettier` / `npm run clean` (both)
- Dev install: copy `main.js`, `manifest.json`, `styles.css` into vault's `.obsidian/plugins/bripey-citation-suite/`

## Stack
- TypeScript 5.x — esbuild compiles, `tsc --noemit` type-checks
- Obsidian plugin — desktop + mobile, min Obsidian 0.15.0
- Preact aliased as React (`react` / `react-dom` → `@preact/compat`)
- `citeproc` 2.4.x — CSL rendering engine, not replaceable
- `@retorquere/bibtex-parser` — pure-JS BibTeX/BibLaTeX parser (default; Pandoc opt-in)
- `fuse.js` — fuzzy search for citekey autocomplete
- No Node.js modules at runtime — all I/O uses `vault.adapter`, `FileSystemAdapter.readLocalFile`, `requestUrl`
- Pandoc (optional, desktop-only) uses synchronous `require('child_process')` — NOT dynamic `import()`, which esbuild 0.13.x leaves verbatim in CJS output and breaks in Electron's renderer

## Architecture
- `src/bib/` — bibliography loading, Zotero sync, CSL rendering; no UI imports
- `src/parser/` — pure citation syntax parser; no Obsidian or bib deps; `getCitationSegments` is the entry point
- `src/editorExtension.ts` — CodeMirror 6 decorations and live-preview widgets
- `src/markdownPostprocessor.ts` — reading-mode post-processor
- `src/view.ts` — sidebar reference panel (ItemView)
- `src/tooltip.ts` — hover tooltip + mobile long-press gesture + mobile bottom-sheet card
- `src/settings.tsx` — settings tab (Preact); `FolderSuggest` and `BibFileSuggest` in `src/settings/`
- `src/main.ts` — plugin lifecycle, commands, event wiring

**Boundaries:**
- `parser/` must not import from `bib/`, `editorExtension`, or `view`
- `bib/` must not import from `editorExtension` or `view` (only `src/helpers.ts` and `src/parser/`)
- All bibliography access from UI goes through `BibManager` — never call Zotero helpers from `main.ts` or `view.ts`
- CSL engine is stateful: render only through `BibManager.getReferenceList()`; never instantiate `citeproc` elsewhere

## Mobile
- Use `touchstart`/`touchmove`/`touchend`/`touchcancel` for gesture detection — NOT pointer events. Touch events fire `touchcancel` when the browser takes over (scroll, pinch), which pointer events don't reliably surface in WebView.
- Long-press in the editor: timer starts on `touchstart`, cancelled by `touchmove` (> 10 px slop), `touchend`, or `touchcancel`. If cursor is already inside the target span (`document.getSelection()` check), skip — let native selection handle it.
- Reading mode: synthesized `click` from tap is sufficient; no long-press needed.
- `Platform.isMobile` guards all mobile-specific paths. `Platform.isDesktop` for file-picker and Pandoc.
- `getRightLeaf(false)` returns `null` on mobile — always null-guard it.

## Decisions
- [2024] Preact over React — identical API, ~3 KB vs ~40 KB, Obsidian's bundler is tree-shake-unfriendly
- [2024] Native Zotero REST API — no Better BibTeX required for Zotero 7/8; BBT retained for Zotero 6
- [2025-05-29] `lru-cache` removed — hand-rolled 10-slot Map LRU covers the use case
- [2025-05-29] `execa` removed — synchronous `require('child_process')` with `declare const require` covers the single Pandoc call
- [2025-05-29] `download` removed — `requestUrl` covers both HTTP GETs
- [2025-05-29] `react-select` removed — minimal `SearchSelect` Preact component replaces it (~70 KB saved)
- [2025-05-29] Pandoc made optional — `@retorquere/bibtex-parser` is the default; Pandoc accepted as opt-in
- [2025-05-29] Multi-source merge — `.bib` + Zotero load simultaneously; Zotero wins on conflict; cross-group duplicates resolved by `dateModified`

## TODO
- [ ] Semicolons in citation suffixes still sometimes mis-parse when the suffix itself contains `@` (edge case of the lookahead fix)
- [ ] Table cell citekey autocomplete corrupts text — `EditorSuggest` API reports wrong cursor position inside table cells; unfixable without upstream Obsidian change
- [ ] `moduleResolution: "node"` is deprecated in TS 5.x; safe to keep, could migrate to `"bundler"`

## Tests
- `src/parser/tests/parser.test.ts` — 60 tests: citation segments, wikilink aliases, semicolon-in-suffix
- `src/bib/tests/bibManager.test.ts` — `SimpleLRU`, `zoteroItemToCSL`, `bibToCSL`, `getCSLLocale`, `getCSLStyle`
- Zotero live-instance tests (`getZUserGroups`, `isZoteroRunning`) are skipped in CI
- Not covered: BibTeX field mapping (worth adding), CSL render pipeline, native API sync, settings persistence

## Docs
User-facing documentation lives in `docs/`. Keep it accurate when changing behaviour:
- `docs/setup.md` — installation, bibliography formats, frontmatter keys
- `docs/zotero.md` — Zotero integration (native API, BBT, groups, conflict resolution)
- `docs/mobile.md` — mobile-specific behaviour (tap/long-press, file picker, limitations)
