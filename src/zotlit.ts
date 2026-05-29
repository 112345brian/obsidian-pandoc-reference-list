/**
 * Helpers for co-existing and integrating with ZotLit (plugin ID "zotlit").
 * All functions degrade gracefully when ZotLit is absent.
 */

import { App, TFile } from 'obsidian';

// ZotLit sets globalThis.zoteroAPI in onload() and deletes it on unload.
// This is the most reliable "is ZotLit fully initialised?" indicator.
export function isZotLitLoaded(): boolean {
  return !!(globalThis as any).zoteroAPI;
}

// Returns true when ZotLit is loaded AND its citation editor suggester is
// enabled (the default). Use this to decide whether to yield the bracketed
// [@key context to ZotLit's suggestion panel.
export function isZotLitSuggestActive(app: App): boolean {
  if (!isZotLitLoaded()) return false;
  const zotlit = (app as any).plugins?.plugins?.['zotlit'];
  if (!zotlit) return false;
  // ZotLit checks this path in its own onTrigger; mirror it exactly.
  const setting = zotlit.settings?.current?.citationEditorSuggester;
  // Default is true — only return false when the user has explicitly disabled it.
  return setting !== false;
}

// Find the literature note for a citekey, preferring ZotLit's frontmatter-based
// index over our filename-guessing approach.
export function getLitNoteForCitekey(
  citekey: string,
  sourcePath: string,
  app: App
): { file: TFile; linkText: string } | null {
  // ZotLit maintains NoteIndex.citekeyCache: Map<citekey, Set<notePath>>
  // derived from each note's frontmatter. Prefer this — it catches notes that
  // use any filename, not just @citekey.md.
  if (isZotLitLoaded()) {
    const zotlit = (app as any).plugins?.plugins?.['zotlit'];
    const cache = zotlit?.noteIndex?.citekeyCache;
    if (cache instanceof Map) {
      const paths: Set<string> | undefined = cache.get(citekey);
      if (paths?.size) {
        const notePath = paths.values().next().value as string;
        const file = app.vault.getAbstractFileByPath(notePath);
        if (file instanceof TFile) return { file, linkText: notePath };
      }
    }
  }

  // Filename fallback: try @citekey then plain citekey.
  for (const linkText of [`@${citekey}`, citekey]) {
    const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
    if (file instanceof TFile) return { file, linkText };
  }

  return null;
}
