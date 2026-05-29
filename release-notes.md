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
