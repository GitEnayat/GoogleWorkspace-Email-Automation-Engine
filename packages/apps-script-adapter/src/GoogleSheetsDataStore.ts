/**
 * Google Apps Script Data Store
 * Implements DataStore using SpreadsheetApp
 */

import { DataStore } from '@universal-email/core';

export class GoogleSheetsDataStore implements DataStore {
  async getData(sheetId: string, range: string): Promise<any[][]> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    
    // Parse range (e.g., "'Q1_Results'!A1:E10" or "A1:E10")
    const { sheetName, range: cellRange } = this.parseRange(range);
    
    const sheet = sheetName 
      ? spreadsheet.getSheetByName(sheetName)
      : spreadsheet.getSheets()[0];
    
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const dataRange = sheet.getRange(cellRange || 'A1:Z1000');
    return dataRange.getValues();
  }

  async getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0] as string[];
    const rows = data.slice(1);

    return rows.map(row => {
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  async appendRow(sheetId: string, tabName: string, row: any[]): Promise<void> {
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(tabName);
    
    if (!sheet) {
      throw new Error(`Tab '${tabName}' not found`);
    }

    sheet.appendRow(row);
  }

  private parseRange(range: string): { sheetName?: string; range: string } {
    // Parse "'Sheet Name'!A1:B2" or "A1:B2"
    const match = range.match(/^'([^']+)'!(.+)$/);
    if (match) {
      return { sheetName: match[1], range: match[2] };
    }
    return { range };
  }
}
