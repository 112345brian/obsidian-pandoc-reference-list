## 2.0.34

- **BibTeX crash fix:** entries with no author/editor (e.g. `@online`, `@misc` without a `creators` field) no longer crash the bibliography loader — they load correctly with no author.
- **Pandoc auto-detect fix:** the "Auto-detect" button now finds Pandoc installed via Homebrew on macOS (Apple Silicon `/opt/homebrew/bin` and Intel `/usr/local/bin`) even though Electron doesn't inherit the shell PATH.

## 2.0.33

- **Citation decoration system:** resolved citekeys are now colored in your theme's accent color; `[[@wikilink]]` citations use the link color with a solid underline to distinguish them from plain `[@citations]`. Brackets and punctuation dim to `--text-muted` so the citekey stands out.
- **New "Citation decoration" setting:** toggle decorations independently of tooltips, with an in-settings live preview showing all three citation states (resolved, wikilink, unresolved). Colors and underline styles are fully customizable via the Style Settings plugin.
- **Style Settings entries added:** link citation color, link citation underline color, and separate underline-style selects (dotted/dashed/solid/none) for regular vs. link citations.
- **Settings crash fix:** opening the settings tab no longer crashes when Zotero's Better BibTeX endpoint is unavailable — the Zotero panel now gracefully shows "Cannot connect" instead of storing `null` into component state and throwing on `.find`/`.map`.
