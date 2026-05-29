## 2.0.31

- Mobile load fix: Electron clipboard access is now desktop-only, with mobile falling back to the web clipboard API.
- Mobile-compatible runtime path: `.bib` parsing defaults to the built-in pure-JS parser, normal file/network I/O uses Obsidian APIs, and optional Pandoc support is kept desktop-only.
- Includes the Zotero, ZotLit, citation rendering, sidebar filtering, insert-bibliography command, and dependency cleanup changes from `2.0.30`.
