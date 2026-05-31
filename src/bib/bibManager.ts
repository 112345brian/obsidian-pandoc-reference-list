import { EditorView } from '@codemirror/view';
import CSL from 'citeproc';
import type ReferenceList from 'src/main';
import { PartialCSLEntry } from './types';
import Fuse from 'fuse.js';
import {
  bibPathsToCSL,
  bibToCSL,
  getBibPath,
  getCSLLocale,
  getCSLStyle,
  isAbsolutePath,
  pathBasename,
  DEFAULT_ZOTERO_PORT,
} from './helpers';
import { BBTAdapter, NativeAdapter, ZoteroAdapter } from './zotero';
import { SimpleLRU } from './lru';
import {
  PromiseCapability,
  copyElToClipboard,
  copyTextToClipboard,
} from 'src/helpers';
import {
  RenderedCitation,
  getCitationSegments,
  getCitations,
} from 'src/parser/parser';
import { FileSystemAdapter, Keymap, MarkdownView, Menu, TFile, normalizePath, setIcon } from 'obsidian';
import { getLitNoteForCitekey, isZotLitLoaded } from 'src/zotlit';
import { cite } from 'src/parser/citeproc';
import { setCiteKeyCache } from 'src/editorExtension';
import equal from 'fast-deep-equal';
import { t } from 'src/lang/helpers';

// Strip diacritics so "Muller" matches "Müller", "Cezanne" matches "Cézanne".
// Applied both when building the index and when normalising search queries.
// Credit: approach from obsidian-citation-extended (MIT).
export const normalizeDiacritics = (s: string): string =>
  s.normalize('NFD').replace(/\p{Mn}/gu, '');

// Fuse getFn wrapper that strips diacritics from indexed string fields.
const fuseFn = (obj: any, path: string | string[]) => {
  const val = Fuse.config.getFn(obj, path);
  if (typeof val === 'string') return normalizeDiacritics(val);
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? normalizeDiacritics(v) : v);
  return val;
};

// Citekey-biased: used for single-@ autocomplete.
const fuseSettings = {
  includeMatches: true,
  threshold: 0.35,
  minMatchCharLength: 2,
  getFn: fuseFn,
  keys: [
    { name: 'id', weight: 0.6 },
    { name: 'title', weight: 0.25 },
    { name: 'author.family', weight: 0.1 },
    { name: 'author.literal', weight: 0.05 },
  ],
};

// Title/author-biased: used for @@ full-text autocomplete.
const fuseTitleSettings = {
  includeMatches: true,
  threshold: 0.4,
  minMatchCharLength: 2,
  getFn: fuseFn,
  keys: [
    { name: 'title', weight: 0.6 },
    { name: 'author.family', weight: 0.2 },
    { name: 'author.literal', weight: 0.1 },
    { name: 'id', weight: 0.1 },
  ],
};

interface ScopedSettings {
  style?: string;
  lang?: string;
  bibliography?: string[];
  /** Paths from the `bcs-snapshot` frontmatter key. When present, bripey
   *  loads these .bib citekeys purely for blue/yellow/red colour comparison.
   *  The global engine is still used for rendering — the snapshot does NOT
   *  become the CSL source of truth. */
  snapshotBib?: string[];
}

export interface FileCache {
  keys: Set<string>;
  resolvedKeys: Set<string>;
  unresolvedKeys: Set<string>;
  /** Keys that exist in the global library but are absent from the note's
   *  snapshot .bib (set via the `bcs-snapshot` frontmatter key). Render with
   *  the `is-global-only` yellow style — resolvable but not yet snapshotted.
   *  Empty when no snapshot has been taken for this file. */
  globalOnlyKeys: Set<string>;
  bib: HTMLElement;
  citations: RenderedCitation[];
  citeBibMap: Map<string, string>;

  settings: ScopedSettings | null;

  source: {
    bibCache?: Map<string, PartialCSLEntry>;
    fuse?: Fuse<PartialCSLEntry>;
    engine?: any;
  };
}

function getFrontmatterString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
}

function getFrontmatterStringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(getFrontmatterString)
    .filter((v): v is string => !!v);
}

// Resolve a frontmatter bibliography path relative to the containing note.
// Returns the path as-is if absolute; otherwise constructs a vault-relative path.
function resolveScopedPath(file: TFile, scopedPath: string): string {
  if (isAbsolutePath(scopedPath)) return scopedPath;
  const noteDir = file.path.split('/').slice(0, -1).join('/');
  return normalizePath(noteDir ? `${noteDir}/${scopedPath}` : scopedPath);
}

export function getScopedSettings(file: TFile): ScopedSettings | null {
  const metadata = app.metadataCache.getFileCache(file);
  const output: ScopedSettings = {};

  if (!metadata?.frontmatter) {
    return null;
  }

  const { frontmatter } = metadata;

  const bibliography = getFrontmatterStringList(frontmatter.bibliography).map(
    (bibPath) => resolveScopedPath(file, bibPath)
  );
  output.bibliography = bibliography.length ? bibliography : undefined;

  const snapshotPaths = getFrontmatterStringList(frontmatter['bcs-snapshot']).map(
    (p) => resolveScopedPath(file, p)
  );
  output.snapshotBib = snapshotPaths.length ? snapshotPaths : undefined;

  output.style =
    getFrontmatterString(frontmatter.csl) ||
    getFrontmatterString(frontmatter['citation-style']) ||
    undefined;
  output.lang =
    getFrontmatterString(frontmatter.lang) ||
    getFrontmatterString(frontmatter['citation-language']) ||
    undefined;

  if (Object.values(output).every((v) => !v)) {
    return null;
  }

  return output;
}

