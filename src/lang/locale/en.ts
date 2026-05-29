// English

export default {
  // src/settings.ts
  'Path to bibliography file': 'Path to bibliography file',
  'Path to Pandoc (optional)': 'Path to Pandoc (optional)',
  'Absolute path to the Pandoc executable. When set, Pandoc is used to convert .bib/.yaml files instead of the built-in parser. Leave blank to use the built-in parser (works on all platforms).':
    'Absolute path to the Pandoc executable. When set, Pandoc is used to convert .bib/.yaml files instead of the built-in parser. Leave blank to use the built-in parser (works on all platforms).',
  'Auto-detect Pandoc': 'Auto-detect Pandoc',
  'Browse…': 'Browse…',
  'Search…': 'Search…',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.',
  'Path to your bibliography file (.bib, .json, or .yaml). Can be vault-relative (e.g. references.bib) or absolute. Can be overridden per-note via the "bibliography" frontmatter key.':
    'Path to your bibliography file (.bib, .json, or .yaml). Can be vault-relative (e.g. references.bib) or absolute. Can be overridden per-note via the "bibliography" frontmatter key.',
  'Path to your bibliography file (.bib, .json, or .yaml). Vault-relative paths (e.g. references.bib) work on all platforms. Absolute paths work on desktop only. On blur, absolute paths inside the vault are automatically shortened to vault-relative. Can be overridden per-note via the "bibliography" frontmatter key.':
    'Path to your bibliography file (.bib, .json, or .yaml). Vault-relative paths (e.g. references.bib) work on all platforms. Absolute paths work on desktop only. On blur, absolute paths inside the vault are automatically shortened to vault-relative. Can be overridden per-note via the "bibliography" frontmatter key.',
  'Select a bibliography file.': 'Select a bibliography file.',
  'Custom citation style': 'Custom citation style',
  'Citation style': 'Citation style',
  'Citation style language': 'Citation style language',
  'Search...': 'Search...',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.',
  'Path to a CSL file (vault-relative or absolute). Overrides the style selected above. Can be overridden per-note via the "csl" or "citation-style" frontmatter key. A URL can be supplied when setting the style via frontmatter.':
    'Path to a CSL file (vault-relative or absolute). Overrides the style selected above. Can be overridden per-note via the "csl" or "citation-style" frontmatter key. A URL can be supplied when setting the style via frontmatter.',
  'Select a CSL file located on your computer':
    'Select a CSL file located on your computer',
  'Fallback path to Pandoc': 'Fallback path to Pandoc',
  "The absolute path to the Pandoc executable. This plugin will attempt to locate pandoc for you and will use this path if it fails to do so. To find pandoc, use the output of 'which pandoc' in a terminal on Mac/Linux or 'Get-Command pandoc' in powershell on Windows.":
    "The absolute path to the Pandoc executable. This plugin will attempt to locate pandoc for you and will use this path if it fails to do so. To find pandoc, use the output of 'which pandoc' in a terminal on Mac/Linux or 'Get-Command pandoc' in powershell on Windows.",
  'Attempt to find Pandoc automatically':
    'Attempt to find Pandoc automatically',
  'Unable to find pandoc on your system. If it is installed, please manually enter a path.':
    'Unable to find pandoc on your system. If it is installed, please manually enter a path.',
  'Hide links in references': 'Hide links in references',
  'Replace links with link icons to save space.':
    'Replace links with link icons to save space.',
  'Citation decoration': 'Citation decoration',
  'Highlight citation keys with colors and underlines in the editor. Colors and underline styles can be customized with the Style Settings plugin.':
    'Highlight citation keys with colors and underlines in the editor. Colors and underline styles can be customized with the Style Settings plugin.',
  'Preview': 'Preview',
  'citation · wikilink citation · unresolved': 'citation · wikilink citation · unresolved',
  'Show citekey tooltips': 'Show citekey tooltips',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.',
  'Tooltip delay': 'Tooltip delay',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Set the amount of time (in milliseconds) to wait before displaying tooltips.',
  'Validate Pandoc configuration': 'Validate Pandoc configuration',
  Validate: 'Validate',
  'Validation successful': 'Validation successful',
  'Show citekey suggestions': 'Show citekey suggestions',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'When enabled, an autocomplete dialog will display when typing citation keys.',
  'Pull bibliography from Zotero': 'Pull bibliography from Zotero',
  'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file. The Better Bibtex plugin must be installed in Zotero.':
    'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file. The Better Bibtex plugin must be installed in Zotero.',
  'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file.':
    'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file.',
  'Use native Zotero API (Zotero 7/8)': 'Use native Zotero API (Zotero 7/8)',
  'Query the standard Zotero local API directly using the native citationKey field introduced in Zotero 7/8. Better BibTeX is not required when this is enabled.':
    'Query the standard Zotero local API directly using the native citationKey field introduced in Zotero 7/8. Better BibTeX is not required when this is enabled.',
  'Zotero port': 'Zotero port',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.",
  'Render live preview inline citations':
    'Render live preview inline citations',
  'Render reading mode inline citations':
    'Render reading mode inline citations',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Convert [@pandoc] citations to formatted inline citations in live preview mode.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Convert [@pandoc] citations to formatted inline citations in reading mode.',
  'Process citations in links': 'Process citations in links',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.',
  // src/view.ts
  'Please provide the path to Pandoc in the Bripey Citation Suite plugin settings.':
    'Please provide the path to Pandoc in the Bripey Citation Suite plugin settings.',
  'Click to copy': 'Click to copy',
  'Click to jump to citation': 'Click to jump to citation',
  'Copy citekey': 'Copy citekey',
  'Copy reference': 'Copy reference',
  'Copy list': 'Copy list',
  'Unresolved citations': 'Unresolved citations',
  'No citations found in the current document.':
    'No citations found in the current document.',
  References: 'References',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.',
  'See here for a list of available language codes':
    'See here for a list of available language codes',
  'Cannot connect to Zotero': 'Cannot connect to Zotero',
  'Start Zotero and try again.': 'Start Zotero and try again.',
  'Libraries to include in bibliography':
    'Libraries to include in bibliography',
  'Please provide the path to your bibliography file in the Bripey Citation Suite plugin settings.':
    'Please provide the path to your bibliography file in the Bripey Citation Suite plugin settings.',
  'Refresh bibliography': 'Refresh bibliography',
  'Bripey Citation Suite settings': 'Bripey Citation Suite settings',
  'Insert bibliography at cursor': 'Insert bibliography at cursor',
  // src/tooltip.ts
  'No citation found for ': 'No citation found for ',

  // src/main.ts
  'Show reference list': 'Show reference list',

  // src/view.ts
  'Open literature note': 'Open literature note',
  'Create literature note': 'Create literature note',
  'Literature notes folder': 'Literature notes folder',
  'Folder where new literature notes are created (vault-relative). Leave blank to create at the vault root. A "Create literature note" button appears on sidebar entries when no note exists. Has no effect when ZotLit is installed — use ZotLit\'s template system instead.':
    'Folder where new literature notes are created (vault-relative). Leave blank to create at the vault root. A "Create literature note" button appears on sidebar entries when no note exists. Has no effect when ZotLit is installed — use ZotLit\'s template system instead.',
  'Open in Zotero': 'Open in Zotero',
  'Filter references…': 'Filter references…',
  'This entry exists in both your .bib file and Zotero. Zotero data is shown.':
    'This entry exists in both your .bib file and Zotero. Zotero data is shown.',
  'ZotLit detected — [@key completions are handled by ZotLit. This plugin still provides bare @key suggestions (outside brackets) and for .bib file entries.':
    'ZotLit detected — [@key completions are handled by ZotLit. This plugin still provides bare @key suggestions (outside brackets) and for .bib file entries.',
};
