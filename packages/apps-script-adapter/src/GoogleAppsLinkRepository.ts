/**
 * Google Apps Script Link Repository
 * Implements LinkRepository using SpreadsheetApp
 */

import { LinkRepository, ManagedLink } from "@universal-email/core";

export class GoogleAppsLinkRepository implements LinkRepository {
  private linkCache: Map<string, ManagedLink> = new Map();
  private loaded: boolean = false;

  async loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]> {
    const spreadsheet = SpreadsheetApp.openById(sourceId);
    const sheet = spreadsheet.getSheetByName(tabName);

    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];
    const rows = data.slice(1);

    const linkKeyIndex = headers.findIndex(
      (h) => h.toLowerCase().includes("link_key") || h.toLowerCase() === "key",
    );
    const urlIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("target_url") ||
        h.toLowerCase().includes("url"),
    );
    const labelIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("label") || h.toLowerCase().includes("text"),
    );

    if (linkKeyIndex === -1 || urlIndex === -1) {
      throw new Error(
        "Link repository must have Link_Key and Target_URL columns",
      );
    }

    this.linkCache.clear();
    const links = rows
      .filter((row) => row[linkKeyIndex] && row[urlIndex])
      .map((row) => {
        const link: ManagedLink = {
          key: row[linkKeyIndex] as string,
          url: row[urlIndex] as string,
          label: labelIndex !== -1 ? (row[labelIndex] as string) : undefined,
        };
        this.linkCache.set(link.key, link);
        return link;
      });

    this.loaded = true;
    return links;
  }

  async getLink(key: string): Promise<ManagedLink | null> {
    if (!this.loaded) {
      throw new Error(
        "Links have not been loaded yet. Call loadLinks() first.",
      );
    }
    return this.linkCache.get(key) ?? null;
  }
}
