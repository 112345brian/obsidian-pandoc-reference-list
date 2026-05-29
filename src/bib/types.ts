export interface PartialCSLEntry {
  id: string;
  title: string;
  groupID?: number;
  /** Which source this entry was loaded from. Internal — not a CSL field. */
  _source?: 'bib' | 'zotero';
  /** ISO dateModified from Zotero, used to resolve cross-group duplicates. */
  _dateModified?: string;
}

export type CSLList = PartialCSLEntry[];
