import Fuse from 'fuse.js';
import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView,
  Platform,
} from 'obsidian';
import { searchZoteroNative } from 'src/bib/helpers';
import { DEFAULT_ZOTERO_PORT } from 'src/bib/helpers';
import { PartialCSLEntry } from 'src/bib/types';
import ReferenceList from 'src/main';
import { isZotLitSuggestActive } from 'src/zotlit';
export { isZotLitSuggestActive }; // re-exported for settings.tsx

const LOG = (...args: any[]) => console.log('[bcs:suggest]', ...args);

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

const triggerRE = /(^|[^\p{L}\p{N}@])(@)([\p{L}\p{N}:.#$%&\-+?<>~_/]+)$/u;

export class CiteSuggest extends EditorSuggest<Fuse.FuseResult<PartialCSLEntry>> {
  private plugin: ReferenceList;
  private app: App;

  limit: number = 20;

  constructor(app: App, plugin: ReferenceList) {
    super(app);

    this.app = app;
    this.plugin = plugin;

    LOG('CiteSuggest constructed');

    (this as any).suggestEl.addClass('bcs-suggest');
    (this as any).scope.register(['Mod'], 'Enter', (evt: KeyboardEvent) => {
      (this as any).suggestions.useSelectedItem(evt);
      return false;
    });

    (this as any).scope.register(['Alt'], 'Enter', (evt: KeyboardEvent) => {
      (this as any).suggestions.useSelectedItem(evt);
      return false;
    });

    this.setInstructions([
      {
        command: Platform.isMacOS ? '⌘ ↵' : 'ctrl ↵',
        purpose: 'Wrap cite key with brackets',
      },
      {
        command: Platform.isMacOS ? '⌥ ↵' : 'alt ↵',
        purpose: 'Insert using template',
      },
    ]);
  }

  async getSuggestions(
    context: EditorSuggestContext
  ): Promise<Fuse.FuseResult<PartialCSLEntry>[]> {
    LOG('getSuggestions called, query=', JSON.stringify(context.query));

    if (!context.query || context.query.includes(' ')) {
      LOG('getSuggestions: bailing — empty query or contains space');
      return [];
    }

    const { plugin } = this;
    LOG('bibManager.initPromise.settled =', plugin.bibManager.initPromise.settled);
    if (!plugin.bibManager.initPromise.settled) {
      LOG('getSuggestions: bailing — bib not loaded yet');
      return [];
    }

    const { bibManager } = plugin;
    LOG('bibManager.fuse =', bibManager.fuse ? `Fuse(${(bibManager.fuse as any)._docs?.length ?? '?'} docs)` : 'null');
    LOG('bibManager.bibCache.size =', bibManager.bibCache?.size ?? 'N/A');

    // Use the per-file fuse index when the note has a frontmatter bibliography,
    // but fall back to the global index if the per-file one is null — this
    // happens when the fileCache entry was created before the global bib finished
    // loading (race condition on startup).
    let fuse = bibManager.fuse;
    const hasFileCache = bibManager.fileCache.has(context.file);
    LOG('fileCache has this file =', hasFileCache);
    if (hasFileCache) {
      const cache = bibManager.fileCache.get(context.file);
      LOG('  per-file fuse =', cache.source.fuse ? `Fuse(${(cache.source.fuse as any)._docs?.length ?? '?'} docs)` : 'null');
      fuse = cache.source.fuse ?? bibManager.fuse;
    }

    LOG('using fuse =', fuse ? `Fuse(${(fuse as any)._docs?.length ?? '?'} docs)` : 'null');
    const fuseResults = fuse?.search(context.query, { limit: this.limit });
    LOG('fuse.search results =', fuseResults?.length ?? 0);
    if (fuseResults?.length) return fuseResults;

    // Fuse returned nothing (index empty or no match) — fall back to a live
    // Zotero query, mirroring ZotLit's approach. This works even when no groups
    // have been pre-loaded into the fuse index, as long as Zotero is running.
    const { settings } = plugin;
    LOG('settings.pullFromZotero =', settings.pullFromZotero);
    LOG('settings.zoteroGroups =', JSON.stringify(settings.zoteroGroups));
    LOG('settings.useNativeZoteroAPI =', settings.useNativeZoteroAPI);
    LOG('query.length =', context.query.length);

    if (settings.pullFromZotero && context.query.length >= 2) {
      const port = settings.zoteroPort ?? DEFAULT_ZOTERO_PORT;
      const groupIds = settings.zoteroGroups?.map((g) => g.id) ?? [];
      LOG('falling back to live Zotero search, port=', port, 'groupIds=', groupIds);
      try {
        const items = await searchZoteroNative(port, context.query, groupIds, this.limit);
        LOG('live Zotero search returned', items.length, 'items');
        return items.map((item, refIndex) => ({ item, refIndex, score: 0.5 }));
      } catch (e) {
        LOG('live Zotero search threw:', e);
      }
    } else {
      LOG('skipping Zotero fallback: pullFromZotero=', settings.pullFromZotero, 'queryLen=', context.query.length);
    }

    LOG('getSuggestions: returning empty');
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
      // Only highlight citekey (id) and title matches in the visible spans.
      if (m.key !== 'id' && m.key !== 'title') return;
      m.indices.forEach((indices) => {
        const start = indices[0];
        const stop = indices[1] + 1;

        const target = m.key === 'title' ? title : citekey;
        const prev = m.key === 'title' ? prevTitleIndex : prevCiteIndex;

        target.appendText(m.value.substring(prev, start));
        target.append(
          createEl('strong', {
            text: m.value.substring(start, stop),
          })
        );

        if (m.key === 'title') {
          prevTitleIndex = stop;
        } else {
          prevCiteIndex = stop;
        }
      });
    });

    if (item.title) title.appendText(item.title.substring(prevTitleIndex));
    citekey.appendText(item.id.substring(prevCiteIndex));

    const meta = getEntryMeta(item);
    if (meta) frag.createSpan({ text: meta, cls: 'bcs-suggest-meta' });

    el.setText(frag);
  }

  lastSelect: EditorPosition = null;
  selectSuggestion(
    suggestion: Fuse.FuseResult<PartialCSLEntry>,
    event: KeyboardEvent | MouseEvent
  ): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    let replaceStr = '';
    if (event.metaKey || event.ctrlKey) {
      replaceStr = `[@${suggestion.item.id}]`;
    } else {
      replaceStr = `@${suggestion.item.id}`;
    }

    const { start, end } = this.context;

    activeView.editor.replaceRange(replaceStr, start, end);

    this.lastSelect = {
      ch: start.ch + replaceStr.length,
      line: start.line,
    };
    this.close();
  }

  isRefreshing: boolean = false;
  async refreshZBib() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    await this.plugin.bibManager.refreshGlobalZBib();
    this.isRefreshing = false;
  }

  onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo {
    const { enableCiteKeyCompletion, pullFromZotero } = this.plugin.settings;

    // Unconditional probe — fires on EVERY call, no condition.
    const lineRaw = (editor.getLine(cursor.line) || '').substring(0, cursor.ch);
    LOG('onTrigger TICK ch=' + cursor.ch + ' line=' + JSON.stringify(lineRaw));

    // Only block if *explicitly* disabled — undefined (never set) means enabled.
    if (enableCiteKeyCompletion === false) {
      LOG('onTrigger: blocked by enableCiteKeyCompletion === false');
      return null;
    }

    const { lastSelect } = this;
    if (
      lastSelect &&
      cursor.ch === lastSelect.ch &&
      cursor.line === lastSelect.line
    ) {
      return null; // suppress re-trigger right after a selection
    }

    const line = lineRaw;
    const match = line.match(triggerRE);

    if (!match) {
      if (line.includes('@')) {
        LOG('onTrigger: has @ but regex did not match:', JSON.stringify(line));
      }
      return null;
    }

    LOG('onTrigger: matched, query=', match[3], 'char-before=', JSON.stringify(match[1]));

    this.lastSelect = null;

    if (!this.context && pullFromZotero) {
      this.refreshZBib();
    }

    const triggerIndex = match.index + match[1].length;
    const startPos = {
      line: cursor.line,
      ch: triggerIndex,
    };

    return {
      start: startPos,
      end: cursor,
      query: match[3],
    };
  }
}
