import {
  Editor,
  Events,
  MarkdownView,
  Menu,
  Modal,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
  debounce,
  htmlToMarkdown,
  normalizePath,
  setIcon,
} from 'obsidian';

import {
  citeKeyCacheField,
  citeKeyPlugin,
  bibManagerField,
  editorTooltipHandler,
} from './editorExtension';
import { t } from './lang/helpers';
import { processCiteKeys } from './markdownPostprocessor';
import {
  DEFAULT_SETTINGS,
  ReferenceListSettings,
  ReferenceListSettingsTab,
} from './settings';
import { TooltipManager } from './tooltip';
import { ReferenceListView, viewType } from './view';
import { PromiseCapability } from './helpers';
import { isAbsolutePath } from './bib/helpers';
import { findPandoc } from './bib/pandoc';
import { BibManager, getScopedSettings } from './bib/bibManager';
import { CiteSuggest } from './citeSuggest/citeSuggest';

const bibliographyExtensions = new Set(['bib', 'json', 'yaml', 'yml']);

function isBibliographyFile(file: TAbstractFile): file is TFile {
  return file instanceof TFile && bibliographyExtensions.has(file.extension);
}

// Minimal posix-style path helpers for vault paths (always forward-slash).
function posixDirname(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '' : p.slice(0, idx);
}

function posixBasename(p: string): string {
  return p.split('/').pop() ?? p;
}

function posixRelative(from: string, to: string): string {
  const a = from.split('/').filter(Boolean);
  const b = to.split('/').filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/') || '.';
}

function getFileRelativePath(sourceFile: TFile, targetPath: string) {
  const sourceDir = posixDirname(sourceFile.path);
  const rel = posixRelative(sourceDir, targetPath);
  return rel || posixBasename(targetPath);
}

function bibliographyMatchesPath(
  sourceFile: TFile,
  bibliography: string,
  targetPath: string
) {
  const sourceDir = posixDirname(sourceFile.path);
  const normalizedBibliography = normalizePath(bibliography);
  const noteRelativePath = normalizePath(`${sourceDir}/${normalizedBibliography}`);
  const vaultRelativePath = normalizePath(normalizedBibliography);

  if (noteRelativePath === targetPath || vaultRelativePath === targetPath) {
    return true;
  }

  if (isAbsolutePath(bibliography)) {
    // Absolute path: compare normalised strings directly.
    const vaultRoot = (app.vault.adapter as any).getBasePath?.() ?? '';
    const targetAbs = vaultRoot ? `${vaultRoot}/${targetPath}` : targetPath;
    return bibliography.replace(/\\/g, '/') === targetAbs.replace(/\\/g, '/');
  }

  return false;
}

function updateBibliographyPath(
  sourceFile: TFile,
  bibliography: unknown,
  oldPath: string,
  newPath: string
) {
  const getUpdatedPath = (value: unknown) => {
    if (
      typeof value === 'string' &&
      bibliographyMatchesPath(sourceFile, value, oldPath)
    ) {
      return getFileRelativePath(sourceFile, newPath);
    }

    return value;
  };

  if (Array.isArray(bibliography)) {
    let changed = false;
    const updated = bibliography.map((value) => {
      const next = getUpdatedPath(value);
      changed ||= next !== value;
      return next;
    });

    return changed ? updated : bibliography;
  }

  return getUpdatedPath(bibliography);
}

export default class ReferenceList extends Plugin {
  settings: ReferenceListSettings;
  emitter: Events;
  tooltipManager: TooltipManager;
  bibManager: BibManager;
  private citeSuggest: CiteSuggest;
  cacheDir = '.pandoc';
  _initPromise: PromiseCapability<void>;
  private processReferencesRun = 0;

  get initPromise() {
    if (!this._initPromise) {
      return (this._initPromise = new PromiseCapability());
    }
    return this._initPromise;
  }

