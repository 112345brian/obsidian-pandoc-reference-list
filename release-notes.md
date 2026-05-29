## 2.1.0

### Mobile support
- **Tap citations in reading mode** to show a bottom-sheet citation card, copy to clipboard, or open the best available link (Zotero → PDF → URL/DOI) — configurable in Settings → Tooltip → "Mobile tap action".
- **Editor mode: tap to edit, long-press to show citation.** A quick tap places the cursor normally. Holding for ~500 ms shows the citation action. If the cursor is already inside the citekey, holding triggers native word selection instead.
- **Reference panel now opens automatically on Android** — null-guarded `getRightLeaf` and `onLayoutReady` hook restore the sidebar on mobile where workspace state isn't always persisted.
- **Larger sidebar text** — reference list entries use `--font-ui-medium` (matches the outline sidebar) instead of a fixed 14 px.

### Bibliography & parser
- **Pure-JS BibTeX parser** — `@retorquere/bibtex-parser` replaces Pandoc as the default. Pandoc is still accepted as an opt-in for edge cases.
- **BibTeX parser: recovery passes** — if a field is missing, the parser tries to recover: year from citekey (`smith_2020_title` → 2020), title from humanised citekey, DOI prefix stripping.
- **Fix: all .bib authors missing on mobile** — `@retorquere/bibtex-parser` v9 moved author arrays to `entry.fields.author`; the parser now reads from there with a fallback for older layouts.
- **Multi-source merge** — `.bib` file and Zotero load simultaneously; Zotero wins on conflicts.

### Settings & file picking
- **Bibliography file picker** — type a path with autocomplete (`.bib/.json/.yaml/.yml` files from vault), or tap Browse. On desktop, Browse opens the OS file picker; on mobile it opens a vault fuzzy-search modal.
- **Literature notes folder autocomplete** — folder suggestions appear as you type.
- **Relative ↔ absolute path resolution** — vault-relative paths work on all platforms. If you enter an absolute path inside the vault it is normalised to vault-relative on blur. Absolute fallback is tried automatically if the vault has moved.
- **Windows Pandoc detection** — detects winget (`%LOCALAPPDATA%\Pandoc`), Scoop, and Chocolatey install locations in addition to the existing macOS/Linux paths.

### Editor & UI
- **Citation decoration** — resolved citekeys highlighted in accent color; `[[@wikilink]]` citations use link color with solid underline; brackets dim to `--text-muted`.
- **Citekey autocomplete: trigger after 1 character** — suggestions appear after typing just one character past `@` (was 2). Trigger now fires after any non-word character before `@`, not just a narrow whitelist.
- **Reference list word wrap** — long titles and URLs now wrap correctly at the panel edge.
- **Tooltip action icons horizontal** — copy/Zotero/PDF buttons appear in a row beneath the citation instead of vertically beside it.

### Fixes
- **`child_process` module crash fixed** — Pandoc detection no longer throws in Electron's renderer; uses `require()` instead of dynamic `import()`.
- **"undefined" in bib path description on mobile** fixed.
- **Zotero settings crash** — opening settings no longer crashes when Zotero is unreachable.

## 2.0.45

- **Mobile editor: hold-to-select works correctly when cursor is already on a citekey.** In 2.0.44, long-pressing a citation span always showed the citation card — even if your cursor was already placed inside it, where the expected behavior is native word selection. Now, if the editor cursor is already inside the span when you start the hold, the long-press timer is skipped and the OS handles selection normally. Long-pressing a citation span where the cursor is *not* yet placed still shows the citation card after ~500 ms.

## 2.0.44

- **Mobile editor: tap to edit, long-press to show citation.** Previously, tapping a rendered citation in live-preview mode would immediately show the citation card (or copy/link, depending on your setting), making it impossible to tap to place the cursor for editing. Now, a quick tap in the editor behaves normally — the cursor moves to where you tapped. Holding for ~500 ms triggers the configured tap action (show card, copy, or open link). Scrolling or moving your finger during the hold cancels it cleanly without triggering the action.
- **Reading mode tap action unchanged** — tapping a citation in reading view still immediately shows the citation card (or copy/link), since there's no cursor to place there.

## 2.0.43

- **Citekey autocomplete: suggestions now appear after the first character.** Previously the suggestion panel only appeared after typing two characters past `@` — so `[@s` showed nothing and `[@sm` was the earliest trigger. Now suggestions appear as soon as you've typed one character (`[@s`).
- **Citekey autocomplete: trigger fires after more preceding characters.** The `@` trigger now fires after any non-word character (space, `(`, `.`, `,`, `;`, `[`, `-`, etc.) instead of a narrow whitelist. This means `(@key`, `.@key`, `, @key`, and similar inline non-parenthetical forms all open the suggestion panel correctly. Bare word characters before `@` (e.g. email addresses like `user@domain.com`) still don't trigger, which is the correct behavior.

## 2.0.42

