import { ItemView, MarkdownView, WorkspaceLeaf, setIcon } from 'obsidian';

import { copyElToClipboard } from './helpers';
import { t } from './lang/helpers';
import ReferenceList from './main';

export const viewType = 'ReferenceListView';

export class ReferenceListView extends ItemView {
  plugin: ReferenceList;
  activeMarkdownLeaf: MarkdownView;

  constructor(leaf: WorkspaceLeaf, plugin: ReferenceList) {
    super(leaf);
    this.plugin = plugin;

    this.contentEl.addClass('bcs-reference-list');
    this.contentEl.toggleClass(
      'collapsed-links',
      !!this.plugin.settings.hideLinks
    );
    this.setNoContentMessage();
  }

  setViewContent(bib: HTMLElement) {
    if (bib && this.contentEl.firstChild !== bib) {
      let count = 0;
      const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const unresolvedCount = activeView?.file
        ? this.plugin.bibManager.fileCache.get(activeView.file)?.unresolvedKeys
            .size ?? 0
        : 0;
      bib.findAll('.csl-entry').forEach((e) => {
        count++;
        const leafRoot = this.leaf.getRoot();
        if (leafRoot) {
          const tooltipPos =
            (leafRoot as any).side === 'right' ? 'left' : 'right';
          e.setAttribute('aria-label-position', tooltipPos);
        }
      });

      this.contentEl.empty();
      this.contentEl.createDiv(
        {
          cls: 'bcs-reference-list__title',
        },
        (div) => {
          div.createDiv({ text: this.getDisplayText() });
          div.createDiv({}, (div) => {
            if (count) {
              div.createDiv({
                cls: 'bcs-reference-list__count',
                text: count.toString(),
              });
            }
            if (unresolvedCount) {
              div.createDiv({
                cls: 'bcs-reference-list__unresolved-count',
                text: unresolvedCount.toString(),
                attr: {
                  'aria-label': t('Unresolved citations'),
                },
              });
            }
            div.createDiv(
              {
                cls: 'clickable-icon',
                attr: {
                  'aria-label': t('Copy list'),
                },
              },
              (btn) => {
                setIcon(btn, 'lucide-copy');
                btn.onClickEvent(() => copyElToClipboard(bib));
              }
            );
          });
        }
      );

      if (count > 1) {
        const searchWrap = this.contentEl.createDiv({ cls: 'bcs-search-wrap' });
        const input = searchWrap.createEl('input', {
          cls: 'bcs-search-input',
          attr: { type: 'search', placeholder: t('Filter references…') },
        });
        input.addEventListener('input', () => {
          const q = input.value.toLowerCase().trim();
          bib.findAll('.csl-entry-wrapper').forEach((wrapper) => {
            const visible = !q || (wrapper.textContent ?? '').toLowerCase().includes(q);
            (wrapper as HTMLElement).style.display = visible ? '' : 'none';
          });
        });
      }

      this.contentEl.append(bib);
    } else if (!bib) {
      this.setNoContentMessage();
    }
  }

  setNoContentMessage() {
    this.setMessage(t('No citations found in the current document.'));
  }

  setMessage(message: string) {
    this.contentEl.empty();
    this.contentEl.createDiv({
      cls: 'pane-empty',
      text: message,
    });
  }

  getViewType() {
    return viewType;
  }

  getDisplayText() {
    return t('References');
  }

  getIcon() {
    return 'quote-glyph';
  }
}
