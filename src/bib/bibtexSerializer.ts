import { PartialCSLEntry } from './types';

// ─── CSL type → BibTeX entry type ────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  'article':                 'article',
  'article-journal':         'article',
  'article-magazine':        'article',
  'article-newspaper':       'article',
  'book':                    'book',
  'chapter':                 'incollection',
  'entry-encyclopedia':      'inbook',
  'entry-dictionary':        'inbook',
  'paper-conference':        'inproceedings',
  'thesis':                  'phdthesis',
  'report':                  'techreport',
  'manuscript':              'unpublished',
  'webpage':                 'misc',
  'post-weblog':             'misc',
  'broadcast':               'misc',
  'dataset':                 'misc',
  'software':                'misc',
  'patent':                  'patent',
};

function cslTypeToBib(type?: string): string {
  return TYPE_MAP[type ?? ''] ?? 'misc';
}

// ─── Name formatting ──────────────────────────────────────────────────────────

function formatName(n: any): string {
  if (!n) return '';
  if (typeof n === 'string') return n;
  if (n.literal) return n.literal;
  const parts: string[] = [];
  if (n.family) parts.push(n.family);
  if (n.given)  parts.push(`, ${n.given}`);
  if (n.suffix) parts.push(`, ${n.suffix}`);
  return parts.join('');
}

function nameList(names: any[]): string {
  return names.map(formatName).filter(Boolean).join(' and ');
}

// ─── Field value helpers ──────────────────────────────────────────────────────

/** Wrap a string in BibTeX braces. Double {{ }} protects case. */
function brace(value: unknown): string {
  return `{${String(value ?? '')}}`;
}

/** BibTeX page ranges use -- not -. */
function formatPages(p: unknown): string {
  return String(p ?? '').replace(/(?<![- ])-(?![-\s])/g, '--');
}

// ─── Main serializer ──────────────────────────────────────────────────────────

export function cslEntryToBibTeX(entry: PartialCSLEntry): string {
  const e = entry as any;
  const type  = cslTypeToBib(e.type);
  const key   = entry.id;
  const fields: [string, string][] = [];

  const add = (field: string, value: unknown) => {
    const str = String(value ?? '').trim();
    if (str) fields.push([field, brace(str)]);
  };

  // Title
  add('title', entry.title);

  // Authors / editors
  if (Array.isArray(e.author) && e.author.length)
    add('author', nameList(e.author));
  if (Array.isArray(e.editor) && e.editor.length)
    add('editor', nameList(e.editor));
  if (Array.isArray(e.translator) && e.translator.length)
    add('translator', nameList(e.translator));

  // Date
  const dateParts = e.issued?.['date-parts']?.[0];
  if (dateParts?.[0]) add('year',  dateParts[0]);
  if (dateParts?.[1]) add('month', dateParts[1]);

  // Venue / container
  const container = e['container-title'];
  if (container) {
    const venueField =
      type === 'article' ? 'journal'
      : type === 'inproceedings' ? 'booktitle'
      : type === 'incollection'  ? 'booktitle'
      : type === 'inbook'        ? 'booktitle'
      : 'journal';
    add(venueField, container);
  }

  // Conference / event (inproceedings)
  if (e['event-title'] || e['event'])
    add('organization', e['event-title'] ?? e['event']);

  // Series / collection
  if (e['collection-title']) add('series', e['collection-title']);

  // Volume, number, pages, edition
  if (e.volume)   add('volume',  e.volume);
  if (e.issue)    add('number',  e.issue);
  if (e.number && type === 'techreport') add('number', e.number);
  if (e.page)     fields.push(['pages', brace(formatPages(e.page))]);
  if (e.edition)  add('edition', e.edition);

  // Publisher / institution / school / address
  const pub = e.publisher;
  if (pub) {
    const pubField =
      type === 'techreport'  ? 'institution'
      : type === 'phdthesis' || type === 'mastersthesis' ? 'school'
      : 'publisher';
    add(pubField, pub);
  }
  if (e['publisher-place']) add('address', e['publisher-place']);

  // Thesis type
  if (e.genre && (type === 'phdthesis' || type === 'mastersthesis'))
    add('type', e.genre);

  // Identifiers
  if (e.DOI)  add('doi',  e.DOI);
  if (e.URL)  add('url',  e.URL);
  if (e.ISBN) add('isbn', e.ISBN);
  if (e.ISSN) add('issn', e.ISSN);
  if (e.PMID) add('pmid', e.PMID);
  if (e['call-number']) add('lccn', e['call-number']);

  // Abstract and note
  if (e.abstract) add('abstract', e.abstract);
  if (e.note)     add('note', e.note);
  if (e.keyword || e.keywords)
    add('keywords', e.keyword ?? e.keywords);

  // Language
  if (e.language) add('langid', e.language);

  const body = fields.map(([k, v]) => `  ${k} = ${v}`).join(',\n');
  return `@${type}{${key},\n${body}\n}`;
}

export function cslToBibTeX(entries: PartialCSLEntry[]): string {
  return entries.map(cslEntryToBibTeX).join('\n\n');
}