- **BibTeX parser: recovery passes.** After normal field extraction, three cleanup passes now run on every entry:
  - **Year from citekey** — if no `date`/`year` field is present, a 4-digit year is extracted from the citekey (Zotero's `smith_2020_title` format makes this reliable).
  - **Title fallback** — if no title field is found, the citekey is humanised (hyphens/underscores → spaces) and used as the title so the entry is at least identifiable.
  - **DOI normalization** — `https://doi.org/10.xxx` prefixes are stripped to bare DOIs, fixing link generation in some CSL styles.
- **Mobile: tap-to-action for citations.** On mobile, hover tooltips don't exist. A new "Mobile tap action" setting (under Tooltip settings) controls what happens when you tap a citation:
  - **Show citation info** (default) — opens a bottom-sheet card with the full formatted reference, action buttons, and an × close button. Tapping outside the card also dismisses it.
  - **Copy citation to clipboard** — copies the formatted reference as rich text + markdown.
  - **Open link** — follows the best available link in order: Zotero select → PDF file → URL/DOI. Falls back to showing the card if nothing is available.
- **Larger sidebar text.** Reference list entries now use `--font-ui-medium` (matches Obsidian's outline sidebar size) instead of the fixed 14 px. Overridable via Style Settings as before.

## 2.0.41

- **Critical fix: all .bib authors missing on mobile (and desktop without Zotero).** `@retorquere/bibtex-parser` v9 changed its output format: author/editor/translator arrays now live in `entry.fields.author` etc. as `{firstName, lastName}` objects — there is no longer an `entry.creators` property. The parser was always returning `entry.creators = undefined`, so every entry loaded from a `.bib` file had no author, rendering as "T (2014)" (title initial) instead of "Goldsmith and Crawford (2014)". On desktop this was hidden because Zotero provided the correct data. The fix reads creator roles from `entry.fields[role]` and falls back to `entry.creators[role]` for forwards/backwards compatibility with both parser layouts.

## 2.0.40

- **Browse button now works on mobile:** on Android/iOS the OS file picker can't return a stable file-system path (it gives a content URI or sandboxed temp path). Instead, tapping Browse opens a fuzzy-search vault file picker modal — the same files as the autocomplete, but in a full modal for easier browsing on a touch screen. Desktop keeps the native OS file picker.

## 2.0.39

- **Bibliography file picker:** the path-to-bibliography field now has two ways to select a file without typing:
  - **Autocomplete (all platforms):** typing in the field shows a filtered dropdown of `.bib`, `.json`, `.yaml`, and `.yml` files from your vault.
  - **Browse button (desktop):** a folder-open icon button opens your OS file picker (Finder, Explorer, etc.). Selecting a file fills in the path and auto-normalises it to vault-relative if the file lives inside the vault.

## 2.0.38

- **Fix: "undefined" in bibliography path description** — the settings tab was calling `t()` with a string not present in the locale file, causing the description to render as the literal word "undefined". The key is now registered in `en.ts` and the description is updated to clarify that vault-relative paths work on all platforms while absolute paths are desktop-only.
- **Fix: reference panel missing on Android** — `getRightLeaf(false)` can return `null` on mobile (workspace not fully ready); calling `.setViewState()` on null crashed silently and the panel never appeared. Added a null guard. Also added `onLayoutReady` so the panel is automatically opened on startup if it isn't already present — this restores it on mobile where workspace state isn't always persisted between sessions.

## 2.0.37

- **Reference list word wrap fix:** long titles, author names, and URLs now wrap correctly at the panel edge instead of overflowing. The fix adds `flex: 1; min-width: 0` to the citation entry element — both are required for text wrapping inside a flex container.
- **Tooltip action icons now horizontal and below:** in the hover tooltip, the conflict/note/Zotero/PDF buttons now appear in a horizontal row beneath the citation text rather than in a vertical column beside it.

## 2.0.36

- **Hotfix: `child_process` module crash** — Pandoc detection and invocation no longer throws `Failed to resolve module specifier 'child_process'`. esbuild 0.13.x leaves dynamic `import()` of external modules verbatim in the CJS bundle, which Electron's renderer can't resolve as an ES module. Replaced with synchronous `require()` calls, which work correctly in Electron's Node integration.

## 2.0.35

- **Literature notes folder autocomplete:** typing in the literature notes folder field now shows a dropdown of existing vault folders.
- **Bibliography path: relative ↔ absolute resolution:** the plugin now tries both path forms when loading your `.bib` file — if you enter an absolute path that lives inside the vault, it is automatically normalised to the portable vault-relative form on blur. If the vault has moved since the path was saved, the absolute fallback (vault root + relative path) is tried automatically and the setting is updated to the form that actually works.
- **Windows Pandoc detection:** added detection for winget (`%LOCALAPPDATA%\Pandoc`), Scoop (`%USERPROFILE%\scoop\apps\pandoc\current`), and Chocolatey (`%ProgramData%\chocolatey\bin`) install locations.

## 2.0.34

- **BibTeX crash fix:** entries with no author/editor (e.g. `@online`, `@misc` without a `creators` field) no longer crash the bibliography loader — they load correctly with no author.
- **Pandoc auto-detect fix:** the "Auto-detect" button now finds Pandoc installed via Homebrew on macOS (Apple Silicon `/opt/homebrew/bin` and Intel `/usr/local/bin`) even though Electron doesn't inherit the shell PATH.

## 2.0.33

- **Citation decoration system:** resolved citekeys are now colored in your theme's accent color; `[[@wikilink]]` citations use the link color with a solid underline to distinguish them from plain `[@citations]`. Brackets and punctuation dim to `--text-muted` so the citekey stands out.
- **New "Citation decoration" setting:** toggle decorations independently of tooltips, with an in-settings live preview showing all three citation states (resolved, wikilink, unresolved). Colors and underline styles are fully customizable via the Style Settings plugin.
- **Style Settings entries added:** link citation color, link citation underline color, and separate underline-style selects (dotted/dashed/solid/none) for regular vs. link citations.
- **Settings crash fix:** opening the settings tab no longer crashes when Zotero's Better BibTeX endpoint is unavailable — the Zotero panel now gracefully shows "Cannot connect" instead of storing `null` into component state and throwing on `.find`/`.map`.
