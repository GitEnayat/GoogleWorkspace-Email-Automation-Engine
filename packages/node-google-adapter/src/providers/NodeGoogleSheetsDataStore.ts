import { DataStore } from '@universal-email/core';
import { google, sheets_v4 } from 'googleapis';

export class NodeGoogleSheetsDataStore implements DataStore {
  private sheets: sheets_v4.Sheets;

  constructor(auth: any) {
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  async getData(sheetId: string, range: string): Promise<any[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range
    });

    return response.data.values || [];
  }

  async getTabData(sheetId: string, tabName: string): Promise<Record<string, any>[]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabName
    });

    const values = response.data.values || [];
    if (values.length === 0) return [];

    const headers = values[0] as string[];
    const rows = values.slice(1);

    return rows.map(row => {
      const record: Record<string, any> = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  async appendRow(sheetId: string, tabName: string, row: any[]): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: tabName,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row]
      }
    });
  }
}
