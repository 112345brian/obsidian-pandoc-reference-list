import { cslList } from '../bib/cslList';
import { langList } from '../bib/cslLangList';

export function searchCSL(inputValue: string) {
  return cslList.search(inputValue).map((res) => res.item);
}

export function searchCSLLangs(inputValue: string) {
  return langList.search(inputValue).map((res) => res.item);
}
