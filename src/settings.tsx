import { FuzzySuggestModal, Platform, PluginSettingTab, Setting, TFile } from 'obsidian';

import { t } from './lang/helpers';
import { findPandoc } from './bib/pandoc';
import { getBibPath } from './bib/helpers';
import { isZotLitSuggestActive } from './zotlit';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import { SearchSelect } from './settings/SearchSelect';
import { searchCSL, searchCSLLangs } from './settings/select.helpers';
import { FolderSuggest } from './settings/FolderSuggest';
import { BibFileSuggest } from './settings/BibFileSuggest';
import { cslListRaw } from './bib/cslList';
import { langListRaw } from './bib/cslLangList';
import { ZoteroPullSetting } from './settings/ZoteroPullSetting';

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  pathToPandoc: '',
  tooltipDelay: 400,
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
  showCitationDecorations: true,
  mobileClickAction: 'show',
  enableCiteKeyCompletion: true,
  prioritizeCiteKeyCompletion: true,
  showCitekeyTooltips: true,
};

export interface ZoteroGroup {
  id: number;
  name: string;
  lastUpdate?: number;
  /** Library version used for incremental sync with the native Zotero API. */
  libraryVersion?: number;
}

export interface ReferenceListSettings {
  pathToPandoc?: string;
  pathToBibliography?: string;

  cslStyleURL?: string;
  cslStylePath?: string;
  cslLang?: string;

  hideLinks?: boolean;
  showCitekeyTooltips?: boolean;
  showCitationDecorations?: boolean;
  tooltipDelay: number;
  enableCiteKeyCompletion?: boolean;
  prioritizeCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;

  literatureNoteFolder?: string;
  /** Action to take when a citation is tapped on mobile (no hover available). */
  mobileClickAction?: 'show' | 'copy' | 'link';
  pullFromZotero?: boolean;
  zoteroPort?: string;
  zoteroGroups: ZoteroGroup[];
  /**
   * When true, use the standard Zotero local REST API (Zotero 7/8 native
   * citationKey field) instead of the Better BibTeX JSON-RPC endpoint.
   * Better BibTeX does not need to be installed when this is enabled.
   */
  useNativeZoteroAPI?: boolean;
}

const BIB_EXTENSIONS = new Set(['bib', 'json', 'yaml', 'yml']);

/**
 * Mobile vault file picker — opens a fuzzy-search modal over all vault files
 * with bibliography-compatible extensions. Calls `onChoose` with the selected
 * vault-relative path. Used as the browse-button action on mobile where the
 * OS file picker can't return a stable file-system path.
 */
class BibFilePickerModal extends FuzzySuggestModal<TFile> {
  constructor(private onChoose: (path: string) => void) {
    super(app);
    this.setPlaceholder(t('Search…'));
  }

  getItems(): TFile[] {
    return app.vault
      .getFiles()
      .filter((f) => BIB_EXTENSIONS.has(f.extension))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file.path);
  }
}

export class ReferenceListSettingsTab extends PluginSettingTab {
  plugin: ReferenceList;

  constructor(plugin: ReferenceList) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Pandoc is optional — the plugin uses a built-in JS parser by default.
    // Set this path if you need Pandoc's higher-fidelity .bib/.yaml handling
    // (e.g. @string macros, unusual encodings). Desktop only.
    if (Platform.isDesktop) {
      new Setting(containerEl)
        .setName(t('Path to Pandoc (optional)'))
        .setDesc(
          t(
            'Absolute path to the Pandoc executable. When set, Pandoc is used to convert .bib/.yaml files instead of the built-in parser. Leave blank to use the built-in parser (works on all platforms).'
          )
        )
        .then((setting) => {
          let inputEl: HTMLInputElement;
          setting.addText((text) => {
            inputEl = text.inputEl;
            text
              .setPlaceholder('/usr/local/bin/pandoc')
              .setValue(this.plugin.settings.pathToPandoc ?? '')
              .onChange((value) => {
                this.plugin.settings.pathToPandoc = value;
                this.plugin.saveSettings();
              });
          });

          setting.addExtraButton((b) => {
            b.setIcon('magnifying-glass');
            b.setTooltip(t('Auto-detect Pandoc'));
            b.onClick(async () => {
              const found = await findPandoc();
              if (found) {
                inputEl.value = found;
                this.plugin.settings.pathToPandoc = found;
                this.plugin.saveSettings();
              }
            });
          });
        });
    }

