# Setup

## Install

Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install BRAT from the Obsidian community plugin list
2. In BRAT settings → "Add Beta Plugin", enter: `112345brian/bripey-citation-suite`
3. Enable the plugin in Obsidian settings

## Bibliography file

In **Settings → Bripey Citation Suite**, set the path to your bibliography file.

**Supported formats:**
- `.bib` — BibTeX / BibLaTeX
- `.json` — CSL-JSON
- `.yaml` / `.yml` — CSL-YAML

**Path formats:**
- **Vault-relative** (recommended, works everywhere): `references.bib`, `assets/refs.bib`
- **Absolute** (desktop only): `/Users/you/references.bib`

If you enter an absolute path that lives inside the vault, it is automatically shortened to vault-relative when you leave the field.

You can also type in the field to autocomplete vault files, or use the Browse button (OS file picker on desktop; vault search modal on mobile).

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

## Showing the reference sidebar

Run **Bripey Citation Suite: Show reference list** from the command palette (`Cmd/Ctrl+P`). The sidebar updates automatically as you edit.
