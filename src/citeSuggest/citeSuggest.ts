import Fuse from 'fuse.js';
import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  Platform,
} from 'obsidian';
import { searchZoteroNative, DEFAULT_ZOTERO_PORT } from 'src/bib/helpers';
import { PartialCSLEntry } from 'src/bib/types';
import ReferenceList from 'src/main';
import { isZotLitSuggestActive } from 'src/zotlit';
export { isZotLitSuggestActive }; // re-exported for settings.tsx

// Set to true to enable verbose autocomplete logging.
const SUGGEST_DEBUG = false;
const LOG = SUGGEST_DEBUG
  ? (...args: any[]) => console.log('[bcs:suggest]', ...args)
  : (..._args: any[]) => {};

// Returns a compact metadata string for a CSL entry: "Smith · 2020 · Nature"
function getEntryMeta(item: PartialCSLEntry): string {
  const e = item as any;
  const parts: string[] = [];

  const first = e.author?.[0];
  if (first) parts.push(first.family ?? first.literal ?? '');

  const year = e.issued?.['date-parts']?.[0]?.[0];
  if (year) parts.push(String(year));

  const container = e['container-title'];
  if (container && String(container).length < 50) parts.push(String(container));

  return parts.filter(Boolean).join(' · ');
}

// Single-@ trigger: matches @citekey (no spaces, no @@ prefix)
const triggerRE = /(^|[^\p{L}\p{N}@])(@)([\p{L}\p{N}:.#$%&\-+?<>~_/]+)$/u;

// Double-@ trigger: @@ followed by any text (spaces allowed) up to a period.
// A period ends the trigger so normal sentence punctuation closes the popup.
const doubleAtRE = /(^|[^\p{L}\p{N}@])(@@)([^.]*)$/u;

// Sentinel prepended to the query when @@ mode is active. Encoding the mode
// in the query string means it travels with the EditorSuggestContext and is
// still correct when getSuggestions resolves asynchronously — no class-level
// flag that a later onTrigger call could clobber mid-flight.
const DOUBLE_AT_PREFIX = '\x00';

export class CiteSuggest extends EditorSuggest<Fuse.FuseResult<PartialCSLEntry>> {
  private plugin: ReferenceList;
  private app: App;

  limit = 20;

  constructor(app: App, plugin: ReferenceList) {
    super(app);

    this.app = app;
    this.plugin = plugin;

    (this as any).suggestEl.addClass('bcs-suggest');
    (this as any).scope.register(['Mod'], 'Enter', (evt: KeyboardEvent) => {
      (this as any).suggestions.useSelectedItem(evt);
      return false;
    });

    this.setInstructions([
      {
        command: Platform.isMacOS ? '⌘ ↵' : 'ctrl ↵',
        purpose: 'Wrap cite key with brackets',
      },
    ]);
  }

  async getSuggestions(
    context: EditorSuggestContext
  ): Promise<Fuse.FuseResult<PartialCSLEntry>[]> {
    const isDoubleAtMode = context.query.startsWith(DOUBLE_AT_PREFIX);
    const searchQuery = isDoubleAtMode
      ? context.query.slice(DOUBLE_AT_PREFIX.length).trim()
      : context.query.trim();

    LOG('getSuggestions query=', JSON.stringify(searchQuery), 'doubleAt=', isDoubleAtMode);

    if (!isDoubleAtMode && (!searchQuery || searchQuery.includes(' '))) {
      return [];
    }

    const { plugin } = this;
    if (!plugin.bibManager.initPromise.settled) {
      LOG('getSuggestions: bib not loaded yet');
      return [];
    }

    const { bibManager } = plugin;

    // ── @@ mode: ZotLit-first full-text search ─────────────────────────────
    // Always uses the global index — per-file bibliography overrides are
    // intentionally ignored here since @@ is a full-library search.
    if (isDoubleAtMode) {
      // 1. ZotLit's SQLite database — same engine powering ZotLit's own suggester.
      const zotlitPlugin = (plugin.app as any).plugins?.plugins?.['zotlit'];
      if (zotlitPlugin?.database) {
        try {
          const raw: any[] = searchQuery
            ? await zotlitPlugin.database.search(searchQuery)
            : await zotlitPlugin.database.getItemsOf(this.limit);
          if (raw?.length) {
            LOG('@@ ZotLit returned', raw.length, 'items');
            const results = raw
              .map((r: any, refIndex: number) => {
                const titleRaw = r.item?.title;
                const title: string | undefined = Array.isArray(titleRaw)
                  ? titleRaw[0]
                  : typeof titleRaw === 'string' ? titleRaw : undefined;
                const id: string = r.item?.citekey ?? r.item?.citationKey ?? '';
                if (!id) return null;
                const entry: PartialCSLEntry = { id, title };
                const creators = r.item?.creators;
                if (Array.isArray(creators) && creators.length > 0) {
                  entry.author = creators.map((c: any) => ({
                    family: c.lastName ?? c.name ?? '',
                    given: c.firstName ?? '',
                  }));
                }
                return { item: entry, refIndex, score: 0.5 };
              })
              .filter(Boolean) as Fuse.FuseResult<PartialCSLEntry>[];
            if (results.length) return results;
          }
        } catch (e) {
          LOG('@@ ZotLit database search failed:', e);
        }
      }

      // 2. Fall back to bripey's title-biased Fuse index.
      const fuse = bibManager.fuseTitle ?? bibManager.fuse;
      LOG('@@ fuse fallback, docs=', (fuse as any)?._docs?.length ?? 0);
      if (!searchQuery) {
        const docs = (fuse as any)?._docs as PartialCSLEntry[] | undefined;
        return docs?.length
          ? docs.slice(0, this.limit).map((item, refIndex) => ({ item, refIndex, score: 0 }))
          : [];
      }
      return fuse?.search(searchQuery, { limit: this.limit }) ?? [];
    }

    // ── single-@ mode: citekey-biased Fuse + live Zotero fallback ───────────
    // Use per-file Fuse index when the note has a frontmatter bibliography,
    // falling back to global if the per-file one is null (race on startup).
    let fuse = bibManager.fuse;
    if (bibManager.fileCache.has(context.file)) {
      fuse = bibManager.fileCache.get(context.file).source.fuse ?? bibManager.fuse;
    }

    LOG('single-@ fuse docs=', (fuse as any)?._docs?.length ?? 0);
    const fuseResults = fuse?.search(searchQuery, { limit: this.limit });
    if (fuseResults?.length) return fuseResults;

    // Fuse returned nothing — fall back to a live Zotero query.
    const { settings } = plugin;
    if (settings.pullFromZotero && searchQuery.length >= 2) {
      const port = settings.zoteroPort ?? DEFAULT_ZOTERO_PORT;
      const groupIds = settings.zoteroGroups?.map((g) => g.id) ?? [];
      LOG('falling back to live Zotero search');
      try {
        const items = await searchZoteroNative(port, searchQuery, groupIds, this.limit);
        LOG('live Zotero returned', items.length, 'items');
        return items.map((item, refIndex) => ({ item, refIndex, score: 0.5 }));
      } catch (e) {
        LOG('live Zotero search threw:', e);
      }
    }

    return [];
  }

  renderSuggestion(
    suggestion: Fuse.FuseResult<PartialCSLEntry>,
    el: HTMLElement
  ): void {
    const frag = createFragment();
    const item = suggestion.item;

    if (!suggestion.matches || !suggestion.matches.length) {
      frag.createSpan({ text: `@${item.id}` });
      if (item.title)
        frag.createSpan({ text: item.title, cls: 'bcs-suggest-title' });
      const meta = getEntryMeta(item);
      if (meta) frag.createSpan({ text: meta, cls: 'bcs-suggest-meta' });
      return el.setText(frag);
    }

    const citekey = frag.createSpan({ text: '@' });
    const title = frag.createSpan('bcs-suggest-title');

    let prevTitleIndex = 0;
    let prevCiteIndex = 0;

    suggestion.matches.forEach((m) => {
      if (m.key !== 'id' && m.key !== 'title') return;
      m.indices.forEach((indices) => {
        const start = indices[0];
        const stop = indices[1] + 1;

        const target = m.key === 'title' ? title : citekey;
        const prev = m.key === 'title' ? prevTitleIndex : prevCiteIndex;

        target.appendText(m.value.substring(prev, start));
        target.append(createEl('strong', { text: m.value.substring(start, stop) }));

        if (m.key === 'title') prevTitleIndex = stop;
        else prevCiteIndex = stop;
      });
    });

    if (item.title) title.appendText(item.title.substring(prevTitleIndex));
    citekey.appendText(item.id.substring(prevCiteIndex));

    const meta = getEntryMeta(item);
    if (meta) frag.createSpan({ text: meta, cls: 'bcs-suggest-meta' });

    el.setText(frag);
  }

  private lastSelect: EditorPosition = null;

  selectSuggestion(
    suggestion: Fuse.FuseResult<PartialCSLEntry>,
    event: KeyboardEvent | MouseEvent
  ): void {
    const { context } = this;
    if (!context) return;

    const replaceStr = (event.metaKey || event.ctrlKey)
      ? `[@${suggestion.item.id}]`
      : `@${suggestion.item.id}`;

    context.editor.replaceRange(replaceStr, context.start, context.end);

    this.lastSelect = { ch: context.start.ch + replaceStr.length, line: context.start.line };
    this.close();
  }

  private isRefreshing = false;

  async refreshZBib() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    await this.plugin.bibManager.refreshGlobalZBib();
    this.isRefreshing = false;
  }

  onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo {
    const { enableCiteKeyCompletion, pullFromZotero } = this.plugin.settings;

    if (enableCiteKeyCompletion === false) return null;

    const { lastSelect } = this;
    if (lastSelect && cursor.ch === lastSelect.ch && cursor.line === lastSelect.line) {
      return null; // suppress re-trigger right after a selection
    }

    const line = (editor.getLine(cursor.line) || '').substring(0, cursor.ch);

    // Check @@ before single-@ so it wins. Mode is encoded in the query string
    // (DOUBLE_AT_PREFIX) so it travels with the context and stays correct when
    // getSuggestions resolves after a subsequent onTrigger has already fired.
    const doubleMatch = line.match(doubleAtRE);
    if (doubleMatch) {
      LOG('onTrigger: @@ matched, query=', JSON.stringify(doubleMatch[3]));
      this.lastSelect = null;
      // Skip bripey's Zotero refresh in @@ mode when ZotLit is present —
      // ZotLit maintains its own data sync; refreshing bripey's bib is redundant.
      const zotlitDb = (this.plugin.app as any).plugins?.plugins?.['zotlit']?.database;
      if (!this.context && pullFromZotero && !zotlitDb) this.refreshZBib();
      return {
        start: { line: cursor.line, ch: doubleMatch.index + doubleMatch[1].length },
        end: cursor,
        query: DOUBLE_AT_PREFIX + doubleMatch[3],
      };
    }

    const match = line.match(triggerRE);
    if (!match) return null;

    LOG('onTrigger: single-@ matched, query=', match[3]);
    this.lastSelect = null;
    if (!this.context && pullFromZotero) this.refreshZBib();

    return {
      start: { line: cursor.line, ch: match.index + match[1].length },
      end: cursor,
      query: match[3],
    };
  }
}