function extractRawLocales(style: string, localeName?: string) {
  const locales = ['en-US'];
  if (localeName) {
    locales.push(localeName);
  }
  if (style) {
    const matches = style.match(/locale="[^"]+"/g);
    if (matches) {
      for (const match of matches) {
        const vals = match.slice(0, -1).slice(8).split(/\s+/);
        for (const val of vals) {
          locales.push(val);
        }
      }
    }
  }
  return normalizeLocales(locales);
}

function normalizeLocales(locales: string[]) {
  const obj: Record<string, boolean> = {};
  for (let locale of locales) {
    locale = locale.split('-').slice(0, 2).join('-');
    if (CSL.LANGS[locale]) {
      obj[locale] = true;
    } else {
      locale = locale.split('-')[0];
      if (CSL.LANG_BASES[locale]) {
        locale = CSL.LANG_BASES[locale].split('_').join('-');
        obj[locale] = true;
      }
    }
  }
  return Object.keys(obj);
}

export class BibManager {
  plugin: ReferenceList;
  fileCache: SimpleLRU<TFile, FileCache>;
  initPromise: PromiseCapability<void>;

  langCache: Map<string, string> = new Map();
  styleCache: Map<string, string> = new Map();

  bibCache: Map<string, PartialCSLEntry> = new Map();
  fuse: Fuse<PartialCSLEntry>;
  fuseTitle: Fuse<PartialCSLEntry>;
  engine: any;

  /** True as soon as the Fuse index is built — gates autocomplete independently
   *  of the CSL engine so `@` suggestions are available before citeproc compiles
   *  the citation style. */
  get fuseReady(): boolean {
    return this.fuse != null;
  }

  zCitekeyToLinks: Map<string, string> = new Map();
  zCitekeyToPDFLinks: Map<string, string[]> = new Map();

  // Keys loaded from the .bib file — used to detect cross-source conflicts.
  bibSourceKeys: Set<string> = new Set();
  // Keys present in both .bib and Zotero (Zotero wins; flagged in the UI).
  conflictKeys: Set<string> = new Set();

  // Vault-relative paths of bib files to watch for changes.
  private watchedBibPaths: Set<string> = new Set();
  private globalWatchedBibPaths: Set<string> = new Set();
  private scopedWatchedBibPaths: Map<string, Set<string>> = new Map();

  constructor(plugin: ReferenceList) {
    this.plugin = plugin;
    this.initPromise = new PromiseCapability();
    this.fileCache = new SimpleLRU({ max: 10 });

    // Single vault-level listener replaces per-file FSWatchers.
    plugin.registerEvent(
      plugin.app.vault.on('modify', (file) => {
        const p = normalizePath(file.path);
        if (!this.watchedBibPaths.has(p)) return;

        // Reload all global sources (bib first, Zotero on top), rebuild engine.
        const { settings } = plugin;
        this.bibCache.clear();
        this.bibSourceKeys.clear();
        this.conflictKeys.clear();

        const reload = async () => {
          if (settings.pathToBibliography) await this.loadGlobalBibFile();
          if (settings.pullFromZotero) await this.loadGlobalZBib(false);
          await this.buildGlobalEngine();
          this.fileCache.clear();
          plugin.processReferences();
        };
        reload().catch(console.error);
      })
    );
  }

  destroy() {
    this.fileCache.clear();
    this.watchedBibPaths.clear();
    this.globalWatchedBibPaths.clear();
    this.scopedWatchedBibPaths.clear();
    this.bibSourceKeys.clear();
    this.conflictKeys.clear();
    this.langCache.clear();
    this.styleCache.clear();
    this.bibCache.clear();
    this.fuse = null;
    this.fuseTitle = null;
    this.engine = null;
    this.plugin = null;
  }

  async reinit(clearBibData: boolean) {
    this.initPromise = new PromiseCapability();
    this.fileCache.clear();

    if (clearBibData) {
      this.bibCache.clear();
      this.bibSourceKeys.clear();
      this.conflictKeys.clear();

      const { settings } = this.plugin;
      if (settings.bibliographyPaths?.length) await this.loadGlobalBibFiles();
      if (settings.pullFromZotero) await this.loadGlobalZBib(false);
    }

    await this.buildGlobalEngine();
    this.initPromise.resolve();
  }

  // Build the Fuse indexes from the current bibCache without touching the CSL
  // engine. Called after all data sources have loaded so that autocomplete
  // is available before the (slower) citeproc engine compilation finishes.
  buildFuseIndex() {
    this.setFuse(Array.from(this.bibCache.values()));
  }

  setFuse(data: PartialCSLEntry[] = []) {
    if (!this.fuse) {
      this.fuse = new Fuse(data, fuseSettings);
    } else {
      this.fuse.setCollection(data);
    }
    if (!this.fuseTitle) {
      this.fuseTitle = new Fuse(data, fuseTitleSettings);
    } else {
      this.fuseTitle.setCollection(data);
    }
  }