  async onload() {
    const { app } = this;

    await this.loadSettings();

    this.registerView(
      viewType,
      (leaf: WorkspaceLeaf) => new ReferenceListView(leaf, this)
    );

    this.emitter = new Events();
    this.bibManager = new BibManager(this);

    console.log('[bcs:main] loaded settings:', JSON.stringify({
      bibliographyPaths: this.settings.bibliographyPaths,
      pullFromZotero: this.settings.pullFromZotero,
      zoteroGroups: this.settings.zoteroGroups,
      useNativeZoteroAPI: this.settings.useNativeZoteroAPI,
      zoteroPort: this.settings.zoteroPort,
      enableCiteKeyCompletion: this.settings.enableCiteKeyCompletion,
    }));

    this.initPromise.promise
      .then(async () => {
        const { settings, bibManager } = this;
        console.log('[bcs:main] initPromise.then fired — starting bib load');
        // Load sources in priority order: .bib first (lower priority),
        // Zotero on top (higher priority, wins on conflicts).
        if (settings.bibliographyPaths?.length) {
          await bibManager.loadGlobalBibFiles();
        } else {
          console.log('[bcs:main] no bibliographyPaths set, skipping .bib load');
        }
        if (settings.pullFromZotero) {
          await bibManager.loadAndRefreshGlobalZBib();
        } else {
          console.log('[bcs:main] pullFromZotero not set, skipping Zotero load');
        }
        // Build the Fuse index now so @ autocomplete is available immediately,
        // before the (slower) CSL engine compilation below.
        bibManager.buildFuseIndex();
        // Build the CSL engine once, after all sources are merged.
        await bibManager.buildGlobalEngine();
        console.log('[bcs:main] bib load complete, bibManager.initPromise resolving');
        // Incremental Zotero refresh runs async after the engine is ready.
        if (settings.pullFromZotero) {
          bibManager.refreshGlobalZBib().catch(console.error);
        }
      })
      .finally(() => this.bibManager.initPromise.resolve());

    this.addSettingTab(new ReferenceListSettingsTab(this));
    this.citeSuggest = new CiteSuggest(app, this);
    this.registerEditorSuggest(this.citeSuggest);
    this.applyPrioritizeSetting();
    this.tooltipManager = new TooltipManager(this);
    this.registerMarkdownPostProcessor(processCiteKeys(this));
    this.registerEditorExtension([
      bibManagerField.init(() => this.bibManager),
      citeKeyCacheField,
      citeKeyPlugin,
      editorTooltipHandler(this.tooltipManager),
    ]);

    // Attempt to auto-detect Pandoc on desktop if not already configured.
    findPandoc().then((found) => {
      if (found && !this.settings.pathToPandoc) {
        this.settings.pathToPandoc = found;
        this.saveSettings();
      }
    });

    this.initPromise.resolve();
    this.app.workspace.trigger('parse-style-settings');

    // Open the reference panel if it isn't already present (e.g. first launch,
    // or mobile where workspace state isn't always persisted between sessions).
    this.app.workspace.onLayoutReady(() => {
      if (!this.view) this.initLeaf();
    });

    this.addCommand({
      id: 'focus-reference-list-view',
      name: t('Show reference list'),
      callback: async () => {
        this.initLeaf();
      },
    });

    this.addCommand({
      id: 'insert-bibliography',
      name: t('Insert bibliography at cursor'),
      editorCallback: (editor: Editor, view: MarkdownView) => {
        if (!view.file) return;
        const cache = this.bibManager.fileCache.get(view.file);
        if (!cache?.bib) return;

        const entries = cache.bib.findAll('.csl-entry');
        if (!entries.length) return;

        const text = entries
          .map((e) => htmlToMarkdown(e.innerHTML).trim())
          .join('\n\n');

        editor.replaceSelection(text);
      },
    });

    this.addCommand({
      id: 'snapshot-bibliography',
      name: t('Save bibliography snapshot for this note'),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) return false;
        const entries = this.bibManager.snapshotEntries(view.file);
        if (!entries?.length) return false;
        if (!checking) this.openSnapshot(view.file, entries);
        return true;
      },
    });

    document.body.toggleClass(
      'bcs-tooltips',
      this.settings.showCitekeyTooltips !== false
    );
    document.body.toggleClass(
      'bcs-decorations',
      this.settings.showCitationDecorations ?? true
    );

    this.registerEvent(
      app.metadataCache.on(
        'changed',
        debounce(
          async (file) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            const activeView = app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && file === activeView.file) {
              this.processReferences();
            }
          },
          100,
          true
        )
      )
    );

    this.registerEvent(
      app.workspace.on(
        'active-leaf-change',
        debounce(
          async (leaf) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            app.workspace.iterateRootLeaves((rootLeaf) => {
              if (rootLeaf === leaf) {
                if (leaf.view instanceof MarkdownView) {
                  this.processReferences();
                } else {
                  this.view?.setNoContentMessage();
                }
              }
            });
          },
          100,
          true
        )
      )
    );

    this.registerEvent(
      app.vault.on(
        'rename',
        debounce(
          async (file, oldPath) => {
            await this.initPromise.promise;
            await this.bibManager.initPromise.promise;

            if (isBibliographyFile(file)) {
              await this.updateBibliographyFrontmatter(oldPath, file.path);
            }

            const activeView = app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView?.file instanceof TFile) {
              this.bibManager.fileCache.delete(activeView.file);
              this.processReferences();
            }
          },
          100,
          true
        )
      )
    );

    (async () => {
      this.initStatusBar();
      this.setStatusBarLoading();

      await this.initPromise.promise;
      await this.bibManager.initPromise.promise;

      this.setStatusBarIdle();
      this.processReferences();
    })();
  }

  onunload() {
    document.body.removeClass('bcs-tooltips');
    this.app.workspace
      .getLeavesOfType(viewType)
      .forEach((leaf) => leaf.detach());
    this.bibManager.destroy();
  }

  async updateBibliographyFrontmatter(oldPath: string, newPath: string) {
    oldPath = normalizePath(oldPath);
    newPath = normalizePath(newPath);

    for (const file of this.app.vault.getMarkdownFiles()) {
      const metadata = this.app.metadataCache.getFileCache(file);
      if (!metadata?.frontmatter?.bibliography) continue;

      let changed = false;
      try {
        await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
          const nextBibliography = updateBibliographyPath(
            file,
            frontmatter.bibliography,
            oldPath,
            newPath
          );

          if (nextBibliography !== frontmatter.bibliography) {
            frontmatter.bibliography = nextBibliography;
            changed = true;
          }
        });

        if (changed) {
          this.bibManager.fileCache.delete(file);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  statusBarIcon: HTMLElement;
  initStatusBar() {
    const ico = (this.statusBarIcon = this.addStatusBarItem());
    ico.addClass('bcs-status-icon', 'clickable-icon');
    ico.setAttr('aria-label', t('Bripey Citation Suite settings'));
    ico.setAttr('data-tooltip-position', 'top');
    this.setStatusBarIdle();
    let isOpen = false;
    ico.addEventListener('click', () => {
      if (isOpen) return;
      const { settings } = this;
      const menu = (new Menu() as any)
        .addSections(['settings', 'actions'])
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-message-square')
            .setTitle(t('Show citekey tooltips'))
            .setChecked(!!settings.showCitekeyTooltips)
            .onClick(() => {
              this.settings.showCitekeyTooltips = !settings.showCitekeyTooltips;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('settings')
            .setIcon('lucide-at-sign')
            .setTitle(t('Show citekey suggestions'))
            .setChecked(!!settings.enableCiteKeyCompletion)
            .onClick(() => {
              this.settings.enableCiteKeyCompletion =
                !settings.enableCiteKeyCompletion;
              this.saveSettings();
            })
        )
        .addItem((item: any) =>
          item
            .setSection('actions')
            .setIcon('lucide-rotate-cw')
            .setTitle(t('Refresh bibliography'))
            .onClick(async () => {
              const activeView =
                this.app.workspace.getActiveViewOfType(MarkdownView);
              if (activeView) {
                const file = activeView.file;

                if (this.bibManager.fileCache.has(file)) {
                  const cache = this.bibManager.fileCache.get(file);
                  if (cache.source !== this.bibManager) {
                    this.bibManager.fileCache.delete(file);
                    this.processReferences();
                    return;
                  }
                }
              }

              this.bibManager.reinit(true);
              await this.bibManager.initPromise.promise;
              this.processReferences();
            })
        );

      const rect = ico.getBoundingClientRect();
      menu.onHide(() => {
        isOpen = false;
      });
      menu.setParentElement(ico).showAtPosition({
        x: rect.x,
        y: rect.top - 5,
        width: rect.width,
        overlap: true,
        left: false,
      });
      isOpen = true;
    });
  }

  setStatusBarLoading() {
    this.statusBarIcon.addClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-loader');
  }

  setStatusBarIdle() {
    this.statusBarIcon.removeClass('is-loading');
    setIcon(this.statusBarIcon, 'lucide-at-sign');
  }

  get view() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return null;
    const v = leaves[0].view;
    return v instanceof ReferenceListView ? v : null;
  }

  async initLeaf() {
    if (this.view) return this.revealLeaf();

    // getRightLeaf(false) can return null on mobile or when the workspace
    // isn't fully ready yet — guard before chaining .setViewState().
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({ type: viewType });

    this.revealLeaf();

    await this.initPromise.promise;
    await this.bibManager.initPromise.promise;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.processReferences();
    }
  }

  revealLeaf() {
    const leaves = this.app.workspace.getLeavesOfType(viewType);
    if (!leaves?.length) return;
    this.app.workspace.revealLeaf(leaves[0]);
  }

  async loadSettings() {
    const saved = (await this.loadData()) ?? {};

    // Migration: these settings defaulted to false in older builds due to a bug
    // (undefined was treated as false in the UI, so the toggle appeared off and
    // may have been saved as false). Since the feature was never reliably on,
    // we reset any saved false so the new default (true) takes effect.
    // Users who intentionally disable these can still do so via the settings tab.
    if (saved.enableCiteKeyCompletion === false) delete saved.enableCiteKeyCompletion;
    if (saved.showCitekeyTooltips === false) delete saved.showCitekeyTooltips;

    // Migrate single pathToBibliography → bibliographyPaths array.
    if (saved.pathToBibliography && !saved.bibliographyPaths?.length) {
      saved.bibliographyPaths = [saved.pathToBibliography];
      delete saved.pathToBibliography;
    }

    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  }

  // Move CiteSuggest to the front of Obsidian's shared EditorSuggest queue
  // (so it wins `@` over other plugins) or to the back (so it yields).
  // Called on load and whenever the prioritizeCiteKeyCompletion setting changes.
  // Reorders in-place so registerEditorSuggest's cleanup reference stays valid.
  private applyPrioritizeSetting() {
    const suggests = (this.app.workspace as any).editorSuggest?.suggests as unknown[] | undefined;
    if (!Array.isArray(suggests) || !this.citeSuggest) return;
    const idx = suggests.indexOf(this.citeSuggest);
    if (idx === -1) return;
    if (this.settings.prioritizeCiteKeyCompletion !== false) {
      if (idx > 0) { suggests.splice(idx, 1); suggests.unshift(this.citeSuggest); }
    } else {
      if (idx === 0) { suggests.splice(idx, 1); suggests.push(this.citeSuggest); }
    }
  }

  async saveSettings(cb?: () => void) {
    document.body.toggleClass(
      'bcs-tooltips',
      this.settings.showCitekeyTooltips !== false
    );
    document.body.toggleClass(
      'bcs-decorations',
      this.settings.showCitationDecorations ?? true
    );

    this.applyPrioritizeSetting();

    // Refresh the reference list when settings change
    this.emitSettingsUpdate(cb);
    await this.saveData(this.settings);
  }

  emitSettingsUpdate = debounce(
    (cb?: () => void) => {
      if (this.initPromise.settled) {
        this.view?.contentEl.toggleClass(
          'collapsed-links',
          !!this.settings.hideLinks
        );

        cb && cb();

        this.processReferences();
      }
    },
    5000,
    true
  );

  openSnapshot(file: TFile, entries: import('./bib/types').PartialCSLEntry[]) {
    new BibSnapshotModal(this.app, this, file, entries).open();
  }

  processReferences = async () => {
    const run = ++this.processReferencesRun;
    const isCurrent = () => run === this.processReferencesRun;
    const { settings, view } = this;
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const scopedSettings = activeView
      ? getScopedSettings(activeView.file)
      : null;

    if (
      !settings.bibliographyPaths?.length &&
      !settings.pullFromZotero &&
      !scopedSettings?.bibliography?.length
    ) {
      return view?.setMessage(
        t(
          'Please provide the path to your bibliography file in the Bripey Citation Suite plugin settings.'
        )
      );
    }

    if (activeView) {
      try {
        const fileContent = await this.app.vault.cachedRead(activeView.file);
        if (!isCurrent()) return;
        const bib = await this.bibManager.getReferenceList(
          activeView.file,
          fileContent,
          isCurrent
        );
        if (!isCurrent()) return;
        const cache = this.bibManager.fileCache.get(activeView.file);

        // Only warn about Zotero being unreachable when there is no .bib
        // fallback and some keys are genuinely unresolved.
        if (
          !bib &&
          settings.pullFromZotero &&
          !settings.bibliographyPaths?.length &&
          !(await this.bibManager.isZoteroAvailable()) &&
          isCurrent() &&
          cache?.keys.size
        ) {
          view?.setMessage(t('Cannot connect to Zotero'));
        } else {
          view?.setViewContent(bib);
        }
      } catch (e) {
        console.error(e);
        view?.setMessage((e as Error).message);
      }
    } else {
      view?.setNoContentMessage();
    }
  };
}

