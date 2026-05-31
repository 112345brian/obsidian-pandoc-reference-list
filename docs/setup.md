# Setup

## Install

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install BRAT from the Obsidian community plugin list
2. In BRAT settings → "Add Beta Plugin", enter: `112345brian/bripey-citation-suite`
3. Enable the plugin in Obsidian settings

## Bibliography files

In **Settings → Bripey Citation Suite → Bibliography files**, add one or more bibliography files. Use the **Add file** button to add entries; each has a browse button and a trash icon to remove it.

**Supported formats:**
- `.bib` — BibTeX / BibLaTeX
- `.json` — CSL-JSON
- `.yaml` / `.yml` — CSL-YAML

**Path formats:**
- **Vault-relative** (recommended, works everywhere): `references.bib`, `assets/refs.bib`
- **Absolute** (desktop only): `/Users/you/references.bib`

If you enter an absolute path that lives inside the vault, it is automatically shortened to vault-relative when you leave the field. All configured files are merged into one library; Zotero wins on conflict between any source.

Parsed `.bib` files are cached in `.pandoc/bib-parsed.json` and only re-parsed when the source file changes, so startup stays fast even with large bibliographies.

## Citation style

Set a CSL style in **Settings → Citation style**. You can:
- Pick from the built-in list (downloaded automatically and cached in `.pandoc/` in your vault)
- Enter a path to a local `.csl` file (vault-relative or absolute)

## Per-note overrides

Any setting can be overridden in a note's YAML frontmatter:

```yaml
---
bibliography: ./references.bib        # path relative to this note, or vault-relative
csl: ./chicago-author-date.csl        # local path or URL
lang: fr-FR                           # citation language
---
```

Multiple bibliography files:

```yaml
---
bibliography:
  - ./primary.bib
  - ./secondary.bib
---
```

Paths resolve relative to the note file first, then fall back to vault root.

## Pandoc (optional)

Pandoc is not required. The built-in pure-JS parser handles `.bib`, `.json`, and `.yaml` files on all platforms including mobile.

If you have Pandoc installed and prefer it for edge cases, set its path in **Settings → Path to Pandoc**. The plugin will auto-detect common install locations (Homebrew, winget, Scoop, Chocolatey) if you leave the field blank and click Auto-detect.

## Citekey autocomplete

Typing `@` in a note opens a fuzzy autocomplete popup biased toward citekeys. Typing `@@` opens a full-text search biased toward titles and authors (spaces allowed; a period closes the popup). When ZotLit is installed, `@@` searches via ZotLit's database directly.

`⌘↵` (or `ctrl↵`) wraps the selected key in brackets: `[@citekey]`. It detects bracket context automatically — if you're already inside `[@...]`, it appends without double-wrapping.

Searches are diacritic-insensitive: "Muller" matches "Müller".

## Bibliography snapshot

The **Save bibliography snapshot** command (also available as a camera icon in the reference panel header) exports all citations in the current note to a `.bib` file. A dialog lets you set the filename; it defaults to `{note-name}-bibliography.bib` in the same folder.

The saved path is added to the note's `bibliography` frontmatter key, which Pandoc and other tools can use directly.

After a snapshot, bripey colour-codes each citekey in the editor:

| Colour | Meaning |
|---|---|
| Blue | In your global library and in the snapshot (synced) |
| Yellow / dashed | In your global library but not yet in the snapshot |
| Red | Not found anywhere |

Run the snapshot command again at any time to update the `.bib` with any new citations.

## Showing the reference sidebar

Run **Bripey Citation Suite: Show reference list** from the command palette (`Cmd/Ctrl+P`). The sidebar updates automatically as you edit.
