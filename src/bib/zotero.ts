import { CSLList, PartialCSLEntry } from './types';
import {
  DEFAULT_ZOTERO_PORT,
  getItemJSONFromCiteKeys,
  getItemJSONFromCiteKeysNative,
  getZBib,
  getZBibNative,
  getZUserGroups,
  getZUserGroupsNative,
  isZoteroRunning,
  isZoteroRunningNative,
  refreshZBib,
  refreshZBibNative,
} from './helpers';

export interface ZoteroAdapter {
  isRunning(): Promise<boolean>;
  getGroups(): Promise<Array<{ id: number; name: string }> | null>;
  getBib(
    cacheDir: string,
    groupId: number,
    loadCached?: boolean
  ): Promise<{ list: CSLList | null; version: number }>;
  refreshBib(
    cacheDir: string,
    groupId: number,
    sinceVersion: number,
    lastUpdate?: number
  ): Promise<{ list: CSLList; modified: Map<string, PartialCSLEntry> } | null>;
  getItemsForCiteKeys(
    citeKeys: string[],
    libraryID: number
  ): Promise<any[] | null>;
}

export class BBTAdapter implements ZoteroAdapter {
  constructor(private port: string = DEFAULT_ZOTERO_PORT) {}

  isRunning() {
    return isZoteroRunning(this.port);
  }

  getGroups() {
    return getZUserGroups(this.port);
  }

  async getBib(cacheDir: string, groupId: number, loadCached?: boolean) {
    const list = await getZBib(this.port, cacheDir, groupId, loadCached);
    return { list: list ?? null, version: 0 };
  }

  async refreshBib(
    cacheDir: string,
    groupId: number,
    _sinceVersion: number,
    lastUpdate?: number
  ) {
    const res = await refreshZBib(
      this.port,
      cacheDir,
      groupId,
      lastUpdate ?? 0
    );
    if (!res) return null;
    return { list: res.list, modified: res.modified };
  }

  getItemsForCiteKeys(citeKeys: string[], libraryID: number) {
    return getItemJSONFromCiteKeys(this.port, citeKeys, libraryID);
  }
}

export class NativeAdapter implements ZoteroAdapter {
  constructor(private port: string = DEFAULT_ZOTERO_PORT) {}

  isRunning() {
    return isZoteroRunningNative(this.port);
  }

  getGroups() {
    return getZUserGroupsNative(this.port);
  }

  getBib(cacheDir: string, groupId: number, loadCached?: boolean) {
    return getZBibNative(this.port, cacheDir, groupId, loadCached);
  }

  async refreshBib(
    cacheDir: string,
    groupId: number,
    sinceVersion: number
  ) {
    const res = await refreshZBibNative(
      this.port,
      cacheDir,
      groupId,
      sinceVersion
    );
    if (!res) return null;
    return { list: res.list, modified: res.modified };
  }

  getItemsForCiteKeys(citeKeys: string[], libraryID: number) {
    return getItemJSONFromCiteKeysNative(this.port, citeKeys, libraryID);
  }
}