/** Modal that lets the user choose a filename and location for the snapshot,
 *  then writes the CSL-JSON file and wires it into the note's frontmatter. */
class BibSnapshotModal extends Modal {
  private plugin: ReferenceList;
  private file: TFile;
  private entries: import('./bib/types').PartialCSLEntry[];

  constructor(
    app: import('obsidian').App,
    plugin: ReferenceList,
    file: TFile,
    entries: import('./bib/types').PartialCSLEntry[]
  ) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.entries = entries;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: t('Save bibliography snapshot') });
    contentEl.createEl('p', {
      text: t(
        `${this.entries.length} entries will be saved as CSL JSON. The file path will be added to this note's frontmatter "bibliography" key.`
      ),
    });

    const folder = this.file.parent?.path ?? '';
    const stem = this.file.basename;
    const defaultPath = normalizePath(
      (folder ? folder + '/' : '') + stem + '-bibliography.json'
    );

    const inputWrap = contentEl.createDiv({ cls: 'bcs-snapshot-input-wrap' });
    inputWrap.createEl('label', { text: t('Save as') });
    const input = inputWrap.createEl('input', {
      type: 'text',
      value: defaultPath,
      cls: 'bcs-snapshot-input',
    });
    input.style.width = '100%';

    const btnRow = contentEl.createDiv({ cls: 'bcs-snapshot-btn-row' });
    btnRow.style.display = 'flex';
    btnRow.style.justifyContent = 'flex-end';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '12px';

    const cancelBtn = btnRow.createEl('button', { text: t('Cancel') });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = btnRow.createEl('button', {
      text: t('Save'),
      cls: 'mod-cta',
    });
    saveBtn.addEventListener('click', () => this.doSave(input.value.trim()));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doSave(input.value.trim());
      if (e.key === 'Escape') this.close();
    });

    setTimeout(() => { input.select(); }, 50);
  }

  private async doSave(rawPath: string) {
    if (!rawPath) return;
    const savePath = normalizePath(rawPath);

    try {
      // Ensure parent directory exists.
      const dir = savePath.includes('/')
        ? savePath.substring(0, savePath.lastIndexOf('/'))
        : '';
      if (dir && !(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }

      // Write CSL JSON (strip internal _source/_dateModified fields).
      const clean = this.entries.map(({ _source, _dateModified, ...rest }: any) => rest);
      await this.app.vault.adapter.write(savePath, JSON.stringify(clean, null, 2));

      // Compute vault-relative path for the frontmatter link.
      const noteDir = this.file.parent?.path ?? '';
      const relPath = noteDir
        ? normalizePath(savePath).replace(normalizePath(noteDir) + '/', '')
        : savePath;

      // Add / append to the frontmatter bibliography array.
      await this.app.fileManager.processFrontMatter(this.file, (fm) => {
        const existing: string[] = Array.isArray(fm.bibliography)
          ? fm.bibliography
          : fm.bibliography
          ? [fm.bibliography]
          : [];
        if (!existing.includes(relPath) && !existing.includes(savePath)) {
          existing.push(relPath);
        }
        fm.bibliography = existing.length === 1 ? existing[0] : existing;
      });

      new Notice(t(`Bibliography saved to ${savePath}`));
      this.plugin.bibManager.reinit(true);
      this.close();
    } catch (e) {
      new Notice(t(`Failed to save bibliography: ${(e as Error).message}`));
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
