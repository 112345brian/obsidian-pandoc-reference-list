import { Platform, PluginSettingTab, Setting } from 'obsidian';

import { t } from './lang/helpers';
import { findPandoc } from './bib/pandoc';
import { isZotLitSuggestActive } from './zotlit';
import ReferenceList from './main';
import ReactDOM from 'react-dom';
import React from 'react';
import { SettingItem } from './settings/SettingItem';
import { SearchSelect } from './settings/SearchSelect';
import { searchCSL, searchCSLLangs } from './settings/select.helpers';
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
  tooltipDelay: number;
  enableCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;

  literatureNoteFolder?: string;
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
          'Path to your bibliography file (.bib, .json, or .yaml). Can be vault-relative (e.g. references.bib) or absolute. Can be overridden per-note via the "bibliography" frontmatter key.'
        )
      )
      .then((setting) => {
        setting.addText((text) => {
          text
            .setValue(this.plugin.settings.pathToBibliography ?? '')
            .onChange((value) => {
              this.plugin.settings.pathToBibliography = value;
              this.plugin.saveSettings(() =>
                this.plugin.bibManager.reinit(true)
              );
            });
        });
      });

    ReactDOM.render(
      <ZoteroPullSetting plugin={this.plugin} />,
      containerEl.createDiv('setting-item pwc-setting-item-wrapper')
    );

    const defaultStyle = cslListRaw.find(
      (item) => item.value === this.plugin.settings.cslStyleURL
    );

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
      containerEl.createDiv('pwc-setting-item setting-item')
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
      containerEl.createDiv('pwc-setting-item setting-item')
    );

    new Setting(containerEl)
      .setName(t('Literature notes folder'))
      .setDesc(
        t(
          'Folder where new literature notes are created (vault-relative). Leave blank to create at the vault root. A "Create literature note" button appears on sidebar entries when no note exists. Has no effect when ZotLit is installed — use ZotLit\'s template system instead.'
        )
      )
      .addText((text) =>
        text
          .setPlaceholder('Literature Notes')
          .setValue(this.plugin.settings.literatureNoteFolder ?? '')
          .onChange((value) => {
            this.plugin.settings.literatureNoteFolder = value;
            this.plugin.saveSettings();
          })
      );

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
  }
}