  updateFuse(data: Map<string, PartialCSLEntry>) {
    if (!this.fuse) return;

    this.fuse.remove((doc) => data.has(doc.id));
    this.fuseTitle?.remove((doc) => data.has(doc.id));

    for (const doc of data.values()) {
      this.fuse.add(doc);
      this.fuseTitle?.add(doc);
    }
  }

  async loadScopedEngine(settings: ScopedSettings) {
    if (!settings) return this;

    const pluginSettings = this.plugin.settings;
    let style =
      pluginSettings.cslStyleURL ??
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    let lang = pluginSettings.cslLang ?? 'en-US';
    let bibCache = this.bibCache;
    let fuse = this.fuse;
    let langs = [settings.lang];

    if (settings.style) {
      try {
        const isURL = /^http/.test(settings.style);
        const styleObj = isURL
          ? { id: settings.style }
          : { id: settings.style, explicitPath: settings.style };
        const styles = await this.loadStyles([styleObj]);
        for (const styleStr of styles) {
          langs = extractRawLocales(styleStr, settings.lang);
        }
        style = settings.style;
      } catch (e) {
        console.error(e);
        this.plugin.view?.setMessage((e as Error).message);
        return this;
      }
    }

    if (settings.lang) {
      try {
        await this.loadLangs(langs);
        lang = settings.lang;
      } catch (e) {
        console.error(e);
        this.plugin.view?.setMessage((e as Error).message);
        return this;
      }
    }

    if (settings.bibliography?.length) {
      try {
        const bib = await bibPathsToCSL(
          settings.bibliography,
          this.plugin.settings.pathToPandoc
        );
        bibCache = new Map();

        for (const entry of bib) {
          bibCache.set(entry.id, entry);
        }

        fuse = new Fuse(bib, fuseSettings);
      } catch (e) {
        console.error(e);
        throw e;
      }
    }

    try {
      const engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        bibCache
      );

      return {
        bibCache,
        fuse,
        engine,
      };
    } catch (e) {
      console.error(e);
      return this;
    }
  }

  // Load all configured .bib files into bibCache tagged as 'bib'.
  // Does not build the CSL engine — call buildGlobalEngine() after all sources load.
  //
  // Parse cache: results are stored in .pandoc/bib-parsed.json as an array of
  // per-file entries keyed by (path + mtime + size + pandocPath). On startup,
  // an unchanged file loads from JSON in ~5ms instead of running bibtex-parser.
  // Absolute paths outside the vault are always re-parsed (no stat available).
  async loadGlobalBibFiles() {
    const { settings } = this.plugin;
    const paths = settings.bibliographyPaths ?? [];
    if (!paths.length) return;

    const CACHE_DIR = normalizePath('.pandoc');
    const BIB_CACHE_PATH = normalizePath('.pandoc/bib-parsed.json');
    const pandoc = settings.pathToPandoc ?? '';

    // Load existing cache file once up-front.
    let cacheMap = new Map<string, { mtime: number; size: number; pandoc: string; entries: PartialCSLEntry[] }>();
    try {
      if (await app.vault.adapter.exists(BIB_CACHE_PATH)) {
        const raw = JSON.parse(await app.vault.adapter.read(BIB_CACHE_PATH));
        if (Array.isArray(raw)) {
          for (const entry of raw) cacheMap.set(entry.path, entry);
        }
      }
    } catch {
      // Corrupt or missing cache — start fresh.
    }

    let cacheModified = false;
    let settingsModified = false;

    for (let i = 0; i < paths.length; i++) {
      const rawPath = paths[i];
      if (!rawPath?.trim()) continue;

      let resolved: string;
      try {
        resolved = await getBibPath(rawPath);
      } catch (e) {
        console.error(`bripey-citation-suite: cannot resolve .bib path "${rawPath}":`, e);
        continue;
      }

      // Persist normalised path back to settings if it changed.
      if (resolved !== rawPath) {
        console.info(`bripey-citation-suite: normalised bib path "${rawPath}" → "${resolved}"`);
        settings.bibliographyPaths[i] = resolved;
        settingsModified = true;
      }

      let bib: PartialCSLEntry[] | null = null;

      if (!isAbsolutePath(resolved)) {
        try {
          const stat = await app.vault.adapter.stat(normalizePath(resolved));
          const cached = cacheMap.get(resolved);
          if (stat && cached &&
              cached.mtime === stat.mtime &&
              cached.size === stat.size &&
              cached.pandoc === pandoc) {
            bib = cached.entries;
            console.log(`[bcs:bib] parse cache hit for "${resolved}" — ${bib.length} entries`);
          }
        } catch {
          // Fall through to full parse.
        }
      }

      if (!bib) {
        try {
          bib = await bibToCSL(resolved, settings.pathToPandoc);
          console.log(`[bcs:bib] parsed "${resolved}" — ${bib?.length ?? 0} entries`);
        } catch (e) {
          console.error(`bripey-citation-suite: failed to load "${resolved}":`, e);
          continue;
        }

        if (!isAbsolutePath(resolved)) {
          try {
            const stat = await app.vault.adapter.stat(normalizePath(resolved));
            if (stat) {
              cacheMap.set(resolved, { mtime: stat.mtime, size: stat.size, pandoc, entries: bib });
              cacheModified = true;
            }
          } catch {
            // Cache write failure is non-fatal.
          }
        }
      }

      // Register for change watching (vault-relative paths only).
      if (!isAbsolutePath(resolved)) {
        this.globalWatchedBibPaths.add(normalizePath(resolved));
      }

      for (const entry of bib) {
        this.bibCache.set(entry.id, { ...entry, _source: 'bib' });
        this.bibSourceKeys.add(entry.id);
      }
    }

    this.rebuildWatchedBibPaths();

    // Flush updated cache to disk.
    if (cacheModified) {
      try {
        if (!(await app.vault.adapter.exists(CACHE_DIR))) {
          await app.vault.adapter.mkdir(CACHE_DIR);
        }
        await app.vault.adapter.write(BIB_CACHE_PATH, JSON.stringify([...cacheMap.values()]));
      } catch {
        // Cache write failure is non-fatal.
      }
    }

    if (settingsModified) this.plugin.saveSettings();
    console.log('[bcs:bib] bibCache now has', this.bibCache.size, 'entries after .bib load');
  }

  getZoteroAdapter(): ZoteroAdapter {
    const { settings } = this.plugin;
    const port = settings.zoteroPort ?? DEFAULT_ZOTERO_PORT;
    return settings.useNativeZoteroAPI
      ? new NativeAdapter(port)
      : new BBTAdapter(port);
  }

  async isZoteroAvailable(): Promise<boolean> {
    return this.getZoteroAdapter().isRunning();
  }

  async loadAndRefreshGlobalZBib() {
    await this.loadGlobalZBib(true);
    // refreshGlobalZBib runs after engine is built by the caller
  }

  // Merge Zotero entries into bibCache (Zotero wins on conflicts with .bib).
  // Within Zotero, keeps the most recently modified entry when a citationKey
  // appears in multiple groups. Does not build the CSL engine.
  async loadGlobalZBib(fromCache?: boolean) {
    const { settings } = this.plugin;
    console.log('[bcs:bib] loadGlobalZBib, fromCache=', fromCache, 'zoteroGroups=', JSON.stringify(settings.zoteroGroups), 'pullFromZotero=', settings.pullFromZotero);
    if (!settings.zoteroGroups?.length) {
      console.log('[bcs:bib] no zoteroGroups configured — skipping Zotero load');
      return;
    }

    const adapter = this.getZoteroAdapter();
    console.log('[bcs:bib] using adapter:', (adapter as any).constructor?.name ?? typeof adapter);
    for (const group of settings.zoteroGroups) {
      try {
        console.log('[bcs:bib] fetching group', group.id, group.name);
        const res = await adapter.getBib('', group.id, fromCache);
        console.log('[bcs:bib] group', group.id, 'returned', res.list?.length ?? 'null', 'entries');
        if (!res.list?.length) continue;

        if (!fromCache) {
          group.lastUpdate = Date.now();
          group.libraryVersion = res.version;
        }

        for (const entry of res.list) {
          this.mergeZoteroEntry(entry);
        }
      } catch (e) {
        console.error('bripey-citation-suite: Zotero load failed:', e);
      }
    }

    console.log('[bcs:bib] bibCache now has', this.bibCache.size, 'entries after Zotero load');
    this.plugin.saveSettings();
  }

  // Merge a single Zotero entry into bibCache with full priority + dedup logic.
  private mergeZoteroEntry(entry: PartialCSLEntry) {
    const existing = this.bibCache.get(entry.id);
    const tagged = { ...entry, _source: 'zotero' as const };

    if (existing?._source === 'zotero') {
      // Cross-group duplicate — keep whichever was modified more recently.
      if ((tagged._dateModified ?? '') > (existing._dateModified ?? '')) {
        this.bibCache.set(entry.id, tagged);
      }
      // else keep existing; both from Zotero so no conflict with .bib
      return;
    }

    if (existing?._source === 'bib') {
      // Key exists in both sources — flag it, Zotero wins.
      this.conflictKeys.add(entry.id);
    }

    this.bibCache.set(entry.id, tagged);
  }

  async refreshGlobalZBib() {
    const { settings } = this.plugin;
    if (!settings.zoteroGroups?.length) return;

    const adapter = this.getZoteroAdapter();
    const modifiedEntries: Map<string, PartialCSLEntry> = new Map();

    for (const group of settings.zoteroGroups) {
      try {
        const res = await adapter.refreshBib(
          '',
          group.id,
          group.libraryVersion ?? 0,
          group.lastUpdate
        );

        if (!res) continue;
        if (res.list?.length) group.lastUpdate = Date.now();

        for (const [k, v] of res.modified.entries()) {
          this.mergeZoteroEntry(v);
          modifiedEntries.set(k, this.bibCache.get(k)!);
        }
      } catch (e) {
        console.error('bripey-citation-suite: Zotero refresh failed:', e);
      }
    }

    this.plugin.saveSettings();
    this.updateFuse(modifiedEntries);
    this.fileCache.clear();
    this.plugin.processReferences();
  }

  // Build (or rebuild) the global CSL engine from the current bibCache.
  // Must be called after all sources have finished loading.
  // Also (re)builds the Fuse indexes so that reinit() and the vault-file watcher
  // don't need a separate buildFuseIndex() call.
  async buildGlobalEngine() {
    const { settings } = this.plugin;

    console.log('[bcs:bib] buildGlobalEngine, bibCache.size=', this.bibCache.size);
    this.setFuse(Array.from(this.bibCache.values()));

    const style =
      settings.cslStylePath ||
      settings.cslStyleURL ||
      'https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl';
    const lang = settings.cslLang || 'en-US';

    await this.getLangAndStyle(lang, {
      id: style,
      explicitPath: settings.cslStylePath,
    });
    if (!this.styleCache.has(style)) return;

    try {
      this.engine = this.buildEngine(
        lang,
        this.langCache,
        style,
        this.styleCache,
        this.bibCache
      );
    } catch (e) {
      console.error(e);
    }
  }

  buildEngine(
    lang: string,
    langCache: Map<string, string>,
    style: string,
    styleCache: Map<string, string>,
    bibCache: Map<string, PartialCSLEntry>
  ) {
    const styleXML = styleCache.get(style);
    if (!styleXML) {
      throw new Error(
        'attempting to build citproc engine with empty CSL style'
      );
    }
    if (!langCache.get(lang)) {
      throw new Error(
        'attempting to build citproc engine with empty CSL locale'
      );
    }
    const engine = new CSL.Engine(
      {
        retrieveLocale: (id: string) => {
          return langCache.get(id);
        },
        retrieveItem: (id: string) => {
          return bibCache.get(id);
        },
      },
      styleXML,
      lang
    );
    engine.opt.development_extensions.wrap_url_and_doi = true;
    return engine;
  }

  async getLangAndStyle(
    lang: string,
    style: { id: string; explicitPath?: string }
  ) {
    let styles: string[] = [];
    if (!this.styleCache.has(style.id)) {
      try {
        styles = await this.loadStyles([style]);
      } catch (e) {
        console.error('Error loading style', style, e);
        this.initPromise.resolve();
        return;
      }
    }

    let locales = [lang];
    for (const styleStr of styles) {
      locales = extractRawLocales(styleStr, lang);
    }

    try {
      await this.loadLangs(locales);
    } catch (e) {
      console.error('Error loading lang', lang, e);
      this.initPromise.resolve();
      return;
    }
  }

  async loadLangs(langs: string[]) {
    for (const lang of langs) {
      if (!lang) continue;
      if (!this.langCache.has(lang)) {
        await getCSLLocale(this.langCache, this.plugin.cacheDir, lang);
      }
    }
  }

  async loadStyles(styles: { id?: string; explicitPath?: string }[]) {
    const res: string[] = [];
    for (const style of styles) {
      if (!style.id && !style.explicitPath) continue;
      if (!this.styleCache.has(style.explicitPath ?? style.id)) {
        res.push(
          await getCSLStyle(
            this.styleCache,
            this.plugin.cacheDir,
            style.id,
            style.explicitPath
          )
        );
      }
    }
    return res;
  }

  getNoteForNoteIndex(file: TFile, index: string) {
    if (!this.fileCache.has(file)) {
      return null;
    }

    const cache = this.fileCache.get(file);
    const noteIndex = parseInt(index);

    const cite = cache.citations.find((c) => c.noteIndex === noteIndex);

    if (!cite.note) {
      return null;
    }

    const doc = new DOMParser().parseFromString(cite.note, 'text/html');
    return Array.from(doc.body.childNodes);
  }

  getBibForCiteKey(file: TFile, key: string) {
    if (!this.fileCache.has(file)) {
      return null;
    }

    const cache = this.fileCache.get(file);
    if (!cache.keys.has(key)) {
      return null;
    }

    const html = cache.citeBibMap.get(key);
    if (!html) {
      return null;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.body.firstElementChild as HTMLElement;
    if (el) {
      el.dataset.citekey = key;
      return this.prepBibHTML(el, file, true);
    }
    return el;
  }

  async getReferenceList(
    file: TFile,
    content: string,
    shouldContinue: () => boolean = () => true
  ) {
    await this.plugin.initPromise.promise;
    if (!shouldContinue()) return undefined;
    await this.initPromise.promise;
    if (!shouldContinue()) return undefined;

    const segs = getCitationSegments(
      content,
      !this.plugin.settings.renderLinkCitations
    );
    const processed = segs.map((s) => getCitations(s));

    if (!processed.length) return null;

    const citeKeys = new Set<string>();
    const unresolvedKeys = new Set<string>();
    const resolvedKeys = new Set<string>();
    const globalOnlyKeys = new Set<string>();
    const cachedDoc = this.fileCache.has(file)
      ? this.fileCache.get(file)
      : null;
    const citeBibMap = new Map<string, string>();
    const settings = getScopedSettings(file);

    processed.forEach((p) =>
      p.citations.forEach((c) => {
        if (c.id && !citeKeys.has(c.id)) {
          citeKeys.add(c.id);
        }
      })
    );

    const areSettingsEqual = equal(settings, cachedDoc?.settings);

    const source =
      cachedDoc?.source && areSettingsEqual
        ? cachedDoc.source
        : await this.loadScopedEngine(settings);
    if (!shouldContinue()) return undefined;

    this.updateScopedWatchedBibPaths(file, settings);

    const setNull = (): null => {
      const result: FileCache = {
        keys: citeKeys,
        resolvedKeys,
        unresolvedKeys,
        globalOnlyKeys,
        bib: null,
        citations: [],
        citeBibMap,
        settings: null,
        source,
      };

      this.fileCache.set(file, result);
      this.dispatchResult(file, result);

      return null;
    };

    if (!source?.engine) {
      return setNull();
    }

    // Load snapshot citekeys (fast regex, no full parse) if the file has a
    // bcs-snapshot frontmatter key. These are used only for colour comparison —
    // the global engine always handles rendering.
    const snapshotKeys: Set<string> = settings?.snapshotBib?.length
      ? await this.loadSnapshotKeys(settings.snapshotBib)
      : new Set();
    const hasSnapshot = snapshotKeys.size > 0;

    citeKeys.forEach((k) => {
      if (source.bibCache.has(k)) {
        resolvedKeys.add(k);
        if (hasSnapshot && !snapshotKeys.has(k)) {
          globalOnlyKeys.add(k); // in global library but not saved to snapshot → yellow
        }
      } else {
        unresolvedKeys.add(k);
      }
    });

    const filtered = processed.filter((s) =>
      s.citations.every((c) => {
        if (source.bibCache.has(c.id)) {
          resolvedKeys.add(c.id);
          if (hasSnapshot && !snapshotKeys.has(c.id)) {
            globalOnlyKeys.add(c.id);
          }
          return true;
        } else {
          unresolvedKeys.add(c.id);
          return false;
        }
      })
    );

    // Do we need this?
    // source.engine.updateItems(Array.from(resolvedKeys));

    const citations = cite(source.engine, filtered);
    if (!shouldContinue()) return undefined;

    if (
      cachedDoc &&
      equal(cachedDoc.citations, citations) &&
      areSettingsEqual
    ) {
      return cachedDoc.bib;
    }

    const bib = source.engine.makeBibliography();

    if (!bib?.length) {
      return setNull();
    }

    const metadata = bib[0];
    const entries = bib[1];
    const htmlStr = [metadata.bibstart];

    metadata.entry_ids?.forEach((e: string, i: number) => {
      entries[i] = entries[i].replace(/>/, ` data-citekey="${e[0]}">`);
      citeBibMap.set(e[0], entries[i]);
    });

    for (const entry of entries) htmlStr.push(entry);

    htmlStr.push(metadata.bibend);
    let parsed = entries.length
      ? (new DOMParser().parseFromString(htmlStr.join(''), 'text/html').body
          .firstElementChild as HTMLElement)
      : null;

    if (parsed) {
      if (
        this.plugin.settings.pullFromZotero &&
        !settings?.bibliography?.length
      ) {
        await this.getZLinksForKeys(resolvedKeys);
        if (!shouldContinue()) return undefined;
      }
      parsed = this.prepBibHTML(parsed, file);
    }

    const result: FileCache = {
      keys: citeKeys,
      resolvedKeys,
      unresolvedKeys,
      globalOnlyKeys,
      bib: parsed,
      citations,
      citeBibMap,
      settings,
      source,
    };

    this.fileCache.set(file, result);
    this.dispatchResult(file, result);

    return result.bib;
  }

  /** Load citekeys from a snapshot .bib file using a fast regex scan —
   *  no full CSL parse needed since we only need the entry IDs. */
  private async loadSnapshotKeys(paths: string[]): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const p of paths) {
      try {
        let text: string;
        if (isAbsolutePath(p)) {
          const buf = await FileSystemAdapter.readLocalFile(p);
          text = new TextDecoder().decode(buf);
        } else {
          text = await app.vault.adapter.read(normalizePath(p));
        }
        for (const m of text.matchAll(/@\w+\s*\{\s*([^,\s\n]+)\s*,/gm)) {
          keys.add(m[1].trim());
        }
      } catch {
        // File missing or unreadable — treat snapshot as empty.
      }
    }
    return keys;
  }

  /** Return all CSL entries for the citekeys currently used in `file`,
   *  drawing from the global library (so Zotero-only entries are included).
   *  Returns null if the file has no resolved or global-only keys yet. */
  snapshotEntries(file: TFile): PartialCSLEntry[] | null {
    const cache = this.fileCache.get(file);
    if (!cache) return null;
    const allKeys = new Set([...cache.resolvedKeys, ...cache.globalOnlyKeys]);
    if (!allKeys.size) return null;
    const entries: PartialCSLEntry[] = [];
    for (const key of allKeys) {
      const entry = this.bibCache.get(key);
      if (entry) entries.push(entry);
    }
    return entries.length ? entries : null;
  }

  async getZLinksForKeys(citekeys: Set<string>) {
    const queries: Record<number, string[]> = {};

    citekeys.forEach((key) => {
      if (!this.zCitekeyToLinks.has(key)) {
        if (!this.bibCache.has(key)) return;
        const item = this.bibCache.get(key);
        const id = item.groupID;
        if (id === undefined) return;
        if (!queries[id]) {
          queries[id] = [];
        }
        queries[id].push(key);
      }
    });

    for (const id of Object.keys(queries)) {
      const groupId = Number(id);
      try {
        const items = await this.getZoteroAdapter().getItemsForCiteKeys(
          queries[groupId],
          groupId
        );
        if (items?.length) {
          for (const item of items) {
            const key = item.citekey || item.citationKey;
            const link = item.select;
            if (key && link) {
              this.zCitekeyToLinks.set(key, link);
              if (item.attachments?.length) {
                const attLinks: string[] = [];
                for (const att of item.attachments) {
                  if (/\.pdf$/.test(att.path)) {
                    attLinks.push(att.path);
                  }
                }
                if (attLinks.length) {
                  this.zCitekeyToPDFLinks.set(key, attLinks);
                }
              }
            }
          }
        }
      } catch {
        //
      }
    }
  }

  prepBibHTML(parsed: HTMLElement, file: TFile, inTooltip?: boolean) {
    if (this.plugin.settings.hideLinks) {
      parsed?.findAll('a').forEach((l) => {
        l.setAttribute('aria-label', l.innerText);
      });
    }

    if (parsed?.hasClass('csl-entry')) {
      const entry = parsed;
      parsed = createDiv();
      parsed.append(entry);
    }

    parsed?.findAll('.csl-entry').forEach((e) => {
      const div = createDiv({ cls: 'csl-entry-wrapper' });
      e.parentElement.insertBefore(div, e);
      div.append(e);

      if (e.dataset.citekey) {
        const citekey = e.dataset.citekey;
        if (!inTooltip) {
          e.setAttribute('aria-label', t('Click to jump to citation'));
          e.onClickEvent(() => {
            this.scrollToCitation(citekey, file).catch(console.error);
          });
          e.oncontextmenu = (evt) => {
            evt.preventDefault();
            new Menu()
              .addItem((item) =>
                item
                  .setTitle(t('Copy citekey'))
                  .setIcon('lucide-copy')
                  .onClick(() => copyTextToClipboard(`@${citekey}`))
              )
              .addItem((item) =>
                item
                  .setTitle(t('Copy reference'))
                  .setIcon('lucide-copy')
                  .onClick(() => copyElToClipboard(e))
              )
              .showAtMouseEvent(evt);
          };
        }

        const zLink = this.zCitekeyToLinks.get(citekey);
        const zPDFLinks = this.zCitekeyToPDFLinks.get(citekey);
        const hasConflict = this.conflictKeys.has(citekey);

        // Use ZotLit's frontmatter-based note index when available; fall back
        // to filename-based detection for non-ZotLit setups.
        const litNote = getLitNoteForCitekey(citekey, file.path, app);
        const canCreateNote = !litNote && !isZotLitLoaded();

        if (!litNote && !zLink && !zPDFLinks && !hasConflict && !canCreateNote) return;

        div.createDiv({ cls: 'bcs-entry-btns' }, (div) => {
          if (hasConflict) {
            div.createDiv('clickable-icon bcs-conflict-icon', (div) => {
              setIcon(div, 'lucide-alert-triangle');
              div.setAttr(
                'aria-label',
                t('This entry exists in both your .bib file and Zotero. Zotero data is shown.')
              );
            });
          }
          if (litNote) {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'sticky-note');
              div.setAttr('aria-label', t('Open literature note'));
              div.onClickEvent((evt) => {
                const newPane = Keymap.isModEvent(evt);
                app.workspace.openLinkText(litNote.linkText, file.path, newPane);
              });
            });
          } else if (canCreateNote) {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'lucide-file-plus');
              div.setAttr('aria-label', t('Create literature note'));
              div.onClickEvent(async () => {
                await this.createLiteratureNote(citekey, file);
              });
            });
          }
          if (zLink) {
            div.createDiv('clickable-icon', (div) => {
              setIcon(div, 'lucide-external-link');
              div.setAttr('aria-label', t('Open in Zotero'));
              div.onClickEvent(() => {
                activeWindow.open(zLink, '_blank');
              });
            });
          }
          if (zPDFLinks) {
            zPDFLinks.forEach((link) => {
              div.createDiv('clickable-icon', (div) => {
                setIcon(div, 'lucide-file-text');
                div.setAttr('aria-label', pathBasename(link));
                div.onClickEvent(() => {
                  activeWindow.open(`file://${encodeURI(link)}`, '_blank');
                });
              });
            });
          }
        });
      }
    });

    return parsed;
  }

  async scrollToCitation(citekey: string, sourceFile: TFile) {
    const escaped = citekey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const citekeyPattern = new RegExp(`@${escaped}\\b`);
    let targetView: MarkdownView | null = null;

    this.plugin.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const view = leaf.view as MarkdownView;
      if (view.file === sourceFile) {
        targetView = view;
      }
    });

    if (!targetView) {
      await this.plugin.app.workspace.openLinkText(sourceFile.path, '', false);
      targetView =
        this.plugin.app.workspace.getActiveViewOfType(MarkdownView) ?? null;
    }

    if (!targetView?.editor) return;

    const editor = targetView.editor;
    const offset = editor.getValue().search(citekeyPattern);
    if (offset < 0) return;

    const pos = editor.offsetToPos(offset);
    editor.setCursor(pos);
    editor.scrollIntoView({ from: pos, to: pos }, true);
    editor.focus();
  }

  async createLiteratureNote(citekey: string, sourceFile: TFile) {
    const entry = this.bibCache.get(citekey) as any;
    const title = entry?.title ?? citekey;
    const year = entry?.issued?.['date-parts']?.[0]?.[0] ?? '';
    const authors: string[] = (entry?.author ?? [])
      .map((a: any) => [a.family, a.given].filter(Boolean).join(', ') || a.literal || '')
      .filter(Boolean);

    // Build the "zotero-key" value ZotLit needs to index this note.
    // Format: ITEMKEY for My Library (groupID 1), ITEMKEYgGROUPID for group libraries.
    // See ZotLit's getItemKeyGroupID and ZOTERO_KEY_FIELDNAME.
    const zoteroItemKey: string | undefined = entry?._zoteroKey;
    const groupId: number | undefined = entry?.groupID;
    let zoteroKeyField: string | null = null;
    if (zoteroItemKey) {
      zoteroKeyField =
        groupId && groupId !== 1
          ? `${zoteroItemKey}g${groupId}`
          : zoteroItemKey;
    }

    const folder = this.plugin.settings.literatureNoteFolder?.trim() ?? '';
    const filename = `@${citekey}.md`;
    const notePath = folder ? normalizePath(`${folder}/${filename}`) : filename;

    if (await app.vault.adapter.exists(notePath)) {
      await app.workspace.openLinkText(notePath, sourceFile.path, true);
      return;
    }

    const lines = [
      '---',
      `citekey: ${citekey}`,
      ...(zoteroKeyField ? [`zotero-key: ${zoteroKeyField}`] : []),
      `title: "${title.replace(/"/g, '\\"')}"`,
      `year: ${year}`,
      ...(authors.length
        ? [`authors:`, ...authors.map((a) => `  - "${a}"`)]
        : []),
      '---',
    ];

    const content = `${lines.join('\n')}\n\n# ${title}\n\n`;

    if (folder && !(await app.vault.adapter.exists(normalizePath(folder)))) {
      await app.vault.adapter.mkdir(normalizePath(folder));
    }

    await app.vault.create(notePath, content);
    await app.workspace.openLinkText(notePath, sourceFile.path, true);
  }

  dispatchResult(file: TFile, result: FileCache) {
    app.workspace.getLeavesOfType('markdown').forEach((l) => {
      const view = l.view as MarkdownView;
      if (view.file === file) {
        const previewMode = (view as any).previewMode;
        const renderer = previewMode?.renderer;
        if (renderer) {
          renderer.lastText = null;
          for (const section of renderer.sections) {
            if (
              !section.el.hasClass('mod-header') &&
              !section.el.hasClass('mod-footer')
            ) {
              section.rendered = false;
              section.el.empty();
            }
          }
          renderer.queueRender();
        } else if (typeof previewMode?.rerender === 'function') {
          previewMode.rerender(true);
        } else if (typeof (view as any).onMarkdownFold === 'function') {
          (view as any).onMarkdownFold();
        }

        const cm = (view.editor as any).cm as EditorView;
        if (cm.dispatch) {
          cm.dispatch({
            effects: [setCiteKeyCache.of(result)],
          });
        }
      }
    });
  }

  private updateScopedWatchedBibPaths(file: TFile, settings: ScopedSettings | null) {
    const paths = new Set<string>();

    if (settings?.bibliography?.length) {
      for (const scopedBibPath of settings.bibliography) {
        if (!isAbsolutePath(scopedBibPath)) {
          paths.add(normalizePath(scopedBibPath));
        }
      }
    }

    if (paths.size) {
      this.scopedWatchedBibPaths.set(file.path, paths);
    } else {
      this.scopedWatchedBibPaths.delete(file.path);
    }

    this.rebuildWatchedBibPaths();
  }

  private rebuildWatchedBibPaths() {
    this.watchedBibPaths.clear();

    for (const path of this.globalWatchedBibPaths) {
      this.watchedBibPaths.add(path);
    }

    for (const paths of this.scopedWatchedBibPaths.values()) {
      for (const path of paths) {
        this.watchedBibPaths.add(path);
      }
    }
  }

  getCacheForPath(filePath: string) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      return cache;
    }

    return null;
  }

  getResolution(filePath: string, key: string) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      return {
        isResolved: cache.resolvedKeys.has(key),
        isUnresolved: cache.unresolvedKeys.has(key),
      };
    }

    return {
      isResolved: false,
      isUnresolved: false,
    };
  }

  getCitationsForSection(filePath: string, lineStart: number, lineEnd: number) {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (file && file instanceof TFile && this.fileCache.has(file)) {
      const cache = this.fileCache.get(file);
      const mCache = app.metadataCache.getCache(filePath);

      const section = mCache.sections?.find(
        (s) =>
          s.position.start.line === lineStart && s.position.end.line === lineEnd
      );

      if (!section) return [];

      const startOffset = section.position.start.offset;
      const endOffset = section.position.end.offset;

      const cites = cache.citations.filter(
        (c) => c.from >= startOffset && c.to <= endOffset
      );
      return cites;
    }

    return [];
  }
}
