import { AbstractInputSuggest, TFile } from 'obsidian';

const BIB_EXTENSIONS = new Set(['bib', 'json', 'yaml', 'yml']);

/**
 * Attaches a file-autocomplete dropdown to the bibliography path input.
 * Only surfaces files with bibliography-compatible extensions from the vault,
 * so it acts as an in-vault file picker that works on all platforms.
 *
 * Usage:
 *   new BibFileSuggest(app, text.inputEl);
 */
export class BibFileSuggest extends AbstractInputSuggest<TFile> {
  getSuggestions(query: string): TFile[] {
    const q = query.toLowerCase().trim();
    return app.vault
      .getFiles()
      .filter(
        (f) =>
          BIB_EXTENSIONS.has(f.extension) &&
          (q === '' || f.path.toLowerCase().includes(q))
      )
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    // Trigger onChange so the setting is saved immediately.
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