    new Setting(containerEl)
      .setName(t('Path to bibliography file'))
      .setDesc(
        t(
          'Path to your bibliography file (.bib, .json, or .yaml). Vault-relative paths (e.g. references.bib) work on all platforms. Absolute paths work on desktop only. On blur, absolute paths inside the vault are automatically shortened to vault-relative. Can be overridden per-note via the "bibliography" frontmatter key.'
        )
      )
      .then((setting) => {
        let inputEl: HTMLInputElement;

        setting.addText((text) => {
          inputEl = text.inputEl;
          text
            .setValue(this.plugin.settings.pathToBibliography ?? '')
            .onChange((value) => {
              this.plugin.settings.pathToBibliography = value;
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(true)
              );
            });

          // Vault-file autocomplete — works on all platforms.
          new BibFileSuggest(this.app, text.inputEl);

          // On blur, resolve the path and normalise it to the canonical form.
          // For example, an absolute path inside the vault becomes vault-relative.
          text.inputEl.addEventListener('blur', async () => {
            const raw = text.inputEl.value.trim();
            if (!raw) return;
            try {
              const resolved = await getBibPath(raw);
              if (resolved !== raw) {
                text.setValue(resolved);
                this.plugin.settings.pathToBibliography = resolved;
                this.plugin.saveSettings();
              }
            } catch {
              // Path unresolvable — leave as-is so the user can see and fix it.
            }
          });
        });

        // Browse button: native OS picker on desktop, vault modal on mobile.
        setting.addExtraButton((btn) => {
          btn.setIcon('folder-open').setTooltip(t('Browse…'));
          btn.onClick(() => {
            if (Platform.isDesktop) {
              // Desktop (Electron): a hidden <input type="file"> surfaces the
              // OS file picker and exposes a non-standard `.path` property on
              // the selected File object — no Electron API imports needed.
              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              fileInput.accept = '.bib,.json,.yaml,.yml';
              fileInput.onchange = async () => {
                const file = fileInput.files?.[0];
                const fsPath: string | undefined = (file as any)?.path;
                if (!fsPath) return;

                // Normalise: absolute → vault-relative when the file is inside the vault.
                let resolved = fsPath;
                try { resolved = await getBibPath(fsPath); } catch { /* keep absolute */ }

                inputEl.value = resolved;
                inputEl.dispatchEvent(new Event('input')); // triggers onChange → save
                this.plugin.settings.pathToBibliography = resolved;
                this.plugin.saveSettings(() => this.plugin.bibManager.reinit(true));
              };
              fileInput.click();
            } else {
              // Mobile: the OS file picker can't return a stable file-system path,
              // so open a vault file picker modal instead. Only vault-relative paths
              // (synced via Obsidian Sync / iCloud / etc.) make sense on mobile.
              new BibFilePickerModal((path) => {
                inputEl.value = path;
                inputEl.dispatchEvent(new Event('input'));
                this.plugin.settings.pathToBibliography = path;
                this.plugin.saveSettings(() => this.plugin.bibManager.reinit(true));
              }).open();
            }
          });
        });
      });

    ReactDOM.render(
      <ZoteroPullSetting plugin={this.plugin} />,
      containerEl.createDiv('setting-item bcs-setting-item-wrapper')
    );

    const configuredStyle = this.plugin.settings.cslStyleURL;
    const defaultStyle =
      cslListRaw.find((item) => item.value === configuredStyle) ||
      (configuredStyle
        ? { value: configuredStyle, label: configuredStyle }
        : undefined);

    ReactDOM.render(
      <SettingItem name={t('Citation style')}>
        <SearchSelect
          placeholder={t('Search...')}
          defaultValue={defaultStyle}
          search={searchCSL}
          isClearable
          onChange={(selection) => {
            this.plugin.settings.cslStyleURL = selection?.value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          }}
        />
      </SettingItem>,
      containerEl.createDiv('bcs-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Custom citation style'))
      .setDesc(
        t(
          'Path to a CSL file (vault-relative or absolute). Overrides the style selected above. Can be overridden per-note via the "csl" or "citation-style" frontmatter key. A URL can be supplied when setting the style via frontmatter.'
        )
      )
      .then((setting) => {
        setting.addText((text) => {
          text.setValue(this.plugin.settings.cslStylePath ?? '').onChange((value) => {
            this.plugin.settings.cslStylePath = value;
            this.plugin.saveSettings(() =>
              this.plugin.bibManager.reinit(false)
            );
          });
        });
      });

    const defaultLanguage = langListRaw.find(
      (item) => item.value === this.plugin.settings.cslLang
    );

    ReactDOM.render(
      <SettingItem
        name={t('Citation style language')}
        description={
          <>
            {t(
              `This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file's frontmatter. A language code must be used when setting the language via frontmatter.`
            )}{' '}
            <a
              href="https://github.com/citation-style-language/locales/blob/master/locales.json"
              target="_blank"
            >
              {t('See here for a list of available language codes')}
            </a>
            .
          </>
        }
      >
        <SearchSelect
          placeholder={t('Search...')}
          defaultValue={defaultLanguage}
          search={searchCSLLangs}
          isClearable
          onChange={(selection) => {
            if (selection) {
              this.plugin.settings.cslLang = selection.value;
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(false)
              );
            }
          }}
        />
      </SettingItem>,
      containerEl.createDiv('bcs-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Literature notes folder'))
      .setDesc(
        t(
          'Folder where new literature notes are created (vault-relative). Leave blank to create at the vault root. A "Create literature note" button appears on sidebar entries when no note exists. Has no effect when ZotLit is installed — use ZotLit\'s template system instead.'
        )
      )
      .addText((text) => {
        text
          .setPlaceholder('Literature Notes')
          .setValue(this.plugin.settings.literatureNoteFolder ?? '')
          .onChange((value) => {
            this.plugin.settings.literatureNoteFolder = value;
            this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName(t('Hide links in references'))
      .setDesc(t('Replace links with link icons to save space.'))
      .addToggle((text) =>
        text.setValue(!!this.plugin.settings.hideLinks).onChange((value) => {
          this.plugin.settings.hideLinks = value;
          this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t('Render live preview inline citations'))
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in live preview mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitations)
          .onChange((value) => {
            this.plugin.settings.renderCitations = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Render reading mode inline citations'))
      .setDesc(
        t(
          'Convert [@pandoc] citations to formatted inline citations in reading mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderCitationsReadingMode)
          .onChange((value) => {
            this.plugin.settings.renderCitationsReadingMode = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Process citations in links'))
      .setDesc(
        t(
          'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.renderLinkCitations)
          .onChange((value) => {
            this.plugin.settings.renderLinkCitations = value;
            this.plugin.saveSettings();
          })
      );

    const zotlitActive = isZotLitSuggestActive(this.app);
    new Setting(containerEl)
      .setName(t('Show citekey suggestions'))
      .setDesc(
        zotlitActive
          ? t(
              'ZotLit detected — [@key completions are handled by ZotLit. This plugin still provides bare @key suggestions (outside brackets) and for .bib file entries.'
            )
          : t(
              'When enabled, an autocomplete dialog will display when typing citation keys.'
            )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.enableCiteKeyCompletion)
          .onChange((value) => {
            this.plugin.settings.enableCiteKeyCompletion = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Prioritize citation completion'))
      .setDesc(
        t(
          'Move the citation autocomplete suggester to the front of Obsidian\'s internal queue so it wins when multiple plugins respond to "@". Disable this if another plugin\'s "@" completions stop working.'
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.prioritizeCiteKeyCompletion ?? true)
          .onChange((value) => {
            this.plugin.settings.prioritizeCiteKeyCompletion = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Citation decoration'))
      .setDesc(
        t(
          'Highlight citation keys with colors and underlines in the editor. Colors and underline styles can be customized with the Style Settings plugin.'
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showCitationDecorations ?? true)
          .onChange((value) => {
            this.plugin.settings.showCitationDecorations = value;
            this.plugin.saveSettings();
          })
      );

    {
      const row = containerEl.createDiv({ cls: 'setting-item' });
      const info = row.createDiv({ cls: 'setting-item-info' });
      info.createDiv({ cls: 'setting-item-name', text: t('Preview') });
      info.createDiv({
        cls: 'setting-item-description',
        text: t('citation · wikilink citation · unresolved'),
      });
      const control = row.createDiv({ cls: 'setting-item-control' });
      const preview = control.createDiv({
        cls: 'bcs-decorations bcs-decoration-preview',
      });

      // [@smith2020] — resolved citation
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting bracket', text: '[' });
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting at is-resolved', text: '@' });
      preview.createSpan({ cls: 'cm-pandoc-citation pandoc-citation is-resolved', text: 'smith2020' });
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting bracket', text: ']' });

      preview.createSpan({ cls: 'bcs-preview-sep', text: '·' });

      // [[@jones2021]] — wikilink citation (shown as rendered widget)
      preview.createSpan({ cls: 'pandoc-citation is-resolved is-link', text: '(Jones, 2021)' });

      preview.createSpan({ cls: 'bcs-preview-sep', text: '·' });

      // [@unknown] — unresolved
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting bracket', text: '[' });
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting at is-unresolved', text: '@' });
      preview.createSpan({ cls: 'cm-pandoc-citation pandoc-citation is-unresolved', text: 'unknown' });
      preview.createSpan({ cls: 'cm-pandoc-citation-formatting bracket', text: ']' });
    }

    new Setting(containerEl)
      .setName(t('Show citekey tooltips'))
      .setDesc(
        t(
          'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.'
        )
      )
      .addToggle((text) =>
        text
          .setValue(!!this.plugin.settings.showCitekeyTooltips)
          .onChange((value) => {
            this.plugin.settings.showCitekeyTooltips = value;
            this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t('Tooltip delay'))
      .setDesc(
        t(
          'Set the amount of time (in milliseconds) to wait before displaying tooltips.'
        )
      )
      .addSlider((slider) => {
        slider
          .setDynamicTooltip()
          .setLimits(0, 7000, 100)
          .setValue(this.plugin.settings.tooltipDelay)
          .onChange((value) => {
            this.plugin.settings.tooltipDelay = value;
            this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t('Mobile tap action'))
      .setDesc(
        t(
          'What happens when you tap a citation on mobile. On desktop, hover tooltips are used instead.'
        )
      )
      .addDropdown((dd) =>
        dd
          .addOption('show', t('Show citation info'))
          .addOption('copy', t('Copy citation to clipboard'))
          .addOption('link', t('Open link (Zotero → PDF → URL)'))
          .setValue(this.plugin.settings.mobileClickAction ?? 'show')
          .onChange((value) => {
            this.plugin.settings.mobileClickAction = value as 'show' | 'copy' | 'link';
            this.plugin.saveSettings();
          })
      );
  }
}
