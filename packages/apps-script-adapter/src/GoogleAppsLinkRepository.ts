/**
 * Google Apps Script Link Repository
 * Implements LinkRepository using SpreadsheetApp
 */

import { LinkRepository, ManagedLink } from '@universal-email/core';

export class GoogleAppsLinkRepository implements LinkRepository {
  async loadLinks(sourceId: string, tabName: string): Promise<ManagedLink[]> {
    const spreadsheet = SpreadsheetApp.openById(sourceId);
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];
    const rows = data.slice(1);

    const linkKeyIndex = headers.findIndex(h => 
      h.toLowerCase().includes('link_key') || h.toLowerCase() === 'key'
    );
    const urlIndex = headers.findIndex(h => 
      h.toLowerCase().includes('target_url') || h.toLowerCase().includes('url')
    );
    const labelIndex = headers.findIndex(h => 
      h.toLowerCase().includes('label') || h.toLowerCase().includes('text')
    );

    if (linkKeyIndex === -1 || urlIndex === -1) {
      throw new Error('Link repository must have Link_Key and Target_URL columns');
    }

    return rows
      .filter(row => row[linkKeyIndex] && row[urlIndex])
      .map(row => ({
        key: row[linkKeyIndex] as string,
        url: row[urlIndex] as string,
        label: labelIndex !== -1 ? (row[labelIndex] as string) : undefined
      }));
  }

  async getLink(key: string): Promise<ManagedLink | null> {
    // For single link lookup, we'd need the source config
    // This is a simplified version - in practice, you'd pass sourceId/tabName
    throw new Error('getLink requires source configuration');
  }
}
