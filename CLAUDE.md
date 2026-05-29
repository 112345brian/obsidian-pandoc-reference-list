# CLAUDE.md

## Commands
- Build: `npm run build` (production minified) / `npm run dev` (watch mode)
- Test: `npm test` (Jest + jsdom — requires pandoc at `/opt/homebrew/bin/pandoc` for bib tests)
- Lint/Format: `npm run lint` / `npm run prettier` / `npm run clean` (both)
- Run/Dev: copy `main.js`, `manifest.json`, `styles.css` into your vault's `.obsidian/plugins/obsidian-pandoc-reference-list/` after building

## Stack
- TypeScript 5.x (compiled by esbuild, type-checked by `tsc --noemit`)
- Obsidian desktop plugin — Electron/Node.js, min Obsidian 0.15.0; no mobile support
- Preact aliased as React (`react` and `react-dom` both resolve to `@preact/compat`)
- `citeproc` (2.4.x): CSL citation rendering engine — not replaceable
- `fuse.js`: fuzzy search powering citekey autocomplete
- `shell-path`: resolve user's shell PATH so `which pandoc` works from Electron

## Architecture
- `src/bib/` — bibliography loading, Zotero sync, CSL rendering; no UI imports
- `src/parser/` — pure citation syntax parser; no Obsidian or bib deps; `getCitationSegments` is the entry point
- `src/editorExtension.ts` — CodeMirror 6 decorations and live-preview widgets
- `src/markdownPostprocessor.ts` — reading-mode post-processor
- `src/view.ts` — sidebar reference panel (ItemView)
- `src/tooltip.ts` — hover tooltip manager
- `src/settings.tsx` — plugin settings tab (Preact)
- `src/main.ts` — plugin lifecycle, commands, event wiring

**Boundaries:**
- `parser/` must not import from `bib/`, `editorExtension`, or `view`
- `bib/` must not import from `editorExtension` or `view` (only `src/helpers.ts` and `src/parser/` are allowed)
- All bibliography access from UI code goes through `BibManager` — never call Zotero helpers directly from `main.ts` or `view.ts`
- CSL engine is stateful: always render through `BibManager.getReferenceList()`; never instantiate `citeproc` directly elsewhere

## Decisions
- [2024] Preact over full React — Obsidian's bundler is tree-shake-unfriendly; Preact is identical API at ~3 KB
- [2024] Native Zotero REST API added — allows use without Better BibTeX plugin (Zotero 7/8 only); BBT path retained for Zotero 6 users
- [2025-05-29] `lru-cache` removed — 10-slot max means a hand-rolled Map-based LRU is trivial; eliminated a dep for no functionality loss
- [2025-05-29] `execa` removed — `child_process.execFile` via `util.promisify` covers the single pandoc invocation; `execa` was multi-MB for one call
- [2025-05-29] `download` removed — replaced with `node:http` requests already present in the file for Zotero JSON-RPC; `download` was only used for two HTTP GETs
- [2025-05-29] `react-select` removed — replaced with a minimal `SearchSelect` Preact component; `react-select` was ~70 KB minified for two dropdowns

## TODO
- [ ] Semicolons in citation prefixes/suffixes still sometimes mis-parse if the suffix itself contains `@` (edge case of the lookahead fix)
- [ ] Table cell citekey autocomplete corrupts text — Obsidian `EditorSuggest` API limitation, unfixable without upstream change
- [ ] Zotero adapter refactor: extract `ZoteroAdapter` interface with `BBTAdapter`/`NativeAdapter` to remove `if (useNativeZoteroAPI)` branching in `bibManager.ts`
- [ ] Expand test coverage — `bibManager.test.ts` only covers `bibToCSL`/`getCSLLocale`/`getCSLStyle`; CSL rendering pipeline and Zotero type mapping are untested
- [ ] TypeScript `moduleResolution` — currently `"node"` (deprecated in TS 5.x); safe to keep but could be updated to `"bundler"` for stricter correctness

## Tests
- Run: `npm test`
- Test files: `src/parser/tests/parser.test.ts`, `src/bib/tests/bibManager.test.ts`
- Parser tests cover happy-path citation segment parsing including wikilink aliases and the semicolon-in-suffix fix
- `bibManager` tests cover `bibToCSL`, `getCSLLocale`, `getCSLStyle`; the `getZUserGroups` and `isZoteroRunning` tests require a live Zotero instance and will fail without one
- Not covered: CSL rendering pipeline, citeproc engine construction, Zotero type mapping (48 item types), native API sync, settings persistence
- Known skip: `getZBib` test is commented out (requires live library data)
