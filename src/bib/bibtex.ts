import * as BibTeXParser from '@retorquere/bibtex-parser';
import { parseYaml } from 'obsidian';
import { PartialCSLEntry } from './types';

// Mapping from BibTeX/BibLaTeX entry types to CSL types.
const BIBTEX_TYPE_TO_CSL: Record<string, string> = {
  article: 'article-journal',
  book: 'book',
  booklet: 'pamphlet',
  collection: 'book',
  conference: 'paper-conference',
  dataset: 'dataset',
  inbook: 'chapter',
  incollection: 'chapter',
  inproceedings: 'paper-conference',
  manual: 'book',
  mastersthesis: 'thesis',
  misc: 'document',
  online: 'webpage',
  patent: 'patent',
  periodical: 'periodical',
  phdthesis: 'thesis',
  proceedings: 'book',
  report: 'report',
  software: 'software',
  techreport: 'report',
  thesis: 'thesis',
  unpublished: 'manuscript',
  video: 'motion_picture',
  www: 'webpage',
};

function creatorToCSL(
  creator: BibTeXParser.Creator
): { family?: string; given?: string; literal?: string } {
  if (creator.literal) return { literal: creator.literal };
  const result: Record<string, string> = {};
  if (creator.lastName) result.family = creator.lastName;
  if (creator.firstName) result.given = creator.firstName;
  return result;
}

function parseIssuedDate(
  fields: Record<string, string[]>
): { 'date-parts': number[][] } | undefined {
  // BibLaTeX: date is ISO format YYYY[-MM[-DD]]
  const dateStr = fields.date?.[0];
  if (dateStr) {
    const parts = dateStr.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
    if (parts.length > 0) return { 'date-parts': [parts] };
  }
  // Classic BibTeX: separate year (and optional month)
  const yearStr = fields.year?.[0];
  if (yearStr) {
    const year = parseInt(yearStr, 10);
    if (!isNaN(year)) return { 'date-parts': [[year]] };
  }
  return undefined;
}

function getExt(filePath: string): string {
  const base = filePath.split('/').pop() ?? filePath;
  const dot = base.lastIndexOf('.');
  return dot < 0 ? '' : base.slice(dot).toLowerCase();
}

export function parseBibTeX(raw: string): PartialCSLEntry[] {
  const options: BibTeXParser.ParserOptions = {
    errorHandler: (err: unknown) => {
      console.warn('bripey-citation-suite: BibTeX parse warning:', err);
    },
  };

  const parsed = BibTeXParser.parse(raw, options) as BibTeXParser.Bibliography;

  parsed.errors.forEach((e: { line: number; column: number; message: string }) => {
    console.error(
      `bripey-citation-suite: BibTeX parse error (line ${e.line}, col ${e.column}):`,
      e.message
    );
  });

  const results: PartialCSLEntry[] = [];

  for (const entry of parsed.entries) {
    const f = entry.fields as Record<string, string[]>;
    const csl: Record<string, unknown> = {
      id: entry.key,
      type: BIBTEX_TYPE_TO_CSL[entry.type] ?? 'document',
    };

    // Title
    const title = f.title?.[0];
    if (title) csl.title = title;

    // Container title (journal / book / proceedings / …)
    const container =
      f.journaltitle?.[0] ??
      f.journal?.[0] ??
      f.booktitle?.[0] ??
      f.maintitle?.[0];
    if (container) csl['container-title'] = container;
    const abbrev = f.shortjournal?.[0];
    if (abbrev) csl['container-title-short'] = abbrev;

    // Creators
    const creatorRoleMap: Record<string, string> = {
      author: 'author',
      editor: 'editor',
      translator: 'translator',
      bookauthor: 'container-author',
    };
    for (const [bibRole, cslRole] of Object.entries(creatorRoleMap)) {
      const creators = (entry.creators as Record<string, BibTeXParser.Creator[]>)[bibRole];
      if (creators?.length) csl[cslRole] = creators.map(creatorToCSL);
    }

    // Date
    const issued = parseIssuedDate(f);
    if (issued) csl.issued = issued;

    // Volume, issue, pages, edition
    if (f.volume?.[0]) csl.volume = f.volume[0];
    if (f.number?.[0]) csl.issue = f.number[0];
    if (f.issue?.[0]) csl.issue = f.issue[0];
    if (f.pages?.[0]) csl.page = f.pages[0].replace('--', '–');
    if (f.edition?.[0]) csl.edition = f.edition[0];

    // Publisher / institution / school
    const publisher = f.publisher?.[0] ?? f.institution?.[0] ?? f.school?.[0];
    if (publisher) csl.publisher = publisher;
    const place = f.location?.[0] ?? f.address?.[0];
    if (place) csl['publisher-place'] = place;

    // Identifiers
    if (f.doi?.[0]) csl.DOI = f.doi[0];
    if (f.url?.[0]) csl.URL = f.url[0];
    if (f.isbn?.[0]) csl.ISBN = f.isbn[0];
    if (f.issn?.[0]) csl.ISSN = f.issn[0];

    // Series
    if (f.series?.[0]) csl['collection-title'] = f.series[0];

    // Misc
    if (f.abstract?.[0]) csl.abstract = f.abstract[0];
    if (f.language?.[0]) csl.language = f.language[0];
    if (f.type?.[0]) csl.genre = f.type[0]; // thesis type, report type
    if (f.note?.[0]) csl.note = f.note[0];

    results.push(csl as unknown as PartialCSLEntry);
  }

  return results;
}

export function parseCSLJSON(raw: string): PartialCSLEntry[] {
  return JSON.parse(raw);
}

export function parseCSLYAML(raw: string): PartialCSLEntry[] {
  const data = parseYaml(raw);
  // pandoc CSL-YAML: top-level array or { references: [...] }
  if (Array.isArray(data)) return data as PartialCSLEntry[];
  if (Array.isArray(data?.references)) return data.references as PartialCSLEntry[];
  return [];
}

export function parseBibFile(raw: string, filePath: string): PartialCSLEntry[] {
  const ext = getExt(filePath);
  switch (ext) {
    case '.json': return parseCSLJSON(raw);
    case '.yaml':
    case '.yml':  return parseCSLYAML(raw);
    default:      return parseBibTeX(raw);
  }
}
